// deno-lint-ignore-file no-explicit-any ban-types
import {
  type Attributes,
  SpanKind,
  type SpanOptions,
  trace,
} from "@opentelemetry/api";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";
import { wrap } from "../wrap.ts";
import type { Overloads } from "./common.ts";

type ExtraAttributeFn = (argArray: any[], result: any) => Attributes;

const dbSystem = "Cloudflare DO";

type DurableObjectCommonOptions = Pick<
  DurableObjectPutOptions,
  "allowConcurrency" | "allowUnconfirmed" | "noCache"
>;
function isDurableObjectCommonOptions(
  options: any,
): options is DurableObjectCommonOptions {
  return (
    typeof options === "object" &&
    ("allowConcurrency" in options || "allowUnconfirmed" in options ||
      "noCache" in options)
  );
}

/** Applies attributes for common Durable Objects options:
 * `allowConcurrency`, `allowUnconfirmed`, and `noCache`
 */
function applyOptionsAttributes(
  attrs: Attributes,
  options: DurableObjectCommonOptions,
) {
  if ("allowConcurrency" in options) {
    attrs["db.cf.do.allow_concurrency"] = options.allowConcurrency;
  }
  if ("allowUnconfirmed" in options) {
    attrs["db.cf.do.allow_unconfirmed"] = options.allowUnconfirmed;
  }
  if ("noCache" in options) {
    attrs["db.cf.do.no_cache"] = options.noCache;
  }
}

const StorageAttributes: Record<string | symbol, ExtraAttributeFn> = {
  delete(
    argArray,
    result: Awaited<ReturnType<Overloads<DurableObjectStorage["delete"]>>>,
  ) {
    const args = argArray as Parameters<
      Overloads<DurableObjectStorage["delete"]>
    >;
    let attrs: Attributes = {};
    if (Array.isArray(args[0])) {
      const keys = args[0];
      attrs = {
        // todo: Maybe set db.cf.do.keys to the whole array here?
        "db.cf.do.key": keys[0],
        "db.cf.do.number_of_keys": keys.length,
        "db.cf.do.keys_deleted": result,
      };
    } else {
      attrs = {
        "db.cf.do.key": args[0],
        "db.cf.do.success": result,
      };
    }
    if (args[1]) {
      applyOptionsAttributes(attrs, args[1]);
    }
    return attrs;
  },
  deleteAll(argArray) {
    const args = argArray as Parameters<
      Overloads<DurableObjectStorage["deleteAll"]>
    >;
    const attrs: Attributes = {};
    if (args[0]) {
      applyOptionsAttributes(attrs, args[0]);
    }
    return attrs;
  },
  get(argArray) {
    const args = argArray as Parameters<Overloads<DurableObjectStorage["get"]>>;
    let attrs: Attributes = {};
    if (Array.isArray(args[0])) {
      const keys = args[0];
      attrs = {
        // todo: Maybe set db.cf.do.keys to the whole array here?
        "db.cf.do.key": keys[0],
        "db.cf.do.number_of_keys": keys.length,
      };
    } else {
      attrs = {
        "db.cf.do.key": args[0],
      };
    }
    if (args[1]) {
      applyOptionsAttributes(attrs, args[1]);
    }
    return attrs;
  },
  list(
    argArray,
    result: Awaited<ReturnType<Overloads<DurableObjectStorage["list"]>>>,
  ) {
    const args = argArray as Parameters<
      Overloads<DurableObjectStorage["list"]>
    >;
    const attrs: Attributes = {
      "db.cf.do.number_of_results": result.size,
    };
    if (args[0]) {
      const options = args[0];
      applyOptionsAttributes(attrs, options);
      if ("start" in options) {
        attrs["db.cf.do.start"] = options.start;
      }
      if ("startAfter" in options) {
        attrs["db.cf.do.start_after"] = options.startAfter;
      }
      if ("end" in options) {
        attrs["db.cf.do.end"] = options.end;
      }
      if ("prefix" in options) {
        attrs["db.cf.do.prefix"] = options.prefix;
      }
      if ("reverse" in options) {
        attrs["db.cf.do.reverse"] = options.reverse;
      }
      if ("limit" in options) {
        attrs["db.cf.do.limit"] = options.limit;
      }
    }
    return attrs;
  },
  put(argArray) {
    const args = argArray as Parameters<Overloads<DurableObjectStorage["put"]>>;
    const attrs: Attributes = {};
    if (typeof args[0] === "string") {
      attrs["db.cf.do.key"] = args[0];
      if (args[2]) {
        applyOptionsAttributes(attrs, args[2]);
      }
    } else {
      const keys = Object.keys(args[0]);
      // todo: Maybe set db.cf.do.keys to the whole array here?
      attrs["db.cf.do.key"] = keys[0];
      attrs["db.cf.do.number_of_keys"] = keys.length;
      if (isDurableObjectCommonOptions(args[1])) {
        applyOptionsAttributes(attrs, args[1]);
      }
    }
    return attrs;
  },
  getAlarm(argArray) {
    const args = argArray as Parameters<
      Overloads<DurableObjectStorage["getAlarm"]>
    >;
    const attrs: Attributes = {};
    if (args[0]) {
      applyOptionsAttributes(attrs, args[0]);
    }
    return attrs;
  },
  setAlarm(argArray) {
    const args = argArray as Parameters<
      Overloads<DurableObjectStorage["setAlarm"]>
    >;
    const attrs: Attributes = {};
    if (args[0] instanceof Date) {
      attrs["db.cf.do.alarm_time"] = args[0].getTime();
    } else {
      attrs["db.cf.do.alarm_time"] = args[0];
    }
    if (args[1]) {
      applyOptionsAttributes(attrs, args[1]);
    }
    return attrs;
  },
  deleteAlarm(argArray) {
    const args = argArray as Parameters<
      Overloads<DurableObjectStorage["deleteAlarm"]>
    >;
    const attrs: Attributes = {};
    if (args[0]) {
      applyOptionsAttributes(attrs, args[0]);
    }
    return attrs;
  },
};

function instrumentStorageFn(fn: Function, operation: string) {
  const tracer = trace.getTracer("do_storage");
  const fnHandler: ProxyHandler<any> = {
    apply: (target, thisArg, argArray) => {
      const attributes = {
        [SemanticAttributes.DB_SYSTEM]: dbSystem,
        [SemanticAttributes.DB_OPERATION]: operation,
        [SemanticAttributes.DB_STATEMENT]: `${operation} ${argArray[0]}`,
      };
      const options: SpanOptions = {
        kind: SpanKind.CLIENT,
        attributes: {
          ...attributes,
          operation,
        },
      };
      return tracer.startActiveSpan(
        `Durable Object Storage ${operation}`,
        options,
        async (span) => {
          const result = await Reflect.apply(target, thisArg, argArray);
          const extraAttrsFn = StorageAttributes[operation];
          const extraAttrs = extraAttrsFn ? extraAttrsFn(argArray, result) : {};
          span.setAttributes(extraAttrs);
          span.setAttribute("db.cf.do.has_result", !!result);
          span.end();
          return result;
        },
      );
    },
  };
  return wrap(fn, fnHandler);
}

export function instrumentStorage(
  storage: DurableObjectStorage,
): DurableObjectStorage {
  const storageHandler: ProxyHandler<DurableObjectStorage> = {
    get: (target, prop, receiver) => {
      const operation = String(prop);
      const fn = Reflect.get(target, prop, receiver);
      return instrumentStorageFn(fn, operation);
    },
  };
  return wrap(storage, storageHandler);
}
