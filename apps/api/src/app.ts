import { Hosts } from "@deco/sdk/hosts";
import { Hono } from "hono";
import { timing } from "hono/timing";
import api from "./api.ts";
import apps from "./apps.ts";
import type { AppEnv } from "./utils/context.ts";

export const APPS_DOMAIN_QS = "app_host";

export const appsDomainOf = (req: Request, url?: URL) => {
  url ??= new URL(req.url);
  const referer = req.headers.get("referer");

  return (
    url.searchParams.get(APPS_DOMAIN_QS) ||
    (referer && new URL(referer).searchParams.get(APPS_DOMAIN_QS))
  );
};

const normalizeHost = (req: Request) => {
  const host =
    req.headers.get("host") ?? new URL(req.url).hostname ?? "localhost";

  const appsHost = appsDomainOf(req);
  if (appsHost) {
    return Hosts.APPS;
  }
  return (
    {
      [Hosts.API]: Hosts.API,
      localhost: Hosts.API,
      "localhost:3001": Hosts.API,
      "localhost:8000": Hosts.API,
    }[host] ?? Hosts.APPS
  );
};

export const app = new Hono<AppEnv>({
  getPath: (req) =>
    "/" +
    normalizeHost(req) +
    req.url.replace(/^https?:\/\/[^/]+(\/[^?]*)(?:\?.*)?$/, "$1"),
});

app.use(timing({ crossOrigin: true, total: true }));

app.route(`/${Hosts.API}`, api);
app.route(`/${Hosts.APPS}`, apps);
export default app;
