export { SpanStatusCode, trace } from "@opentelemetry/api";
export type { DOClass } from "./otel/instrumentation/do.ts";
export { instrument, instrumentDO } from "./otel/sdk.ts";
export { config } from "./otel.config.ts";
export { reqCorrelationId, setCorrelationId } from "./samplers/debug.ts";
