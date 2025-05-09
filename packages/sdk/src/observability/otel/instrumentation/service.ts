import { passthroughGet, wrap } from "../wrap.ts";
import { instrumentClientFetch } from "./fetch.ts";

export function instrumentServiceBinding(
  fetcher: Fetcher,
  envName: string,
): Fetcher {
  const fetcherHandler: ProxyHandler<Fetcher> = {
    get(target, prop) {
      if (prop === "fetch") {
        const fetcher = Reflect.get(target, prop);
        const attrs = {
          name: `Service Binding ${envName}`,
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
  return wrap(fetcher, fetcherHandler);
}
