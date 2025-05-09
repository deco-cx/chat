// deno-lint-ignore-file no-explicit-any
import {
  context as api_context,
  type Exception,
  SpanKind,
  type SpanOptions,
  SpanStatusCode,
  trace,
} from "@opentelemetry/api";
import { SemanticAttributes } from "@opentelemetry/semantic-conventions";
import { type Initialiser, setConfig } from "../config.ts";
import type { DOConstructorTrigger } from "../types.ts";
import { passthroughGet, unwrap, wrap } from "../wrap.ts";
import { exportSpans } from "./common.ts";
import { instrumentEnv } from "./env.ts";
import {
  gatherIncomingCfAttributes,
  gatherRequestAttributes,
  gatherResponseAttributes,
  getParentContextFromHeaders,
  instrumentClientFetch,
} from "./fetch.ts";

type FetchFn = DurableObject["fetch"];
type AlarmFn = DurableObject["alarm"];
type Env = Record<string, unknown>;

function instrumentBindingStub(
  stub: DurableObjectStub,
  nsName: string,
): DurableObjectStub {
  const stubHandler: ProxyHandler<typeof stub> = {
    get(target, prop) {
      if (prop === "fetch") {
        const fetcher = Reflect.get(target, prop);
        const attrs = {
          name: `Durable Object ${nsName}`,
          "do.namespace": nsName,
          "do.id": target.id.toString(),
          "do.id.name": target.id.name,
        };
        return instrumentClientFetch(
          fetcher,
          () => ({ includeTraceContext: true }),
          attrs,
        );
      } else {
        return passthroughGet(target, prop);
      }
    },
  };
  return wrap(stub, stubHandler);
}

function instrumentBindingGet(
  getFn: DurableObjectNamespace["get"],
  nsName: string,
): DurableObjectNamespace["get"] {
  const getHandler: ProxyHandler<DurableObjectNamespace["get"]> = {
    apply(target, thisArg, argArray) {
      const stub: DurableObjectStub = Reflect.apply(target, thisArg, argArray);
      return instrumentBindingStub(stub, nsName);
    },
  };
  return wrap(getFn, getHandler);
}

export function instrumentDOBinding(
  ns: DurableObjectNamespace,
  nsName: string,
) {
  const nsHandler: ProxyHandler<typeof ns> = {
    get(target, prop) {
      if (prop === "get") {
        const fn = Reflect.get(ns, prop);
        return instrumentBindingGet(fn, nsName);
      } else {
        return passthroughGet(target, prop);
      }
    },
  };
  return wrap(ns, nsHandler);
}

export function instrumentState(state: DurableObjectState) {
  const stateHandler: ProxyHandler<DurableObjectState> = {
    get(target, prop, receiver) {
      const result = Reflect.get(target, prop, unwrap(receiver));
      if (typeof result === "function") {
        return result.bind(target);
      } else {
        return result;
      }
    },
  };
  return wrap(state, stateHandler);
}

let cold_start = true;
export type DOClass = {
  new (state: DurableObjectState, env: any): DurableObject;
};
export function executeDOFetch(
  fetchFn: FetchFn,
  request: Request,
  id: DurableObjectId,
): Promise<Response> {
  const spanContext = getParentContextFromHeaders(request.headers);

  const tracer = trace.getTracer("DO fetchHandler");
  const attributes = {
    [SemanticAttributes.FAAS_TRIGGER]: "http",
    [SemanticAttributes.FAAS_COLDSTART]: cold_start,
  };
  cold_start = false;
  Object.assign(attributes, gatherRequestAttributes(request));
  Object.assign(attributes, gatherIncomingCfAttributes(request));
  const options: SpanOptions = {
    attributes,
    kind: SpanKind.SERVER,
  };

  const name = id.name || "";
  const promise = tracer.startActiveSpan(
    `Durable Object Fetch ${name}`,
    options,
    spanContext,
    async (span) => {
      try {
        const response: Response = await fetchFn(request);
        if (response.ok) {
          span.setStatus({ code: SpanStatusCode.OK });
        }
        span.setAttributes(gatherResponseAttributes(response));
        span.end();

        return response;
      } catch (error) {
        span.recordException(error as Exception);
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw error;
      }
    },
  );
  return promise;
}

export function executeDOAlarm(
  alarmFn: NonNullable<AlarmFn>,
  id: DurableObjectId,
): Promise<void> {
  const tracer = trace.getTracer("DO alarmHandler");

  const name = id.name || "";
  const promise = tracer.startActiveSpan(
    `Durable Object Alarm ${name}`,
    async (span) => {
      span.setAttribute(SemanticAttributes.FAAS_COLDSTART, cold_start);
      cold_start = false;
      span.setAttribute("do.id", id.toString());
      if (id.name) span.setAttribute("do.name", id.name);

      try {
        await alarmFn();
        span.end();
      } catch (error) {
        span.recordException(error as Exception);
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw error;
      }
    },
  );
  return promise;
}

function instrumentFetchFn(
  fetchFn: FetchFn,
  initialiser: Initialiser,
  env: Env,
  id: DurableObjectId,
): FetchFn {
  const fetchHandler: ProxyHandler<FetchFn> = {
    async apply(target, thisArg, argArray: Parameters<FetchFn>) {
      const request = argArray[0];
      const config = initialiser(env, request);
      const context = setConfig(config);
      try {
        const bound = target.bind(unwrap(thisArg));
        return await api_context.with(
          context,
          executeDOFetch,
          undefined,
          bound,
          request,
          id,
        );
      } catch (error) {
        throw error;
      } finally {
        exportSpans();
      }
    },
  };
  return wrap(fetchFn, fetchHandler);
}

function instrumentAlarmFn(
  alarmFn: AlarmFn,
  initialiser: Initialiser,
  env: Env,
  id: DurableObjectId,
) {
  if (!alarmFn) return undefined;

  const alarmHandler: ProxyHandler<NonNullable<AlarmFn>> = {
    async apply(target, thisArg) {
      const config = initialiser(env, "do-alarm");
      const context = setConfig(config);
      try {
        const bound = target.bind(unwrap(thisArg));
        return await api_context.with(
          context,
          executeDOAlarm,
          undefined,
          bound,
          id,
        );
      } catch (error) {
        throw error;
      } finally {
        exportSpans();
      }
    },
  };
  return wrap(alarmFn, alarmHandler);
}

function instrumentDurableObject(
  doObj: DurableObject,
  initialiser: Initialiser,
  env: Env,
  state: DurableObjectState,
) {
  const objHandler: ProxyHandler<DurableObject> = {
    get(target, prop) {
      if (prop === "fetch") {
        const fetchFn = Reflect.get(target, prop);
        return instrumentFetchFn(fetchFn, initialiser, env, state.id);
      } else if (prop === "alarm") {
        const alarmFn = Reflect.get(target, prop);
        return instrumentAlarmFn(alarmFn, initialiser, env, state.id);
      } else {
        const result = Reflect.get(target, prop);
        if (typeof result === "function") {
          result.bind(doObj);
        }
        return result;
      }
    },
  };
  return wrap(doObj, objHandler);
}

export function instrumentDOClass(
  doClass: DOClass,
  initialiser: Initialiser,
): DOClass {
  const classHandler: ProxyHandler<DOClass> = {
    construct(target, [orig_state, orig_env]: ConstructorParameters<DOClass>) {
      const trigger: DOConstructorTrigger = {
        id: orig_state.id.toString(),
        name: orig_state.id.name,
      };
      const constructorConfig = initialiser(orig_env, trigger);
      const context = setConfig(constructorConfig);
      const state = instrumentState(orig_state);
      const env = instrumentEnv(orig_env);
      const createDO = () => {
        return new target(state, env);
      };
      const doObj = api_context.with(context, createDO);

      return instrumentDurableObject(doObj, initialiser, env, state);
    },
  };
  return wrap(doClass, classHandler);
}
