import type { ActorConstructor, StubFactory } from "@deco/actors";
import { ActorCfRuntime } from "@deco/actors/cf";
import { actors } from "@deco/actors/stub";
import type { AIAgent, Trigger } from "@deco/ai/actors";
import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../utils/context.ts";
import { runtime } from "./actors.ts";

export const withActorsStubMiddleware: MiddlewareHandler<AppEnv> = async (
  ctx,
  next,
) => {
  const stub: <
    Constructor extends ActorConstructor<Trigger> | ActorConstructor<AIAgent>,
  >(
    c: Constructor,
  ) => StubFactory<InstanceType<Constructor>> = (c) => {
    return runtime instanceof ActorCfRuntime
      ? // deno-lint-ignore no-explicit-any
        runtime.stub(c, ctx.env as any)
      : actors.stub(c.name);
  };

  ctx.set("stub", stub);
  await next();
};
