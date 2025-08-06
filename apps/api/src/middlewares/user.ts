import type { MiddlewareHandler } from "hono";
import { endTime, startTime } from "hono/timing";
import { getUser } from "../auth/index.ts";
import type { AppEnv } from "../utils/context.ts";

export const setUserMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  startTime(ctx, "get-user");

  try {
    const user = await getUser(ctx);
    if (user) {
      ctx.set("user", user);
    }
  } catch (error) {
    // Log the auth error but don't fail the request
    console.warn("User authentication failed:", error);
    // Continue without setting user - routes can check if user exists
  }

  endTime(ctx, "get-user");

  await next();
};
