export { trace } from "@opentelemetry/api";
export { config } from "./otel.config.ts";
export type { DOClass } from "./otel/instrumentation/do.ts";
export { instrument, instrumentDO } from "./otel/sdk.ts";
export { SpanStatusCode } from "@opentelemetry/api";
export { reqCorrelationId, setCorrelationId } from "./samplers/debug.ts";