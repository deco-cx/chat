// deno-lint-ignore-file no-explicit-any ban-types
import { HttpServerTransport } from "@deco/mcp/http";
import {
  createTool as mastraCreateTool,
  Tool,
  type ToolAction,
  type ToolExecutionContext,
  type Workflow,
} from "@mastra/core";
import { RuntimeContext } from "@mastra/core/di";
import {
  createStep as mastraCreateStep,
  createWorkflow,
  type DefaultEngineType,
  type ExecuteFunction,
  type Step as MastraStep,
} from "@mastra/core/workflows";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { DefaultEnv } from "./index.ts";
import { State } from "./state.ts";
import { AgentSchema } from "@deco/sdk";
export { createWorkflow };

export { cloneStep, cloneWorkflow } from "@mastra/core/workflows";

const createRuntimeContext = (prev?: RuntimeContext<AppContext>) => {
  const runtimeContext = new RuntimeContext<AppContext>();
  const store = State.getStore();
  if (!store) {
    if (prev) {
      return prev;
    }
    throw new Error("Missing context, did you forget to call State.bind?");
  }
  const { env, ctx, req } = store;
  runtimeContext.set("env", env);
  runtimeContext.set("ctx", ctx);
  runtimeContext.set("req", req);
  return runtimeContext;
};

/**
 * creates a private tool that always ensure for athentication before being executed
 */
export function createPrivateTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<
    TSchemaIn
  >,
  TExecute extends ToolAction<TSchemaIn, TSchemaOut, TContext>["execute"] =
    ToolAction<TSchemaIn, TSchemaOut, TContext>["execute"],
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TContext> & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends
  [z.ZodSchema, z.ZodSchema, Function]
  ? Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  }
  : Tool<TSchemaIn, TSchemaOut, TContext> {
  const execute = opts.execute;
  if (typeof execute === "function") {
    opts.execute = ((input, options) => {
      const env = input.runtimeContext.get("env") as DefaultEnv;
      if (env) {
        env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated();
      }
      return execute(input, options);
    }) as TExecute;
  }
  return createTool(opts);
}
export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext extends ToolExecutionContext<TSchemaIn> = ToolExecutionContext<
    TSchemaIn
  >,
  TExecute extends ToolAction<TSchemaIn, TSchemaOut, TContext>["execute"] =
    ToolAction<TSchemaIn, TSchemaOut, TContext>["execute"],
>(
  opts: ToolAction<TSchemaIn, TSchemaOut, TContext> & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends
  [z.ZodSchema, z.ZodSchema, Function]
  ? Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  }
  : Tool<TSchemaIn, TSchemaOut, TContext> {
  return mastraCreateTool({
    ...opts,
    execute: typeof opts?.execute === "function"
      ? ((input) => {
        return opts.execute!({
          ...input,
          runtimeContext: createRuntimeContext(input.runtimeContext),
        });
      }) as TExecute
      : opts.execute,
  });
}

export type ExecWithContext<TF extends (...args: any[]) => any> = (
  input: Omit<Parameters<TF>[0], "runtimeContext"> & {
    runtimeContext: RuntimeContext<AppContext>;
  },
) => ReturnType<TF>;

export interface Step<
  TStepId extends string = string,
  TSchemaIn extends z.ZodType<any> = z.ZodType<any>,
  TSchemaOut extends z.ZodType<any> = z.ZodType<any>,
  TResumeSchema extends z.ZodType<any> = z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any> = z.ZodType<any>,
  TEngineType = any,
> extends
  Omit<
    MastraStep<
      TStepId,
      TSchemaIn,
      TSchemaOut,
      TResumeSchema,
      TSuspendSchema,
      TEngineType
    >,
    "execute"
  > {
  execute: ExecWithContext<
    ExecuteFunction<
      z.infer<TSchemaIn>,
      z.infer<TSchemaOut>,
      z.infer<TResumeSchema>,
      z.infer<TSuspendSchema>,
      TEngineType
    >
  >;
}
export function createStepFromTool<
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn>,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  },
): Step<
  string,
  TSchemaIn,
  TSchemaOut,
  z.ZodType<any>,
  z.ZodType<any>,
  DefaultEngineType
> {
  return mastraCreateStep(tool);
}

export function createStep<
  TStepId extends string,
  TStepInput extends z.ZodType<any>,
  TStepOutput extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TSuspendSchema extends z.ZodType<any>,
>(
  opts: {
    id: TStepId;
    description?: string;
    inputSchema: TStepInput;
    outputSchema: TStepOutput;
    resumeSchema?: TResumeSchema;
    suspendSchema?: TSuspendSchema;
    execute: ExecWithContext<
      ExecuteFunction<
        z.infer<TStepInput>,
        z.infer<TStepOutput>,
        z.infer<TResumeSchema>,
        z.infer<TSuspendSchema>,
        DefaultEngineType
      >
    >;
  },
): Step<
  TStepId,
  TStepInput,
  TStepOutput,
  TResumeSchema,
  TSuspendSchema,
  DefaultEngineType
> {
  return mastraCreateStep({
    ...opts,
    execute: (input) => {
      return opts.execute({
        ...input,
        runtimeContext: createRuntimeContext(input.runtimeContext),
      });
    },
  });
}

interface ViewExport {
  title: string;
  icon: string;
  url: string;
}

type AgentExport = z.infer<typeof AgentSchema>;

export interface CreateMCPServerOptions<
  Env = any,
  TSchema extends z.ZodTypeAny = never,
> {
  oauth?: { state?: TSchema; scopes?: string[] };
  views?: (
    env: Env & DefaultEnv<TSchema>,
  ) => Promise<ViewExport[]> | ViewExport[];
  agents?: (
    env: Env & DefaultEnv<TSchema>,
  ) => Promise<AgentExport[]> | AgentExport[];
  tools?: Array<
    (
      env: Env & DefaultEnv<TSchema>,
    ) => Promise<ReturnType<typeof createTool>> | ReturnType<typeof createTool>
  >;
  workflows?: Array<
    (
      env: Env & DefaultEnv<TSchema>,
    ) => // this is a workaround to allow workflows to be thenables
    | Promise<{ workflow: ReturnType<typeof createWorkflow> }>
    | ReturnType<typeof createWorkflow>
  >;
}

export type Fetch<TEnv = any> = (
  req: Request,
  env: TEnv,
  ctx: ExecutionContext,
) => Promise<Response> | Response;

export interface AppContext<TEnv = any> {
  env: TEnv;
  ctx: { waitUntil: (promise: Promise<any>) => void };
  req?: Request;
}

const decoChatOAuthToolFor = <TSchema extends z.ZodTypeAny = never>(
  { state: schema, scopes }: CreateMCPServerOptions<any, TSchema>["oauth"] = {},
) => {
  const jsonSchema = schema
    ? zodToJsonSchema(schema)
    : { type: "object", properties: {} };
  return createTool({
    id: "DECO_CHAT_OAUTH_START",
    description: "OAuth for Deco Chat",
    inputSchema: z.object({
      returnUrl: z.string(),
    }),
    outputSchema: z.object({
      stateSchema: z.any(),
      scopes: z.array(z.string()).optional(),
    }),
    execute: () => {
      return Promise.resolve({
        stateSchema: jsonSchema,
        scopes,
      });
    },
  });
};

const createWorkflowTools = <TEnv = any, TSchema extends z.ZodTypeAny = never>(
  workflow: ReturnType<typeof createWorkflow>,
  bindings: TEnv & DefaultEnv<TSchema>,
) => {
  const startTool = createTool({
    id: `DECO_CHAT_WORKFLOWS_START_${workflow.id}`,
    description: workflow.description ?? `Start workflow ${workflow.id}`,
    inputSchema: workflow.inputSchema && "shape" in workflow.inputSchema
      ? workflow.inputSchema
      : z.object({}),
    outputSchema: z.object({
      id: z.string(),
    }),
    execute: async (args) => {
      const store = State.getStore();
      const runId = store?.req?.headers.get("x-deco-chat-run-id") ??
        crypto.randomUUID();
      const workflowDO = bindings.DECO_CHAT_WORKFLOW_DO.get(
        bindings.DECO_CHAT_WORKFLOW_DO.idFromName(runId),
      );

      using result = await workflowDO.start({
        workflowId: workflow.id,
        args: args.context,
        runId,
        ctx: bindings.DECO_CHAT_REQUEST_CONTEXT,
      });
      return { id: result.runId };
    },
  });

  const cancelTool = createTool({
    id: `DECO_CHAT_WORKFLOWS_CANCEL_${workflow.id}`,
    description: `Cancel ${workflow.description ?? `workflow ${workflow.id}`}`,
    inputSchema: z.object({ runId: z.string() }),
    outputSchema: z.object({ cancelled: z.boolean() }),
    execute: async (args) => {
      const runId = args.context.runId;
      const workflowDO = bindings.DECO_CHAT_WORKFLOW_DO.get(
        bindings.DECO_CHAT_WORKFLOW_DO.idFromName(runId),
      );

      using _ = await workflowDO.cancel({
        workflowId: workflow.id,
        runId,
        ctx: bindings.DECO_CHAT_REQUEST_CONTEXT,
      });

      return { cancelled: true };
    },
  });

  const resumeTool = createTool({
    id: `DECO_CHAT_WORKFLOWS_RESUME_${workflow.id}`,
    description: `Resume ${workflow.description ?? `workflow ${workflow.id}`}`,
    inputSchema: z.object({
      runId: z.string(),
      stepId: z.string(),
      resumeData: z.any(),
    }),
    outputSchema: z.object({ resumed: z.boolean() }),
    execute: async (args) => {
      const runId = args.context.runId;
      const workflowDO = bindings.DECO_CHAT_WORKFLOW_DO.get(
        bindings.DECO_CHAT_WORKFLOW_DO.idFromName(runId),
      );

      using _ = await workflowDO.resume({
        workflowId: workflow.id,
        runId,
        resumeData: args.context.resumeData,
        stepId: args.context.stepId,
        ctx: bindings.DECO_CHAT_REQUEST_CONTEXT,
      });

      return { resumed: true };
    },
  });

  return [startTool, cancelTool, resumeTool];
};

type CallTool = (opts: {
  toolCallId: string;
  toolCallInput: any;
}) => Promise<any>;

export type MCPServer<TEnv = any, TSchema extends z.ZodTypeAny = never> = {
  fetch: Fetch<TEnv & DefaultEnv<TSchema>>;
  callTool: CallTool;
};

export const isWorkflow = (value: any): value is Workflow => {
  return value && !(value instanceof Promise);
};
const isTool = (value: any): value is Tool => {
  return value && value instanceof Tool;
};

export const createMCPServer = <
  TEnv = any,
  TSchema extends z.ZodTypeAny = never,
>(
  options: CreateMCPServerOptions<TEnv, TSchema>,
): MCPServer<TEnv, TSchema> => {
  const createServer = async (bindings: TEnv & DefaultEnv<TSchema>) => {
    const server = new McpServer(
      { name: "@deco/mcp-api", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    const tools = await Promise.all(
      options.tools?.map(async (tool) => {
        const toolResult = tool(bindings);
        return isTool(toolResult) ? toolResult : await toolResult;
      }) ?? [],
    );

    // since mastra workflows are thenables, we need to await and add as a prop
    const workflows = await Promise.all(
      options.workflows?.map(async (workflow) => {
        const workflowResult = workflow(bindings);
        if (isWorkflow(workflowResult)) {
          return { workflow: workflowResult };
        }

        return await workflowResult;
      }) ?? [],
    ).then((w) => w.map((w) => w.workflow));

    const workflowTools =
      workflows?.map((workflow) => createWorkflowTools(workflow, bindings))
        .flat() ?? [];

    tools.push(...workflowTools);
    tools.push(decoChatOAuthToolFor<TSchema>(options.oauth));

    tools.push(createTool({
      id: `DECO_CHAT_VIEWS_LIST`,
      description: "List views exposed by this MCP",
      inputSchema: z.any(),
      outputSchema: z.object({
        views: z.array(z.object({
          title: z.string(),
          icon: z.string(),
          url: z.string(),
        })),
      }),
      execute: async () => ({ views: await options.views?.(bindings) ?? [] }),
    }));

    tools.push(createTool({
      id: "DECO_CHAT_AGENTS_LIST",
      description: "List agents exposed by this MCP",
      inputSchema: z.any(),
      outputSchema: z.object({
        agents: z.array(AgentSchema),
      }),
      execute: async () => ({ agents: await options.agents?.(bindings) ?? [] }),
    }));

    for (const tool of tools) {
      server.registerTool(
        tool.id,
        {
          description: tool.description,
          inputSchema: tool.inputSchema && "shape" in tool.inputSchema
            ? (tool.inputSchema.shape as z.ZodRawShape)
            : z.object({}).shape,
          outputSchema:
            tool.outputSchema && typeof tool.outputSchema === "object" &&
              "shape" in tool.outputSchema
              ? (tool.outputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
        },
        async (args) => {
          const result = await tool.execute!({
            context: args,
            runId: crypto.randomUUID(),
            runtimeContext: createRuntimeContext(),
          });
          return {
            structuredContent: result,
          };
        },
      );
    }

    return { server, tools };
  };

  const fetch = async (
    req: Request,
    env: TEnv & DefaultEnv<TSchema>,
    _ctx: ExecutionContext,
  ) => {
    const { server } = await createServer(env);
    const transport = new HttpServerTransport();

    await server.connect(transport);

    return await transport.handleMessage(req);
  };

  const callTool: CallTool = async ({
    toolCallId,
    toolCallInput,
  }) => {
    const currentState = State.getStore();
    if (!currentState) {
      throw new Error("Missing state, did you forget to call State.bind?");
    }
    const env = currentState?.env;
    const { tools } = await createServer(env);
    const tool = tools.find((t) => t.id === toolCallId);
    const execute = tool?.execute;
    if (!execute) {
      throw new Error(
        `Tool ${toolCallId} not found or does not have an execute function`,
      );
    }

    return execute({
      context: toolCallInput,
      runId: crypto.randomUUID(),
      runtimeContext: createRuntimeContext(),
    });
  };

  return {
    fetch,
    callTool,
  };
};
