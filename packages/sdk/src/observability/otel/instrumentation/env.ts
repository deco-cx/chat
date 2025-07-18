import { isProxyable, wrap } from "../wrap.ts";
import { instrumentDOBinding } from "./do.ts";
import { instrumentServiceBinding } from "./service.ts";

const isJSRPC = (item?: unknown): item is Service => {
  // @ts-expect-error The point of RPC types is to block non-existent properties, but that's the goal here
  return !!(item as Service)?.[
    "__some_property_that_will_never_exist" + Math.random()
  ];
};

export const isVersionMetadata = (
  item?: unknown,
): item is WorkerVersionMetadata => {
  return (
    !isJSRPC(item) &&
    typeof (item as WorkerVersionMetadata)?.id === "string" &&
    typeof (item as WorkerVersionMetadata)?.tag === "string"
  );
};

const isDurableObject = (item?: unknown): item is DurableObjectNamespace => {
  return !isJSRPC(item) && !!(item as DurableObjectNamespace)?.idFromName;
};

const instrumentEnv = (
  env: Record<string, unknown>,
): Record<string, unknown> => {
  const envHandler: ProxyHandler<Record<string, unknown>> = {
    get: (target, prop, receiver) => {
      const item = Reflect.get(target, prop, receiver);
      if (!isProxyable(item)) {
        return item;
      }
      if (isJSRPC(item)) {
        return instrumentServiceBinding(item, String(prop));
      } else if (isDurableObject(item)) {
        return instrumentDOBinding(item, String(prop));
      } else if (isVersionMetadata(item)) {
        // we do not need to log accesses to the metadata
        return item;
      } else {
        return item;
      }
    },
  };
  return wrap(env, envHandler);
};

export { instrumentEnv };
