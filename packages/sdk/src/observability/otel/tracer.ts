import {
  type Attributes,
  type Context,
  context as api_context,
  type Span,
  SpanKind,
  type SpanOptions,
  trace,
  TraceFlags,
  type Tracer,
} from "@opentelemetry/api";
import { sanitizeAttributes } from "@opentelemetry/core";
import type { Resource } from "@opentelemetry/resources";
import {
  AlwaysOffSampler,
  RandomIdGenerator,
  type ReadableSpan,
  SamplingDecision,
  type SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

import { getActiveConfig } from "./config.ts";
import { SpanImpl } from "./span.ts";

let withNextSpanAttributes: Attributes;

export class WorkerTracer implements Tracer {
  private readonly _spanProcessors: SpanProcessor[];
  private readonly resource: Resource;
  private readonly idGenerator: RandomIdGenerator = new RandomIdGenerator();
  constructor(spanProcessors: SpanProcessor[], resource: Resource) {
    this._spanProcessors = spanProcessors;
    this.resource = resource;
  }

  get spanProcessors() {
    return this._spanProcessors;
  }

  addToResource(extra: Resource) {
    this.resource.merge(extra);
  }

  startSpan(
    name: string,
    options: SpanOptions = {},
    context = api_context.active(),
  ): Span {
    if (options.root) {
      context = trace.deleteSpan(context);
    }
    const parentSpan = trace.getSpan(context);
    const parentSpanContext = parentSpan?.spanContext();
    const hasParentContext =
      parentSpanContext && trace.isSpanContextValid(parentSpanContext);

    const traceId = hasParentContext
      ? parentSpanContext.traceId
      : this.idGenerator.generateTraceId();
    const spanKind = options.kind || SpanKind.INTERNAL;
    const sanitisedAttrs = sanitizeAttributes(options.attributes);

    const config = getActiveConfig();

    // TODO (@0xHericles) - This is a bug in the instrumentation logic
    const sampler = config
      ? config.sampling.headSampler
      : new AlwaysOffSampler();

    const samplingDecision = sampler.shouldSample(
      context,
      traceId,
      name,
      spanKind,
      sanitisedAttrs,
      [],
    );
    const { decision, traceState, attributes: attrs } = samplingDecision;

    const attributes = Object.assign(
      {},
      sanitisedAttrs,
      attrs,
      withNextSpanAttributes,
    );
    withNextSpanAttributes = {};

    const spanId = this.idGenerator.generateSpanId();
    const parentSpanId = hasParentContext
      ? parentSpanContext.spanId
      : undefined;
    const traceFlags =
      decision === SamplingDecision.RECORD_AND_SAMPLED
        ? TraceFlags.SAMPLED
        : TraceFlags.NONE;
    const spanContext = { traceId, spanId, traceFlags, traceState };

    const span = new SpanImpl({
      attributes,
      name,
      onEnd: (span) => {
        this.spanProcessors.forEach((sp) => {
          sp.onEnd(span as unknown as ReadableSpan);
        });
      },
      resource: this.resource,
      spanContext,
      parentSpanId,
      spanKind,
      startTime: options.startTime,
    });
    this.spanProcessors.forEach((sp) => {
      //Do not get me started on the idosyncracies of the Otel JS libraries.
      //@ts-ignore: SpanImpl is not a ReadableSpan
      sp.onStart(span, context);
    });
    return span;
  }

  startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    options: SpanOptions,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    options: SpanOptions,
    context: Context,
    fn: F,
  ): ReturnType<F>;
  startActiveSpan<F extends (span: Span) => ReturnType<F>>(
    name: string,
    ...args: unknown[]
  ): ReturnType<F> {
    const options = args.length > 1 ? (args[0] as SpanOptions) : undefined;
    const parentContext =
      args.length > 2 ? (args[1] as Context) : api_context.active();
    const fn = args[args.length - 1] as F;

    const span = this.startSpan(name, options, parentContext);
    const contextWithSpanSet = trace.setSpan(parentContext, span);

    return api_context.with(contextWithSpanSet, fn, undefined, span);
  }
}

export function withNextSpan(attrs: Attributes) {
  withNextSpanAttributes = Object.assign({}, withNextSpanAttributes, attrs);
}
