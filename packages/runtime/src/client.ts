export type MCPClient<T> = {
  // deno-lint-ignore no-explicit-any
  [K in keyof T]: T[K] extends (...args: any) => any
    ? (
        args: Parameters<T[K]>[0],
        init?: CustomInit,
      ) => Promise<Awaited<ReturnType<T[K]>>>
    : never;
};

export type CustomInit = RequestInit & {
  handleResponse?: (response: Response) => Promise<unknown>;
};

export const createClient = <T>(init?: CustomInit): MCPClient<T> => {
  return new Proxy(
    {},
    {
      get: (_, prop) => {
        return async (args: unknown, innerInit?: CustomInit) => {
          const mergedInit = {
            ...init,
            ...innerInit,
          };

          const response = await fetch(`/mcp/call-tool/${String(prop)}`, {
            method: "POST",
            body: JSON.stringify(args),
            credentials: "include",
            ...mergedInit,
          });

          return mergedInit.handleResponse?.(response) ?? response.json();
        };
      },
    },
  ) as MCPClient<T>;
};
