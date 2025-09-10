import { RuntimeClass } from "@deco/actors";
import { withActors } from "@deco/actors/hono";
import { Hosts } from "@deco/sdk/hosts";
import type { Handler } from "hono";
import { endTime, startTime } from "hono/timing";
import type { AppEnv } from "../utils/context.ts";

export const runtime = new RuntimeClass();

// Create actors routes for both API hosts
const actorsRoutePathLegacy = `/${Hosts.API_LEGACY}/actors`;
const actorsRoutePath = `/${Hosts.API}/actors`;

const actorsRouteLegacy = withActors(runtime, actorsRoutePathLegacy);
const actorsRoute = withActors(runtime, actorsRoutePath);

export const withActorsMiddleware: Handler<AppEnv> = async (ctx, next) => {
  const actorsMiddleware = ctx.req.path.startsWith(`/${Hosts.API_LEGACY}`)
    ? actorsRouteLegacy
    : actorsRoute;
  startTime(ctx, "actor");
  return await actorsMiddleware(
    // deno-lint-ignore no-explicit-any
    ctx as any,
    next,
  ).finally(() => endTime(ctx, "actor"));
};
