import type { MiddlewareHandler } from "hono";
import { getServerClient } from "@deco/sdk/storage";
import { AppEnv, getEnv } from "../utils/context.ts";
import Cloudflare from "cloudflare";
import { AuthorizationClient, PolicyClient } from "../auth/policy.ts";

export const withContextMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    CF_API_TOKEN,
  } = getEnv(ctx);

  const db = getServerClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN);
  ctx.set(
    "db",
    getServerClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN),
  );

  ctx.set(
    "cf",
    new Cloudflare({ apiToken: CF_API_TOKEN }),
  );

  const policyClient = PolicyClient.getInstance();
  policyClient.init(db);
  ctx.set("policy", policyClient);

  const authorizationClient = new AuthorizationClient(policyClient);
  ctx.set("authorization", authorizationClient);

  await next();
};
