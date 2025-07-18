import { SpanStatusCode, TraceFlags } from "@opentelemetry/api";
import {
  ParentBasedSampler,
  type ReadableSpan,
  type Sampler,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import type { ParentRatioSamplingConfig } from "./types.ts";

export interface LocalTrace {
  readonly traceId: string;
  readonly localRootSpan: ReadableSpan;
  readonly spans: ReadableSpan[];
}

export type TailSampleFn = (traceInfo: LocalTrace) => boolean;

export function multiTailSampler(samplers: TailSampleFn[]): TailSampleFn {
  return (traceInfo) => {
    return samplers.reduce(
      (result, sampler) => result || sampler(traceInfo),
      false,
    );
  };
}

export const isHeadSampled: TailSampleFn = (traceInfo) => {
  const localRootSpan = traceInfo.localRootSpan;
  return (
    (localRootSpan.spanContext().traceFlags & TraceFlags.SAMPLED) ===
    TraceFlags.SAMPLED
  );
};

export const isRootErrorSpan: TailSampleFn = (traceInfo) => {
  const localRootSpan = traceInfo.localRootSpan;
  return localRootSpan.status.code === SpanStatusCode.ERROR;
};

export function createSampler(conf: ParentRatioSamplingConfig): Sampler {
  const ratioSampler = new TraceIdRatioBasedSampler(conf.ratio);
  if (typeof conf.acceptRemote === "boolean" && !conf.acceptRemote) {
    return new ParentBasedSampler({
      root: ratioSampler,
      remoteParentSampled: ratioSampler,
      remoteParentNotSampled: ratioSampler,
    });
  } else {
    return new ParentBasedSampler({ root: ratioSampler });
  }
}
