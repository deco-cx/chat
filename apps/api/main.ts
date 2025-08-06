// deno-lint-ignore-file no-explicit-any
export * from "./src/actors.ts";
import { contextStorage } from "@deco/sdk/fetch";
import { Hosts } from "@deco/sdk/hosts";
// import { instrument } from "@deco/sdk/observability";
// import { getRuntimeKey } from "hono/adapter";
import { default as app } from "./src/app.ts";
import { email } from "./src/email.ts";
import { KbFileProcessorWorkflow } from "./src/workflows/kb-file-processor-workflow.ts";
import { env } from "cloudflare:workers";
export { WorkspaceDatabase } from "./src/durable-objects/workspace-database.ts";
import * as Sentry from "@sentry/cloudflare";

// Choose instrumented app depending on runtime
// const instrumentedApp = getRuntimeKey() === "deno" ? app : instrument(app);


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
// globalThis.fetch = async function patchedFetch(
//   resource: RequestInfo | URL,
//   init?: RequestInit,
// ): Promise<Response> {
//   let req: Request;
//   if (typeof resource === "string") {
//     req = new Request(resource, init);
//   } else if (resource instanceof Request) {
//     req = resource;
//   } else if (resource instanceof URL) {
//     req = new Request(resource.toString(), init);
//   } else {
//     throw new Error("Unsupported resource type for fetch");
//   }

//   const url = new URL(req.url);

//   const context = contextStorage.getStore();

//   if (SELF_DOMAINS.some((domain) => url.host.endsWith(domain))) {
//     if (!context) {
//       throw new Error("Missing context for internal self-invocation");
//     }
//     // Delegate to internal handler
//     return await app.fetch(
//       req as Request<unknown, IncomingRequestCfProperties<unknown>>,
//       context.env,
//       context.ctx,
//     );
//   }

//   return await originalFetch(req);
// };

// Domains we consider "self"
const SELF_DOMAINS: string[] = [
  Hosts.API,
  // @ts-expect-error env is not typed
  ...(env.VITE_USE_LOCAL_BACKEND ? [] : [Hosts.APPS]),
  // @ts-expect-error env is not typed
  `localhost:${env.PORT || 8000}`,
];

//@ts-ignore
console.log("Original fetch before export default", originalFetch.__sentry_original__);

// Default export that wraps app with per-request context initializer
export default Sentry.withSentry(
  (_env) => ({
    dsn: "https://15a2257ed06466face415d9d6faa4740@o4509797555503104.ingest.us.sentry.io/4509797557141504",
    // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing.
    // Learn more at
    // https://docs.sentry.io/platforms/javascript/configuration/options/#traces-sample-rate
    tracesSampleRate: 1.0,

    integrations: [
      Sentry.consoleLoggingIntegration({ levels: ["error", "warn", "log"] }),
      Sentry.fetchIntegration(),
    ],

    // Send structured logs to Sentry
    enableLogs: true,

    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true,
  }),
  {
    email: email as any,
    fetch(
      request: Request,
      env: any,
      ctx: ExecutionContext,
    ): Promise<Response> {
      console.log("fetch", request.url);
      return contextStorage.run({ env, ctx }, async () => {
        return await app.fetch(
          request as Request<unknown, IncomingRequestCfProperties<unknown>>,
          env,
          ctx,
        );
      });
    },
  },
);

//@ts-ignore
console.log("Original fetch after export default", originalFetch.__sentry_original__);

// Export the workflow
export { KbFileProcessorWorkflow };
