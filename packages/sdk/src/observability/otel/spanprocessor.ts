import { type Context, type Span, trace } from "@opentelemetry/api";
import type {
  ReadableSpan,
  SpanExporter,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { type ExportResult, ExportResultCode } from "@opentelemetry/core";
import {
  type Action,
  type State,
  stateMachine,
} from "./vendor/ts-checked-fsm/StateMachine.ts";

import { getActiveConfig } from "./config.ts";
import type { TailSampleFn } from "./sampling.ts";
import type { PostProcessorFn } from "./types.ts";

type CompletedTrace = {
  traceId: string;
  localRootSpan: ReadableSpan;
  completedSpans: ReadableSpan[];
};

type InProgressTrace = {
  inProgressSpanIds: Set<string>;
} & CompletedTrace;

type InitialState = State<"not_started">;
type InProgressTraceState = State<"in_progress", InProgressTrace>;
type TraceCompleteState = State<"trace_complete", CompletedTrace>;
type ExportingState = State<"exporting", { promise: Promise<ExportResult> }>;
type DoneState = State<"done">;

type StartExportArguments = {
  exporter: SpanExporter;
  tailSampler: TailSampleFn;
  postProcessor: PostProcessorFn;
};

type StartSpanAction = Action<"startSpan", { span: Span }>;
type EndSpanAction = Action<"endSpan", { span: ReadableSpan }>;
type StartExportAction = Action<"startExport", { args: StartExportArguments }>;

function newTrace(
  currentState: InitialState,
  { span }: StartSpanAction,
): InProgressTraceState {
  const spanId = span.spanContext().spanId;
  return {
    ...currentState,
    stateName: "in_progress",
    traceId: span.spanContext().traceId,
    localRootSpan: span as unknown as ReadableSpan,
    completedSpans: [] as ReadableSpan[],
    inProgressSpanIds: new Set([spanId]),
  } as const;
}

function newSpan(
  currentState: InProgressTraceState,
  { span }: StartSpanAction,
): InProgressTraceState {
  const spanId = span.spanContext().spanId;
  currentState.inProgressSpanIds.add(spanId);
  return { ...currentState };
}

function endSpan(
  currentState: InProgressTraceState,
  { span }: EndSpanAction,
): InProgressTraceState | TraceCompleteState {
  currentState.completedSpans.push(span);
  currentState.inProgressSpanIds.delete(span.spanContext().spanId);
  if (currentState.inProgressSpanIds.size === 0) {
    return {
      stateName: "trace_complete",
      traceId: currentState.traceId,
      localRootSpan: currentState.localRootSpan,
      completedSpans: currentState.completedSpans,
    } as const;
  } else {
    return { ...currentState };
  }
}

function startExport(
  currentState: TraceCompleteState,
  { args }: StartExportAction,
): ExportingState | DoneState {
  const { exporter, tailSampler, postProcessor } = args;
  const { traceId, localRootSpan, completedSpans: spans } = currentState;
  const shouldExport = tailSampler({ traceId, localRootSpan, spans });
  if (shouldExport) {
    const exportSpans = postProcessor(spans);
    const promise = new Promise<ExportResult>((resolve) => {
      exporter.export(exportSpans, resolve);
    });
    return { stateName: "exporting", promise };
  } else {
    return { stateName: "done" };
  }
}

const { nextState } = stateMachine()
  .state("not_started")
  .state<"in_progress", InProgressTraceState>("in_progress")
  .state<"trace_complete", TraceCompleteState>("trace_complete")
  .state<"exporting", ExportingState>("exporting")
  .state("done")
  .transition("not_started", "in_progress")
  .transition("in_progress", "in_progress")
  .transition("in_progress", "trace_complete")
  .transition("trace_complete", "exporting")
  .transition("trace_complete", "done")
  .transition("exporting", "done")
  .action<"startSpan", StartSpanAction>("startSpan")
  .action<"endSpan", EndSpanAction>("endSpan")
  .action<"startExport", StartExportAction>("startExport")
  .action("exportDone")
  .actionHandler("not_started", "startSpan", newTrace)
  .actionHandler("in_progress", "startSpan", newSpan)
  .actionHandler("in_progress", "endSpan", endSpan)
  .actionHandler("trace_complete", "startExport", startExport)
  .actionHandler("exporting", "exportDone", (_c, _a) => {
    return { stateName: "done" } as const;
  })
  .done();

type AnyTraceState = Parameters<typeof nextState>[0];
type AnyTraceAction = Parameters<typeof nextState>[1];

export class BatchTraceSpanProcessor implements SpanProcessor {
  private traceLookup: Map<string, AnyTraceState> = new Map();
  private localRootSpanLookup: Map<string, string> = new Map();
  private inprogressExports: Map<string, Promise<ExportResult>> = new Map();

  constructor(private exporter: SpanExporter) {}

  private action(
    localRootSpanId: string,
    action: AnyTraceAction,
  ): AnyTraceState {
    const state = this.traceLookup.get(localRootSpanId) ||
      { stateName: "not_started" };
    const newState = nextState(state, action);
    if (newState.stateName === "done") {
      this.traceLookup.delete(localRootSpanId);
    } else {
      this.traceLookup.set(localRootSpanId, newState);
    }
    return newState;
  }

  private export(localRootSpanId: string) {
    const config = getActiveConfig();
    // TODO (@0xHericles) - This is a bug in the instrumentation logic
    if (!config) {
      return;
    }

    const { sampling, postProcessor } = config;
    const exportArgs = {
      exporter: this.exporter,
      tailSampler: sampling.tailSampler,
      postProcessor,
    };
    const newState = this.action(localRootSpanId, {
      actionName: "startExport",
      args: exportArgs,
    });
    if (newState.stateName === "exporting") {
      const promise = newState.promise;
      this.inprogressExports.set(localRootSpanId, promise);
      promise.then((result) => {
        if (result.code === ExportResultCode.FAILED) {
          console.log("Error sending spans to exporter:", result.error);
        }
        this.action(localRootSpanId, { actionName: "exportDone" });
        this.inprogressExports.delete(localRootSpanId);
      });
    }
  }

  onStart(span: Span, parentContext: Context): void {
    const spanId = span.spanContext().spanId;
    const parentSpanId = trace.getSpan(parentContext)?.spanContext()?.spanId;
    const parentRootSpanId = parentSpanId
      ? this.localRootSpanLookup.get(parentSpanId)
      : undefined;
    const localRootSpanId = parentRootSpanId || spanId;
    this.localRootSpanLookup.set(spanId, localRootSpanId);

    this.action(localRootSpanId, { actionName: "startSpan", span });
  }

  onEnd(span: ReadableSpan): void {
    const spanId = span.spanContext().spanId;
    const localRootSpanId = this.localRootSpanLookup.get(spanId);
    if (localRootSpanId) {
      const state = this.action(localRootSpanId, {
        actionName: "endSpan",
        span,
      });
      if (state.stateName === "trace_complete") {
        state.completedSpans.forEach((span) => {
          this.localRootSpanLookup.delete(span.spanContext().spanId);
        });
        this.export(localRootSpanId);
      }
    }
  }

  async forceFlush(): Promise<void> {
    await Promise.allSettled(this.inprogressExports.values());
  }

  async shutdown(): Promise<void> {}
}
