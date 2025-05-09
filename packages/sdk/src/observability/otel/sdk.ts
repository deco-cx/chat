// deno-lint-ignore-file no-explicit-any
import { propagation } from "@opentelemetry/api";
import { Resource } from "@opentelemetry/resources";

import { config as defaultConfig } from "../otel.config.ts";
import { type Initialiser, parseConfig } from "./config.ts";
import { instrumentDOClass } from "./instrumentation/do.ts";
import {
  createFetchHandler,
  instrumentGlobalFetch,
} from "./instrumentation/fetch.ts";
import { WorkerTracerProvider } from "./provider.ts";
import type { ResolvedTraceConfig, TraceConfig, Trigger } from "./types.ts";
import { unwrap } from "./wrap.ts";

type FetchHandler = ExportedHandlerFetchHandler<unknown, unknown>;

export type ResolveConfigFn<Env = Record<string, unknown>> = (
  env: Env,
  trigger: Trigger,
) => TraceConfig;
export type ConfigurationOption = TraceConfig | ResolveConfigFn;

export function isRequest(trigger: Trigger): trigger is Request {
  return trigger instanceof Request;
}

export function isMessageBatch(trigger: Trigger): trigger is MessageBatch {
  return !!(trigger as MessageBatch).ackAll;
}

export function isAlarm(trigger: Trigger): trigger is "do-alarm" {
  return trigger === "do-alarm";
}

const createResource = (config: ResolvedTraceConfig): Resource => {
  const workerResourceAttrs = {
    "cloud.provider": "cloudflare",
    "cloud.platform": "cloudflare.workers",
    "cloud.region": "earth",
    "faas.max_memory": 134217728,
    "telemetry.sdk.language": "js",
    "telemetry.sdk.name": "@microlabs/otel-cf-workers",
    // TODO (@0xHericles): add version
    // 'telemetry.sdk.version': versions['@microlabs/otel-cf-workers'],
    // 'telemetry.sdk.build.node_version': versions['node'],
  };
  const serviceResource = new Resource({
    "service.name": config.service.name,
    "service.namespace": config.service.namespace,
    "service.version": config.service.version,
  });
  const resource = new Resource(workerResourceAttrs);
  return resource.merge(serviceResource);
};

let initialised = false;
function init(config: ResolvedTraceConfig): void {
  if (!initialised) {
    // TODO (@mcandeia) - This is a bug in the instrumentation logic
    // remove this so we can use without instrumenting cache
    // if (config.instrumentation.instrumentGlobalCache) {
    //   instrumentGlobalCache();
    // }
    if (config.instrumentation.instrumentGlobalFetch) {
      instrumentGlobalFetch();
    }
    propagation.setGlobalPropagator(config.propagator);
    const resource = createResource(config);

    const provider = new WorkerTracerProvider(config.spanProcessors, resource);
    provider.register();
    initialised = true;
  }
}

function createInitialiser(config: ConfigurationOption): Initialiser {
  if (typeof config === "function") {
    return (env, trigger) => {
      const conf = parseConfig(config(env, trigger));
      init(conf);
      return conf;
    };
  } else {
    return () => {
      const conf = parseConfig(config);
      init(conf);
      return conf;
    };
  }
}

export function instrument<E, Q, C>(
  handler: ExportedHandler<E, Q, C>,
  config: ConfigurationOption = defaultConfig,
): ExportedHandler<E, Q, C> {
  const initialiser = createInitialiser(config);

  if (handler.fetch) {
    const fetcher = unwrap(handler.fetch) as FetchHandler;
    handler.fetch = createFetchHandler(fetcher, initialiser);
  }

  return handler;
}

export function instrumentDO(
  doClass: any,
  config: ConfigurationOption = defaultConfig,
) {
  const initialiser = createInitialiser(config);

  return instrumentDOClass(doClass, initialiser);
}

export { waitUntilTrace } from "./instrumentation/fetch.ts";

export const __unwrappedFetch = unwrap(fetch);
