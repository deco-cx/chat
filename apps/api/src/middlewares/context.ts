import { getS3ServerClient, getServerClient } from "@deco/sdk/storage";
import Cloudflare from "cloudflare";
import type { MiddlewareHandler } from "hono";
import { honoCtxToAppCtx } from "../api.ts";
import { AppEnv, getEnv } from "../utils/context.ts";

export const withContextMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const {
    SUPABASE_URL,
    SUPABASE_SERVER_TOKEN,
    CF_API_TOKEN,
    CF_ACCOUNT_ID,
    CF_R2_ACCESS_KEY_ID,
    CF_R2_SECRET_ACCESS_KEY,
  } = getEnv(honoCtxToAppCtx(ctx));

  ctx.set(
    "db",
    getServerClient(SUPABASE_URL, SUPABASE_SERVER_TOKEN),
  );

  ctx.set(
    "cf",
    new Cloudflare({ apiToken: CF_API_TOKEN }),
  );

  ctx.set(
    "s3",
    getS3ServerClient({
      accountId: CF_ACCOUNT_ID,
      accessKeyId: String(CF_R2_ACCESS_KEY_ID),
      secretAccessKey: String(CF_R2_SECRET_ACCESS_KEY),
    }),
  );

  await next();
};
