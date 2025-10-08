import { getServerClient } from "@deco/sdk/storage";
import Cloudflare from "cloudflare";
import type { MiddlewareHandler } from "hono";
import { type AppEnv, createResourceAccess } from "../utils/context.ts";

export const withContextMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const { SUPABASE_URL, SUPABASE_SERVER_TOKEN, CF_API_TOKEN } = ctx.env;

  ctx.set("db", getServerClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN));

  ctx.set("cf", new Cloudflare({ apiToken: CF_API_TOKEN }));

  ctx.set("resourceAccess", createResourceAccess());
  await next();
};
