import { createServerClient } from "@supabase/ssr";
import { JwtIssuer } from "./jwt.ts";

const Hosts = {
  API: "api.deco.chat",
  APPS: "deco.page",
} as const;

type Client = ReturnType<typeof createServerClient>;
let client: Client | undefined;
const getServerClient = (supabaseUrl: string, supabaseKey: string): Client => {
  client ??= createServerClient(supabaseUrl, supabaseKey, {
    cookies: { getAll: () => [] },
  });

  return client;
};

interface Env {
  DECO_CHAT_APP_ORIGIN: string;
  DECO_CHAT_API_JWT_PUBLIC_KEY: string;
  DECO_CHAT_API_JWT_PRIVATE_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_SERVER_TOKEN: string;
  DECO_CHAT_API: Service;
}

const wellKnownHosts = Object.values(Hosts) as string[];
const isWellKnownHost = (host: string): boolean => {
  return wellKnownHosts.includes(host) || host.endsWith(Hosts.APPS);
};

export default {
  fetch: async (req: Request, env: Env) => {
    try {
      const host = req.headers.get("host") ?? new URL(req.url).hostname;
      const fetcher = isWellKnownHost(host)
        ? (req: Request, opts?: RequestInit) =>
            env?.DECO_CHAT_API?.fetch(req, opts) ?? fetch(req, opts)
        : fetch;
      const isAuthorized = typeof req.headers.get("Authorization") === "string";
      if (host !== Hosts.API || isAuthorized) {
        // just forward the request to the target url
        return fetcher(req);
      }

      // otherwise, we need to authenticate the request
      const { DECO_CHAT_APP_ORIGIN, SUPABASE_URL, SUPABASE_SERVER_TOKEN } = env;

      if (!DECO_CHAT_APP_ORIGIN || !SUPABASE_URL || !SUPABASE_SERVER_TOKEN) {
        return new Response("Missing environment variables", { status: 500 });
      }

      const db = getServerClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN);
      const { data, error } = await db
        .from("deco_chat_hosting_apps")
        .select("*")
        .eq("slug", DECO_CHAT_APP_ORIGIN)
        .maybeSingle();

      if (error) {
        return new Response("Error querying script", { status: 500 });
      }

      if (!data) {
        return new Response("App not found", { status: 404 });
      }

      const issuer = await JwtIssuer.forKeyPair({
        public: env.DECO_CHAT_API_JWT_PUBLIC_KEY,
        private: env.DECO_CHAT_API_JWT_PRIVATE_KEY,
      }).catch(() => null);
      if (!issuer) {
        return fetcher(req);
      }
      const token = await issuer
        .issue({
          sub: `app:${DECO_CHAT_APP_ORIGIN}`,
          aud: data?.workspace,
        })
        .catch(() => null);

      if (!token) {
        return fetcher(req);
      }

      const reqHeaders = new Headers(req.headers);
      reqHeaders.set("Authorization", `Bearer ${token}`);

      return fetcher(
        new Request(req.url, {
          method: req.method,
          headers: reqHeaders,
          body: req.body,
          redirect: req.redirect,
        }),
      );
    } catch (err) {
      return new Response(
        `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
        { status: 500 },
      );
    }
  },
};
