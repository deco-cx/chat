import { SWRCache } from "@deco/sdk/cache/swr";
import { Entrypoint, HOSTING_APPS_DOMAIN } from "@deco/sdk/mcp";
import { type Context, Hono } from "hono";
import { APPS_DOMAIN_QS, appsDomainOf } from "./app.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import type { AppEnv } from "./utils/context.ts";

const ONE_HOUR_SECONDS = 60 * 60;
const domainSWRCache = new SWRCache<string>("domain-swr", ONE_HOUR_SECONDS);
export type DispatcherFetch = typeof fetch;
export const app = new Hono<AppEnv>();

export const fetchScript = async (
  c: Context<AppEnv>,
  script: string,
  req: Request,
) => {
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
  const scriptFetcher = dispatcher.get<{
    DECO_CHAT_APP_ORIGIN: string;
  }>(
    script,
    {},
    {
      outbound: {
        DECO_CHAT_APP_ORIGIN: script,
      },
    },
  );
  const response = await scriptFetcher.fetch(req).catch((err) => {
    if ("message" in err && err.message.startsWith("Worker not found")) {
      // we tried to get a worker that doesn't exist in our dispatch namespace
      return new Response("worker not found", { status: 404 });
    }
    throw err;
  });

  return new Response(response.body, response);
};

app.use(withContextMiddleware);
app.all("/*", async (c: Context<AppEnv>) => {
  const url = new URL(c.req.url);
  let host = appsDomainOf(c.req.raw) ?? c.req.header("host") ?? url.host;
  if (!host) {
    return new Response("No host", { status: 400 });
  }
  let script = Entrypoint.script(host);
  if (!script) {
    script = await domainSWRCache
      .cache(
        async () => {
          const { data, error } = await c.var.db
            .from("deco_chat_hosting_routes")
            .select("*, deco_chat_hosting_apps(slug)")
            .eq("route_pattern", host)
            .maybeSingle();
          if (error) {
            throw error;
          }
          const slug = data?.deco_chat_hosting_apps?.slug;
          if (!slug) {
            throw new Error("No slug found");
          }
          return slug;
        },
        host,
        false,
      )
      .catch(() => null);
    host = `${script}${HOSTING_APPS_DOMAIN}`;
  }
  if (!script) {
    return new Response("Not found", { status: 404 });
  }
  if (url.host !== host) {
    url.host = host;
    url.protocol = "https";
    url.port = `443`;
    url.searchParams.delete(APPS_DOMAIN_QS);
  }
  const req = new Request(url, c.req.raw);

  return await fetchScript(c, script, req);
});
export default app;
