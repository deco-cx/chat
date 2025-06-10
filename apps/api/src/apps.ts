import { Hono } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { Entrypoint } from "@deco/sdk/mcp";
import { APPS_DOMAIN_QS, appsDomainOf } from "./app.ts";
import { AppEnv } from "./utils/context.ts";
export type DispatcherFetch = typeof fetch;
export const app = new Hono<AppEnv>();
app.all("/*", async (c) => {
  const host = appsDomainOf(c.req.raw) ?? c.req.header("host");
  if (!host) {
    return new Response("No host", { status: 400 });
  }
  const script = Entrypoint.script(host);
  let dispatcher: typeof c.env.PROD_DISPATCHER;
  if ("PROD_DISPATCHER" in c.env) {
    dispatcher = c.env.PROD_DISPATCHER;
  } else {
    dispatcher = {
      get: () => {
        return {
          fetch: (req, opts) => fetch(req, opts),
        };
      },
    };
  }
  const url = new URL(c.req.url);
  if (url.host !== host) {
    url.host = host;
    url.protocol = "https";
    url.port = `443`;
    url.searchParams.delete(APPS_DOMAIN_QS);
  }
  const scriptFetcher = dispatcher.get(script);
  const req = new Request(url, c.req.raw);
  const response = await scriptFetcher.fetch(req).catch((err) => {
    if ("message" in err && err.message.startsWith("Worker not found")) {
      // we tried to get a worker that doesn't exist in our dispatch namespace
      return new Response("worker not found", { status: 404 });
    }
    throw err;
  });

  if (getRuntimeKey() === "workerd") { // needs to be copied when resp is from an a external dispatcher.
    return new Response(response.body, response);
  }
  return response;
});
export default app;
