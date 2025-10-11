/**
 * This is the main entry point for your application and
 * MCP server. This is a Cloudflare workers app, and serves
 * both your MCP server at /mcp and your views as a react
 * application at /.
 */
import { DefaultEnv, withRuntime } from "@deco/workers-runtime";
import {
  type Env as DecoEnv,
  Scopes,
  StateSchema,
} from "../shared/deco.gen.ts";
import { tools } from "./tools/index.ts";
import { views } from "./views.ts";
import { workflows } from "./workflows/index.ts";

/**
 * This Env type is the main context object that is passed to
 * all of your Application.
 *
 * It includes all of the generated types from your
 * Deco bindings, along with the default ones.
 */
export type Env = DefaultEnv &
  DecoEnv & {
    ASSETS: {
      fetch: (request: Request, init?: RequestInit) => Promise<Response>;
    };
  };

const runtime = withRuntime<Env, typeof StateSchema>({
  oauth: {
    /**
     * These scopes define the asking permissions of your
     * app when a user is installing it. When a user
     * authorizes your app for using AI_GENERATE, you will
     * now be able to use `env.AI_GATEWAY.AI_GENERATE`
     * and utilize the user's own AI Gateway, without having to
     * deploy your own, setup any API keys, etc.
     */
    scopes: Object.values(Scopes).flatMap((scope) => Object.values(scope)),
    /**
     * The state schema of your Application defines what
     * your installed App state will look like. When a user
     * is installing your App, they will have to fill in
     * a form with the fields defined in the state schema.
     *
     * This is powerful for building multi-tenant apps,
     * where you can have multiple users and projects
     * sharing different configurations on the same app.
     *
     * When you define a binding dependency on another app,
     * it will automatically be linked to your StateSchema on
     * type generation. You can also `.extend` it to add more
     * fields to the state schema, like asking for an API Key
     * for connecting to a third-party service.
     */
    state: StateSchema,
  },
  views,
  workflows,
  tools: [
    ...tools,
    // Workflows Management tools
    // (env) => env.WORKFLOWS_MANAGEMENT.DECO_CHAT_VIEWS_LIST.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_RESOURCE_WORKFLOW_CREATE.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_RESOURCE_WORKFLOW_DELETE.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_RESOURCE_WORKFLOW_READ.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_RESOURCE_WORKFLOW_SEARCH.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_RESOURCE_WORKFLOW_UPDATE.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_VIEW_RENDER_WORKFLOW_DETAIL.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_WORKFLOW_GET_STATUS.asTool(),
    (env) => env.WORKFLOWS_MANAGEMENT.DECO_WORKFLOW_START.asTool(),
  ],
  /**
   * Fallback directly to assets for all requests that do not match a tool, workflow or auth.
   * If you wanted to add custom api routes that dont make sense to be a tool or workflow,
   * you can add them on this handler.
   */
  fetch: async (req, env) => {
    // Default: serve assets
    return env.ASSETS.fetch(req);
  },
});

export const Workflow = runtime.Workflow;
export default runtime;
