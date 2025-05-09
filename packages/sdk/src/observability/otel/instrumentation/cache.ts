import { SpanKind, type SpanOptions, trace } from "@opentelemetry/api";
import { wrap } from "../wrap.ts";

type CacheFns = Cache[keyof Cache];

const tracer = trace.getTracer("cache instrumentation");

function sanitiseURL(url: string): string {
  const u = new URL(url);
  return `${u.protocol}//${u.host}${u.pathname}${u.search}`;
}

function instrumentFunction<T extends CacheFns>(
  fn: T,
  cacheName: string,
  op: string,
): T {
  const handler: ProxyHandler<typeof fn> = {
    apply(target, thisArg, argArray) {
      const attributes = {
        "cache.name": cacheName,
        "http.url": argArray[0].url ? sanitiseURL(argArray[0].url) : undefined,
        "cache.operation": op,
      };
      const options: SpanOptions = { kind: SpanKind.CLIENT, attributes };
      return tracer.startActiveSpan(
        `Cache ${cacheName} ${op}`,
        options,
        async (span) => {
          const result = await Reflect.apply(target, thisArg, argArray);
          if (op === "match") {
            span.setAttribute("cache.hit", !!result);
          }
          span.end();
          return result;
        },
      );
    },
  };
  return wrap(fn, handler);
}

function instrumentCache(cache: Cache, cacheName: string): Cache {
  const handler: ProxyHandler<typeof cache> = {
    get(target, prop) {
      if (prop === "delete" || prop === "match" || prop === "put") {
        const fn = Reflect.get(target, prop).bind(target);
        return instrumentFunction(fn, cacheName, prop);
      } else {
        return Reflect.get(target, prop);
      }
    },
  };
  return wrap(cache, handler);
}

function instrumentOpen(openFn: CacheStorage["open"]): CacheStorage["open"] {
  const handler: ProxyHandler<typeof openFn> = {
    async apply(target, thisArg, argArray) {
      const cacheName = argArray[0];
      const cache = await Reflect.apply(target, thisArg, argArray);
      return instrumentCache(cache, cacheName);
    },
  };
  return wrap(openFn, handler);
}

function _instrumentGlobalCache() {
  const handler: ProxyHandler<typeof caches> = {
    get(target, prop) {
      if (prop === "default") {
        const cache = (target as unknown as { default: Cache }).default;
        return instrumentCache(cache, "default");
      } else if (prop === "open") {
        const openFn = Reflect.get(target, prop).bind(target);
        return instrumentOpen(openFn);
      } else {
        return Reflect.get(target, prop);
      }
    },
  };
  globalThis.caches = wrap(caches, handler);
}

export function instrumentGlobalCache() {
  return _instrumentGlobalCache();
}
