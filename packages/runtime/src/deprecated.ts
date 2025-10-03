import type { RequestContext } from "./index.ts";
import type { DurableObjectNamespace } from "@cloudflare/workers-types";
import type { WorkspaceDB } from "./index.ts";
import type { WorkflowDO } from "./workflow.ts";
import type { z } from "zod/v3";

// deno-lint-ignore no-explicit-any
export interface DeprecatedEnv<TSchema extends z.ZodTypeAny = any> {
  /**
   * @deprecated Use DECO_REQUEST_CONTEXT instead
   */
  DECO_CHAT_REQUEST_CONTEXT: RequestContext<TSchema>;
  /**
   * @deprecated Use DECO_APP_NAME instead
   */
  DECO_CHAT_APP_NAME: string;
  /**
   * @deprecated Use DECO_APP_SLUG instead
   */
  DECO_CHAT_APP_SLUG: string;
  /**
   * @deprecated Use DECO_APP_ENTRYPOINT instead
   */
  DECO_CHAT_APP_ENTRYPOINT: string;
  /**
   * @deprecated Use DECO_API_URL instead
   */
  DECO_CHAT_API_URL?: string;
  /**
   * @deprecated Use DECO_WORKSPACE instead
   */
  DECO_CHAT_WORKSPACE: string;
  /**
   * @deprecated Use DECO_API_JWT_PUBLIC_KEY instead
   */
  DECO_CHAT_API_JWT_PUBLIC_KEY: string;
  /**
   * @deprecated Use DECO_APP_DEPLOYMENT_ID instead
   */
  DECO_CHAT_APP_DEPLOYMENT_ID: string;
  /**
   * @deprecated Use DECO_BINDINGS instead
   */
  DECO_CHAT_BINDINGS: string;
  /**
   * @deprecated Use DECO_API_TOKEN instead
   */
  DECO_CHAT_API_TOKEN: string;
  /**
   * @deprecated Use DECO_WORKFLOW_DO instead
   */
  DECO_CHAT_WORKFLOW_DO: DurableObjectNamespace<WorkflowDO>;
  /**
   * @deprecated Use DECO_WORKSPACE_DB instead
   */
  DECO_CHAT_WORKSPACE_DB: WorkspaceDB & {
    forContext: (ctx: RequestContext) => WorkspaceDB;
  };
}
