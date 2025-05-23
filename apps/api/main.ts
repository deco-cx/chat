// deno-lint-ignore-file no-explicit-any
export * from "./src/actors.ts";
import { contextStorage } from "@deco/sdk/fetch";
import { Hosts } from "@deco/sdk/hosts";
import { instrument } from "@deco/sdk/observability";
import { getRuntimeKey } from "hono/adapter";
import { default as app } from "./src/app.ts";

// Choose instrumented app depending on runtime
const instrumentedApp = getRuntimeKey() === "deno" ? app : instrument(app);

// Domains we consider "self"
const SELF_DOMAINS: string[] = [
  Hosts.API,
  `localhost:${Deno.env.get("PORT") || 3001}`,
];

// Patch fetch globally
const originalFetch = globalThis.fetch;

/**
 * Author @mcandeia
 * Workaround for Cloudflare Workers:
 * Cloudflare does not allow self-invocation (calling the same worker from itself),
 * which results in a 522 status code. This patch intercepts fetch requests to self
 * domains and delegates them to the internal handler directly, bypassing the network.
 * This ensures internal requests work as expected in both Deno and Cloudflare environments.
 */
// @ts-ignore: mixed cloudflare and deno types
globalThis.fetch = async function patchedFetch(
  resource: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  let req: Request;
  if (typeof resource === "string") {
    req = new Request(resource, init);
  } else if (resource instanceof Request) {
    req = resource;
  } else if (resource instanceof URL) {
    req = new Request(resource.toString(), init);
  } else {
    throw new Error("Unsupported resource type for fetch");
  }

  const url = new URL(req.url);

  const context = contextStorage.getStore();

  if (SELF_DOMAINS.includes(url.host)) {
    if (!context) {
      throw new Error("Missing context for internal self-invocation");
    }
    // Delegate to internal handler
    return await instrumentedApp.fetch!(
      req as Request<unknown, IncomingRequestCfProperties<unknown>>,
      context.env,
      context.ctx,
    );
  }

  return await originalFetch(req);
};

// Default export that wraps app with per-request context initializer
export default {
  fetch(
    request: Request,
    env: any,
    ctx: ExecutionContext,
  ): Promise<Response> {
    return contextStorage.run({ env, ctx }, async () => {
      return await instrumentedApp.fetch!(
        request as Request<unknown, IncomingRequestCfProperties<unknown>>,
        env,
        ctx,
      );
    });
  },
};
