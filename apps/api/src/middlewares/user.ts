import type { MiddlewareHandler } from "hono";
import { endTime, startTime } from "hono/timing";
import { getUser } from "../auth/index.ts";
import type { AppEnv } from "../utils/context.ts";

export const setUserMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  startTime(ctx, "get-user");

  const user = await getUser(ctx);
  if (!user) {
    console.log(ctx.req.url);
  }

  if (user) {
    ctx.set("user", user);
  }

  endTime(ctx, "get-user");

  await next();
};
