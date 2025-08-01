// deno-lint-ignore-file no-explicit-any
import { type DefaultEnv, type RequestContext, withBindings } from "./index.ts";
import {
  type AppContext,
  type CreateMCPServerOptions,
  isWorkflow,
  MCPServer,
} from "./mastra.ts";

import { D1Store } from "@mastra/cloudflare-d1";
import { Mastra, type Workflow as MastraWorkflow } from "@mastra/core";
import { RuntimeContext } from "@mastra/core/di";
import { DurableObject } from "./cf-imports.ts";
import { State } from "./state.ts";

const createRuntimeContext = (env: DefaultEnv, ctx: DurableObjectState) => {
  const runtimeContext = new RuntimeContext<AppContext>();
  runtimeContext.set("env", env);
  runtimeContext.set("ctx", ctx);
  return runtimeContext;
};
export interface StartWorkflowArgs {
  workflowId: string;
  args: unknown;
  runId?: string;
  ctx: RequestContext;
}

export interface CancelWorkflowArgs {
  workflowId: string;
  runId?: string;
  ctx: RequestContext;
}

export interface ResumeWorkflowArgs {
  workflowId: string;
  runId?: string;
  resumeData: unknown;
  stepId: string;
  ctx: RequestContext;
}
export interface WorkflowDO extends Rpc.DurableObjectBranded {
  start: (args: StartWorkflowArgs) => Promise<{ runId: string }>;
  cancel: (args: CancelWorkflowArgs) => Promise<{ cancelled: boolean }>;
  resume: (args: ResumeWorkflowArgs) => Promise<{ resumed: boolean }>;
}

export const Workflow = (
  server: MCPServer<any, any>,
  workflows?: CreateMCPServerOptions["workflows"],
) => {
  return class Workflow
    extends DurableObject<DefaultEnv>
    implements WorkflowDO
  {
    constructor(
      public override ctx: DurableObjectState,
      public override env: DefaultEnv,
    ) {
      super(ctx, env);
    }

    bindings(ctx: RequestContext) {
      return withBindings<DefaultEnv>(this.env, server, ctx);
    }

    runWithContext<T>(
      ctx: RequestContext,
      f: (ctx: DefaultEnv) => Promise<T>,
    ): Promise<T> {
      const bindings = this.bindings(ctx);
      return State.run(
        {
          ctx: {
            waitUntil: this.ctx.waitUntil.bind(this.ctx),
          },
          env: this.bindings(ctx),
        },
        () => f(bindings),
      );
    }

    async #getWorkflow(
      workflowId: string,
      bindings: DefaultEnv,
    ): Promise<{ workflow: MastraWorkflow }> {
      const bindedWorkflows = await Promise.all(
        workflows?.map(async (workflow) => {
          const workflowResult = workflow(bindings);
          if (isWorkflow(workflowResult)) {
            return { workflow: workflowResult };
          }

          return await workflowResult;
        }) ?? [],
      );
      const workflowsMap = Object.fromEntries(
        bindedWorkflows.map((w) => [w.workflow.id, w.workflow]),
      );
      const d1Storage = new D1Store({
        client: bindings.DECO_CHAT_WORKSPACE_DB,
      });
      const mastra = new Mastra({
        storage: d1Storage,
        workflows: {
          [workflowId]: workflowsMap[workflowId],
        },
        telemetry: {
          enabled: true,
          serviceName: `app-${
            this.env.DECO_CHAT_SCRIPT_SLUG ?? this.env.DECO_CHAT_APP_SLUG
          }`,
        },
      });
      // since mastra workflows are thenables, so we need to wrap then into an object
      return { workflow: mastra.getWorkflow(workflowId) };
    }

    start({ workflowId, runId, args, ctx }: StartWorkflowArgs) {
      return this.runWithContext(ctx, async (bindings) => {
        const { workflow } = await this.#getWorkflow(workflowId, bindings);

        const run = await workflow.createRunAsync({
          runId: this.ctx.id.name ?? runId,
        });

        const promise = run.start({
          inputData: args,
          runtimeContext: createRuntimeContext(bindings, this.ctx),
        });

        this.ctx.waitUntil(
          promise
            .then(() => {
              console.debug("workflow", run.runId, "finished successfully");
            })
            .catch((e) => {
              console.error("workflow", run.runId, "finished with error", e);
              throw e;
            }),
        );

        return {
          runId: run.runId,
        };
      });
    }

    cancel({ workflowId, runId, ctx }: CancelWorkflowArgs) {
      return this.runWithContext(ctx, async () => {
        const { workflow } = await this.#getWorkflow(
          workflowId,
          this.bindings(ctx),
        );
        const run = await workflow.createRunAsync({
          runId: this.ctx.id.name ?? runId,
        });

        this.ctx.waitUntil(run.cancel());

        return {
          cancelled: true,
        };
      });
    }
    resume({ workflowId, runId, resumeData, stepId, ctx }: ResumeWorkflowArgs) {
      return this.runWithContext(ctx, async (bindings) => {
        const { workflow } = await this.#getWorkflow(workflowId, bindings);
        const run = await workflow.createRunAsync({
          runId: this.ctx.id.name ?? runId,
        });

        this.ctx.waitUntil(
          run.resume({
            resumeData,
            step: stepId,
            runtimeContext: createRuntimeContext(bindings, this.ctx),
          }),
        );

        return {
          resumed: true,
        };
      });
    }
  };
};
