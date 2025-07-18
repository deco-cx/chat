import process from "node:process";
import { getActorLocator } from "@deco/actors";
import { context, type Span } from "@opentelemetry/api";
import {
  ParentBasedSampler,
  type ReadableSpan,
  TraceIdRatioBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import {
  HEAD_SAMPLER_RATIO,
  REQUEST_CONTEXT_KEY,
  SERVICE_NAME,
} from "./constants.ts";
import type { ResolveConfigFn } from "./otel/sdk.ts";
import { DebugSampler } from "./samplers/debug.ts";
import { headersStringToObject } from "./utils.ts";

const processSpan = (span: ReadableSpan): ReadableSpan => {
  const method = span.attributes["http.request.method"] as string;
  const path = span.attributes["url.path"] as string;
  const fullUrl = span.attributes["url.full"] as string;

  if (span.name.startsWith("fetchHandler")) {
    // Handle actor invocations
    if (path?.startsWith("/actors/")) {
      const request = context.active().getValue(REQUEST_CONTEXT_KEY) as Request;
      if (request) {
        const locator = getActorLocator(new URL(request.url), request);
        if (locator) {
          span.attributes["actor.name"] = locator.name;
          span.attributes["actor.method"] = locator.method;
          let friendlyName = `${locator.name}/${locator.method}`;
          if (locator.id) {
            span.attributes["actor.id"] = locator.id;
            friendlyName = `${locator.id} ${friendlyName}`;
          }
          (span as unknown as Span).updateName(`ACTOR@${friendlyName}`);
        }
      } else {
        // Handle external service calls
        (span as unknown as Span).updateName(`DO@${method} ${fullUrl}`);
      }
    } else {
      // Handle regular HTTP requests
      const route = `${method} ${path}`;
      (span as unknown as Span).updateName(route);
      (span as unknown as Span).setAttribute("http.route", route);
    }
  } else if (span.name.startsWith("fetch")) {
    // Handle external service calls
    (span as unknown as Span).updateName(`${method} ${fullUrl}`);
  }

  // Add request.internal flag if not present
  if (!span.attributes["request.internal"]) {
    span.attributes["request.internal"] =
      span.attributes["http.traceparent"] !== undefined;
  }

  return span;
};

export const config: ResolveConfigFn = (_env, _trigger) => {
  const env = { ..._env, ...process.env };
  const headers = headersStringToObject(
    env.OTEL_EXPORTER_OTLP_HEADERS as string,
  );

  return {
    exporter: {
      url: new URL(`/v1/traces`, `${env.OTEL_EXPORTER_OTLP_ENDPOINT}`).href,
      headers,
    },
    service: { name: SERVICE_NAME },
    sampling: {
      headSampler: new ParentBasedSampler({
        root: new DebugSampler(
          new TraceIdRatioBasedSampler(HEAD_SAMPLER_RATIO),
        ),
      }),
    },
    postProcessor: (spans: ReadableSpan[]): ReadableSpan[] => {
      return spans.map(processSpan);
    },
  };
};
