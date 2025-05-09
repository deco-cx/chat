import type { Attributes, Context, Link, SpanKind } from "@opentelemetry/api";
import {
  type Sampler,
  SamplingDecision,
  type SamplingResult,
} from "@opentelemetry/sdk-trace-base";
import { Hosts } from "../../hosts.ts";
import { DEBUG_QS, REQUEST_CONTEXT_KEY } from "../constants.ts";

const ALLOWED_HOSTS: string[] = [Hosts.FS, Hosts.API, Hosts.Chat];

export const reqCorrelationId = (req: Request) => {
  const url = new URL(req.url);
  let correlationId = url.searchParams.get(DEBUG_QS);
  if (!correlationId) {
    correlationId = req.headers.get("x-trace-debug-id");
  }
  return correlationId;
};

export const setCorrelationId = (headers: Headers, correlationId: string) => {
  try {
    headers.set("x-trace-debug-id", correlationId);
  } catch {
    // ignore if headers are immutable
  }
};

export class DebugSampler implements Sampler {
  constructor(protected inner?: Sampler) { }
  shouldSample(
    context: Context,
    traceId: string,
    spanName: string,
    spanKind: SpanKind,
    attributes: Attributes,
    links: Link[],
  ): SamplingResult {
    const req = context.getValue(REQUEST_CONTEXT_KEY) as Request;
    if (!req) {
      return {
        decision: SamplingDecision.NOT_RECORD,
      };
    }
    const correlationId = reqCorrelationId(req);
    if (correlationId) {
      return {
        decision: SamplingDecision.RECORD_AND_SAMPLED,
        attributes: {
          "trace.debug.id": correlationId,
        },
      };
    }

    const url = new URL(req.url);
    const host = req.headers.get("host") ?? url.host;
    if (!ALLOWED_HOSTS.includes(host)) {
      return {
        decision: SamplingDecision.NOT_RECORD,
      };
    }

    if (this.inner) {
      const sampleDecision = this.inner.shouldSample(
        context,
        traceId,
        spanName,
        spanKind,
        attributes,
        links,
      );
      if (sampleDecision.decision === SamplingDecision.RECORD_AND_SAMPLED) {
        const correlationId = crypto.randomUUID();
        setCorrelationId(req.headers, correlationId);
        sampleDecision.attributes = {
          ...(sampleDecision.attributes ?? {}),
          "trace.debug.id": correlationId,
        };
      }
      return sampleDecision;
    }
    return {
      decision: SamplingDecision.NOT_RECORD,
    };
  }
  toString(): string {
    return "DebugSampler";
  }
}
