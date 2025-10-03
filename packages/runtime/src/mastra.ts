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
import { z } from "zod/v3";
import { ViewsListOutputSchema } from "./views.ts";
import {
  ResourceCreateInputSchema,
  ResourceCreateOutputSchema,
  ResourceDeleteInputSchema,
  ResourceDeleteOutputSchema,
  ResourceSearchInputSchema,
  ResourceSearchOutputSchema,
  ResourcesListOutputSchema,
  ResourcesReadInputSchema,
  ResourcesReadOutputSchema,
  ResourceUpdateInputSchema,
  ResourceUpdateOutputSchema,
} from "./resources.ts";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { DefaultEnv } from "./index.ts";
import { createStateValidationTool, State } from "./state.ts";
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
  TSuspendSchema extends z.ZodSchema = z.ZodSchema,
  TResumeSchema extends z.ZodSchema = z.ZodSchema,
  TContext extends
    ToolExecutionContext<TSchemaIn> = ToolExecutionContext<TSchemaIn>,
  TExecute extends ToolAction<
    TSchemaIn,
    TSchemaOut,
    any,
    any,
    TContext
  >["execute"] = ToolAction<
    TSchemaIn,
    TSchemaOut,
    any,
    any,
    TContext
  >["execute"],
>(
  opts: ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext
  > & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends [
  z.ZodSchema,
  z.ZodSchema,
  z.ZodSchema,
  z.ZodSchema,
  Function,
]
  ? Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
      inputSchema: TSchemaIn;
      outputSchema: TSchemaOut;
      execute: (context: TContext) => Promise<any>;
    }
  : Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> {
  const execute = opts.execute;
  if (typeof execute === "function") {
    opts.execute = ((input, options) => {
      const env = input.runtimeContext.get("env") as DefaultEnv;
      if (env) {
        env.DECO_REQUEST_CONTEXT.ensureAuthenticated();
      }
      return execute(input, options);
    }) as TExecute;
  }
  return createTool(opts);
}
export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TSuspendSchema extends z.ZodSchema = z.ZodSchema,
  TResumeSchema extends z.ZodSchema = z.ZodSchema,
  TContext extends ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  > = ToolExecutionContext<TSchemaIn, TSuspendSchema, TResumeSchema>,
  TExecute extends ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext
  >["execute"] = ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext
  >["execute"],
>(
  opts: ToolAction<
    TSchemaIn,
    TSchemaOut,
    TSuspendSchema,
    TResumeSchema,
    TContext
  > & {
    execute?: TExecute;
  },
): [TSchemaIn, TSchemaOut, TExecute] extends [
  z.ZodSchema,
  z.ZodSchema,
  z.ZodSchema,
  z.ZodSchema,
  Function,
]
  ? Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
      inputSchema: TSchemaIn;
      outputSchema: TSchemaOut;
      execute: (context: TContext) => Promise<any>;
    }
  : Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> {
  return mastraCreateTool({
    ...opts,
    execute:
      typeof opts?.execute === "function"
        ? (((input) => {
            return opts.execute!({
              ...input,
              runtimeContext: createRuntimeContext(input.runtimeContext),
            });
          }) as TExecute)
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
> extends Omit<
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
  TSuspendSchema extends z.ZodType<any>,
  TResumeSchema extends z.ZodType<any>,
  TContext extends ToolExecutionContext<
    TSchemaIn,
    TSuspendSchema,
    TResumeSchema
  >,
>(
  tool: Tool<TSchemaIn, TSchemaOut, TSuspendSchema, TResumeSchema, TContext> & {
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
>(opts: {
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
}): Step<
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

export interface ViewExport {
  title: string;
  icon: string;
  url: string;
  tools?: string[];
  rules?: string[];
}

export interface Integration {
  id: string;
  appId: string;
}
export interface CreateMCPServerOptions<
  Env = any,
  TSchema extends z.ZodTypeAny = never,
> {
  before?: (env: Env & DefaultEnv<TSchema>) => Promise<void> | void;
  oauth?: {
    state?: TSchema;
    scopes?: string[];
  };
  views?: (
    env: Env & DefaultEnv<TSchema>,
  ) => Promise<ViewExport[]> | ViewExport[];
  resources?: Array<
    (env: Env & DefaultEnv<TSchema>) => {
      name: string;
      icon: string;
      title: string;
      description?: string;
      tools: {
        read: (args: { uri: string }) => Promise<unknown>;
        search: (args: {
          term: string;
          cursor?: string;
          limit?: number;
        }) => Promise<unknown>;
        create?: (
          args: z.infer<typeof ResourceCreateInputSchema>,
        ) => Promise<unknown>;
        update?: (
          args: z.infer<typeof ResourceUpdateInputSchema>,
        ) => Promise<unknown>;
        delete?: (
          args: z.infer<typeof ResourceDeleteInputSchema>,
        ) => Promise<unknown>;
      };
      views?: {
        list?: { url?: string; tools?: string[]; rules?: string[] };
        detail?: {
          url?: string;
          mimeTypePattern?: string;
          resourceName?: string;
          tools?: string[];
          rules?: string[];
        };
      };
    }
  >;
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

const decoChatOAuthToolsFor = <TSchema extends z.ZodTypeAny = never>({
  state: schema,
  scopes,
}: CreateMCPServerOptions<any, TSchema>["oauth"] = {}) => {
  const jsonSchema = schema
    ? zodToJsonSchema(schema)
    : { type: "object", properties: {} };
  return [
    createTool({
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
    }),
  ];
};

const createWorkflowTools = <TEnv = any, TSchema extends z.ZodTypeAny = never>(
  workflow: ReturnType<typeof createWorkflow>,
  bindings: TEnv & DefaultEnv<TSchema>,
) => {
  const startTool = createTool({
    id: `DECO_CHAT_WORKFLOWS_START_${workflow.id}`,
    description: workflow.description ?? `Start workflow ${workflow.id}`,
    inputSchema:
      workflow.inputSchema && "shape" in workflow.inputSchema
        ? workflow.inputSchema
        : z.object({}),
    outputSchema: z.object({
      id: z.string(),
    }),
    execute: async (args) => {
      const store = State.getStore();
      const runId =
        store?.req?.headers.get("x-deco-chat-run-id") ?? crypto.randomUUID();
      const workflowDO = bindings.DECO_WORKFLOW_DO.get(
        bindings.DECO_WORKFLOW_DO.idFromName(runId),
      );

      using result = await workflowDO.start({
        workflowId: workflow.id,
        args: args.context,
        runId,
        ctx: bindings.DECO_REQUEST_CONTEXT,
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
      const workflowDO = bindings.DECO_WORKFLOW_DO.get(
        bindings.DECO_WORKFLOW_DO.idFromName(runId),
      );

      using _ = await workflowDO.cancel({
        workflowId: workflow.id,
        runId,
        ctx: bindings.DECO_REQUEST_CONTEXT,
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
      const workflowDO = bindings.DECO_WORKFLOW_DO.get(
        bindings.DECO_WORKFLOW_DO.idFromName(runId),
      );

      using _ = await workflowDO.resume({
        workflowId: workflow.id,
        runId,
        resumeData: args.context.resumeData,
        stepId: args.context.stepId,
        ctx: bindings.DECO_REQUEST_CONTEXT,
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
    await options.before?.(bindings);

    const server = new McpServer(
      { name: "@deco/mcp-api", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    // Resolve resources first; build resource tools; append later
    const resolvedResources = await Promise.all(
      options.resources?.map((r) => r(bindings)) ?? [],
    );
    const readHandlers = new Map<
      string,
      (a: { uri: string }) => Promise<any>
    >();
    const searchHandlers = new Map<
      string,
      (a: { term: string; cursor?: string; limit?: number }) => Promise<any>
    >();
    const createHandlers = new Map<string, (a: any) => Promise<any>>();
    const updateHandlers = new Map<string, (a: any) => Promise<any>>();
    const deleteHandlers = new Map<string, (a: any) => Promise<any>>();
    for (const r of resolvedResources) {
      if (r?.tools?.read) readHandlers.set(r.name, r.tools.read);
      if (r?.tools?.search) searchHandlers.set(r.name, r.tools.search);
      if (r?.tools?.create) createHandlers.set(r.name, r.tools.create);
      if (r?.tools?.update) updateHandlers.set(r.name, r.tools.update);
      if (r?.tools?.delete) deleteHandlers.set(r.name, r.tools.delete);
    }
    const resourceTools: ReturnType<typeof createTool>[] = [];
    if (resolvedResources.length > 0) {
      resourceTools.push(
        createTool({
          id: "DECO_CHAT_RESOURCES_READ",
          description: "Read a resource by uri (name + uri)",
          inputSchema: ResourcesReadInputSchema,
          outputSchema: ResourcesReadOutputSchema,
          execute: ({ context }) => {
            const fn = readHandlers.get(context.name);
            if (!fn) {
              throw new Error(`READ not implemented for ${context.name}`);
            }
            return fn({ uri: context.uri });
          },
        }),
      );
      resourceTools.push(
        createTool({
          id: "DECO_CHAT_RESOURCES_SEARCH",
          description: "Search resources (name + term)",
          inputSchema: ResourceSearchInputSchema,
          outputSchema: ResourceSearchOutputSchema,
          execute: ({ context }) => {
            const fn = searchHandlers.get(context.name);
            if (!fn) {
              throw new Error(`SEARCH not implemented for ${context.name}`);
            }
            const { term, cursor, limit } = context;
            return fn({ term, cursor, limit });
          },
        }),
      );
      resourceTools.push(
        createTool({
          id: "DECO_CHAT_RESOURCES_CREATE",
          description: "Create a resource (name + content)",
          inputSchema: ResourceCreateInputSchema,
          outputSchema: ResourceCreateOutputSchema,
          execute: ({ context }) => {
            const fn = createHandlers.get(context.name);
            if (!fn) {
              throw new Error(`CREATE not implemented for ${context.name}`);
            }
            return fn(context as any);
          },
        }),
      );
      resourceTools.push(
        createTool({
          id: "DECO_CHAT_RESOURCES_UPDATE",
          description: "Update a resource (name + uri)",
          inputSchema: ResourceUpdateInputSchema,
          outputSchema: ResourceUpdateOutputSchema,
          execute: ({ context }) => {
            const fn = updateHandlers.get(context.name);
            if (!fn) {
              throw new Error(`UPDATE not implemented for ${context.name}`);
            }
            return fn(context as any);
          },
        }),
      );
      resourceTools.push(
        createTool({
          id: "DECO_CHAT_RESOURCES_DELETE",
          description: "Delete a resource (name + uri)",
          inputSchema: ResourceDeleteInputSchema,
          outputSchema: ResourceDeleteOutputSchema,
          execute: ({ context }) => {
            const fn = deleteHandlers.get(context.name);
            if (!fn) {
              throw new Error(`DELETE not implemented for ${context.name}`);
            }
            return fn(context as any);
          },
        }),
      );
      resourceTools.push(
        createTool({
          id: "DECO_CHAT_RESOURCES_LIST",
          description: "List resource types",
          inputSchema: z.object({}),
          outputSchema: ResourcesListOutputSchema,
          execute: () =>
            Promise.resolve({
              resources: resolvedResources.map((r) => ({
                name: r.name,
                icon: r.icon,
                title: r.title,
                description: r.description ?? "",
                hasCreate: Boolean(createHandlers.get(r.name)),
                hasUpdate: Boolean(updateHandlers.get(r.name)),
                hasDelete: Boolean(deleteHandlers.get(r.name)),
              })),
            }),
        }),
      );
    }

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
      workflows
        ?.map((workflow) => createWorkflowTools(workflow, bindings))
        .flat() ?? [];

    tools.push(...workflowTools);
    tools.push(...decoChatOAuthToolsFor<TSchema>(options.oauth));
    tools.push(createStateValidationTool(options.oauth?.state));

    tools.push(
      createTool({
        id: `DECO_CHAT_VIEWS_LIST`,
        description: "List views exposed by this MCP",
        inputSchema: z.any(),
        outputSchema: ViewsListOutputSchema,
        execute: async () => {
          const base = ((await options.views?.(bindings)) ?? []).map((v) => ({
            id: undefined,
            // Stable machine name for routing: UPPERCASE + underscores
            name: v.title.toUpperCase().replace(/[^A-Z0-9]/g, "_"),
            title: v.title,
            description: undefined,
            icon: v.icon,
            url: v.url,
            tools: v.tools ?? [],
            rules: v.rules ?? [],
          }));
          const resourceViews = resolvedResources
            .map((r) => {
              const listUrl =
                r.views?.list?.url ??
                `internal://resource/list?name=${encodeURIComponent(r.name)}`;

              // Default CRUD tool ids for resources
              const defaultListTools: string[] = (() => {
                const base = [
                  "DECO_CHAT_RESOURCES_LIST",
                  "DECO_CHAT_RESOURCES_READ",
                  "DECO_CHAT_RESOURCES_SEARCH",
                ];
                const canCreate = Boolean(createHandlers.get(r.name));
                const canUpdate = Boolean(updateHandlers.get(r.name));
                const canDelete = Boolean(deleteHandlers.get(r.name));
                if (canCreate) base.push("DECO_CHAT_RESOURCES_CREATE");
                if (canUpdate) base.push("DECO_CHAT_RESOURCES_UPDATE");
                if (canDelete) base.push("DECO_CHAT_RESOURCES_DELETE");
                return base;
              })();

              const defaultListRules: string[] = [
                `You are viewing the ${
                  r.title ?? r.name
                } resources list. Resources are changeable via Resource tools (DECO_CHAT_RESOURCES_*). Use the appropriate tools to read, search, create, update, or delete items; do not fabricate data.`,
              ];

              const list = [
                {
                  name: `${r.name.toUpperCase()}_LIST`,
                  title: `${r.name} List`,
                  description: r.description,
                  icon: r.icon,
                  url: listUrl,
                  tools: r.views?.list?.tools ?? defaultListTools,
                  rules: r.views?.list?.rules ?? defaultListRules,
                },
              ];
              const detailUrl =
                r.views?.detail?.url ??
                `internal://resource/detail?name=${encodeURIComponent(r.name)}`;
              const detail = [
                {
                  name: `${r.name.toUpperCase()}_DETAIL`,
                  title: `${r.name} Detail`,
                  description: r.description,
                  icon: r.icon,
                  url: detailUrl,
                  mimeTypePattern: r.views?.detail?.mimeTypePattern,
                  resourceName: r.views?.detail?.resourceName ?? r.name,
                  tools: r.views?.detail?.tools ?? [],
                  rules: r.views?.detail?.rules ?? [],
                },
              ];
              return [...list, ...detail];
            })
            .flat();

          return { views: [...base, ...resourceViews] };
        },
      }),
    );

    // Finally append resource tools after other tools are collected
    tools.push(...resourceTools);

    for (const tool of tools) {
      server.registerTool(
        tool.id,
        {
          description: tool.description,
          inputSchema:
            tool.inputSchema && "shape" in tool.inputSchema
              ? (tool.inputSchema.shape as z.ZodRawShape)
              : z.object({}).shape,
          outputSchema:
            tool.outputSchema &&
            typeof tool.outputSchema === "object" &&
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
            content: [
              {
                type: "text",
                text: JSON.stringify(result),
              },
            ],
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

  const callTool: CallTool = async ({ toolCallId, toolCallInput }) => {
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
