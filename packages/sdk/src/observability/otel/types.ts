import type { TextMapPropagator } from "@opentelemetry/api";
import type {
  ReadableSpan,
  Sampler,
  SpanExporter,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import type { OTLPExporterConfig } from "./exporter.ts";
import type {
  FetcherConfig,
  FetchHandlerConfig,
} from "./instrumentation/fetch.ts";
import type { TailSampleFn } from "./sampling.ts";

export type PostProcessorFn = (spans: ReadableSpan[]) => ReadableSpan[];

export type ExporterConfig = OTLPExporterConfig | SpanExporter;

export interface HandlerConfig {
  fetch?: FetchHandlerConfig;
}

export interface ServiceConfig {
  name: string;
  namespace?: string;
  version?: string;
}

export interface ParentRatioSamplingConfig {
  acceptRemote?: boolean;
  ratio: number;
}

type HeadSamplerConf = Sampler | ParentRatioSamplingConfig;
export interface SamplingConfig<HS extends HeadSamplerConf = HeadSamplerConf> {
  headSampler?: HS;
  tailSampler?: TailSampleFn;
}

export interface InstrumentationOptions {
  instrumentGlobalFetch?: boolean;
  instrumentGlobalCache?: boolean;
}

interface TraceConfigBase {
  service: ServiceConfig;
  handlers?: HandlerConfig;
  fetch?: FetcherConfig;
  postProcessor?: PostProcessorFn;
  sampling?: SamplingConfig;
  propagator?: TextMapPropagator;
  instrumentation?: InstrumentationOptions;
}

interface TraceConfigExporter extends TraceConfigBase {
  exporter: ExporterConfig;
}

interface TraceConfigSpanProcessors extends TraceConfigBase {
  spanProcessors: SpanProcessor | SpanProcessor[];
}

export type TraceConfig = TraceConfigExporter | TraceConfigSpanProcessors;

export function isSpanProcessorConfig(
  config: TraceConfig,
): config is TraceConfigSpanProcessors {
  return !!(config as TraceConfigSpanProcessors).spanProcessors;
}

export interface ResolvedTraceConfig extends TraceConfigBase {
  handlers: Required<HandlerConfig>;
  fetch: Required<FetcherConfig>;
  postProcessor: PostProcessorFn;
  sampling: Required<SamplingConfig<Sampler>>;
  spanProcessors: SpanProcessor[];
  propagator: TextMapPropagator;
  instrumentation: InstrumentationOptions;
}

export interface DOConstructorTrigger {
  id: string;
  name?: string;
}

export type Trigger =
  | Request
  | MessageBatch
  | ScheduledController
  | DOConstructorTrigger
  | "do-alarm"
  | ForwardableEmailMessage;
