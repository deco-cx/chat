const HTTP_VERBS: Set<"GET" | "PUT" | "POST" | "DELETE" | "PATCH" | "HEAD"> =
  new Set(["GET", "PUT", "POST", "DELETE", "PATCH", "HEAD"] as const);

export interface TypedRequestInit<T> extends Omit<RequestInit, "body"> {
  body: T;
}
export interface TypedResponse<T> extends Response {
  json: () => Promise<T>;
}
type HttpVerb = typeof HTTP_VERBS extends Set<infer Verb> ? Verb : never;
type URLPatternParam = string | number;
type URLPatternParams<URL extends string> =
  URL extends `/:${infer param}/${infer rest}`
    ? {
        [key in param]: URLPatternParam;
      } & URLPatternParams<`/${rest}`>
    : URL extends `/:${infer param}?`
      ? {
          [key in param]?: URLPatternParam;
        }
      : URL extends `/:${infer param}`
        ? {
            [key in param]: URLPatternParam;
          }
        : URL extends `/*?`
          ? {
              "*"?: URLPatternParam | URLPatternParam[];
            }
          : URL extends `/*`
            ? {
                "*": URLPatternParam | URLPatternParam[];
              }
            : URL extends `/*${infer param}?`
              ? {
                  [key in param]: URLPatternParam | URLPatternParam[];
                }
              : URL extends `/*${infer param}`
                ? {
                    [key in param]: URLPatternParam | URLPatternParam[];
                  }
                : URL extends `/${string}/${infer rest}`
                  ? URLPatternParams<`/${rest}`>
                  : // deno-lint-ignore ban-types
                    {};
export type ClientOf<T> = {
  [key in keyof T &
    `${HttpVerb} /${string}`]: key extends `${HttpVerb} /${infer path}`
    ? T[key] extends {
        response?: infer ResBody;
        body: infer ReqBody;
        searchParams?: infer Params;
      }
      ? (
          params: URLPatternParams<`/${path}`> & Params,
          init: TypedRequestInit<ReqBody>,
        ) => Promise<TypedResponse<ResBody>>
      : T[key] extends {
            response?: infer ResBody;
            searchParams?: infer Params;
          }
        ? (
            params: URLPatternParams<`/${path}`> & Params,
            init?: Omit<RequestInit, "body">,
          ) => Promise<TypedResponse<ResBody>>
        : never
    : never;
};
export interface HttpClientOptions {
  base: string;
  headers?: Headers;
  processHeaders?: (headers?: Headers) => Headers | undefined;
  fetcher?: typeof fetch;
  // Keep empty segments in the URL
  keepEmptySegments?: boolean;
}
export const createHttpClient = <T>({
  base: maybeBase,
  headers: defaultHeaders,
  processHeaders = (headers?: Headers) => headers,
  fetcher = fetch,
  keepEmptySegments,
}: HttpClientOptions): ClientOf<T> => {
  // Base should always endwith / so when concatenating with path we get the right URL
  const base = maybeBase.at(-1) === "/" ? maybeBase : `${maybeBase}/`;
  return new Proxy({} as ClientOf<T>, {
    get: (_target, prop) => {
      if (prop === Symbol.toStringTag || prop === Symbol.toPrimitive) {
        return `HttpClient: ${base}`;
      }
      if (typeof prop !== "string") {
        throw new TypeError(`HttpClient: Uknown path ${typeof prop}`);
      }
      const [method, path] = prop.split(" ");
      // @ts-expect-error if not inside, throws
      if (!HTTP_VERBS.has(method)) {
        throw new TypeError(`HttpClient: Verb ${method} is not allowed`);
      }
      return (
        params: Record<string, string | number | string[] | number[]>,
        init?: RequestInit,
      ) => {
        const mapped = new Map(Object.entries(params));
        const compiled = path
          .split("/")
          .flatMap((segment) => {
            const isTemplate = segment.at(0) === ":" || segment.at(0) === "*";
            const isRequred = segment.at(-1) !== "?";
            if (!isTemplate) {
              return segment;
            }
            const name = segment.slice(1, !isRequred ? -1 : undefined);
            const param = mapped.get(name);
            mapped.delete(name);
            if (param === undefined && isRequred) {
              throw new TypeError(`HttpClient: Missing ${name} at ${path}`);
            }
            return param;
          })
          .filter((x) =>
            typeof x === "string"
              ? keepEmptySegments || x.length
              : typeof x === "number",
          )
          .join("/");
        const url = new URL(compiled, base);
        mapped.forEach((value, key) => {
          if (value === undefined) {
            return;
          }
          const arrayed = Array.isArray(value) ? value : [value];
          arrayed.forEach((item) => url.searchParams.append(key, `${item}`));
        });
        const isJSON =
          init?.body != null &&
          typeof init.body !== "string" &&
          !(init.body instanceof ReadableStream) &&
          !(init.body instanceof FormData) &&
          !(init.body instanceof URLSearchParams) &&
          !(init.body instanceof Blob) &&
          !(init.body instanceof ArrayBuffer);
        const headers = new Headers(init?.headers);
        defaultHeaders?.forEach((value, key) => headers.set(key, value));
        isJSON && headers.set("content-type", "application/json");
        const body = isJSON ? JSON.stringify(init.body) : init?.body;
        return fetcher(url.href, {
          ...init,
          headers: processHeaders(headers),
          method,
          body,
        });
      };
    },
  });
};
// deno-lint-ignore no-explicit-any
export const nullOnNotFound = (error: any) => {
  if (error.status === 404) {
    return null;
  }
  throw error;
};
