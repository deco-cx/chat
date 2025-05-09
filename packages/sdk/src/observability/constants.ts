import { createContextKey } from "@opentelemetry/api";

export const SERVICE_NAME = "deco-chat";

export const HEAD_SAMPLER_RATIO = 1;

export const REQUEST_CONTEXT_KEY = createContextKey("Current request");

export const DEBUG_QS = "__d";
