// deno-lint-ignore-file no-explicit-any
import { createOpenAI } from "@ai-sdk/openai";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { ActorState, InvokeMiddlewareOptions } from "@deco/actors";
import { Actor } from "@deco/actors";
import { DEFAULT_MODEL, WELL_KNOWN_AGENTS } from "@deco/sdk";
import { type AuthMetadata, BaseActor } from "@deco/sdk/actors";
import { SUPABASE_URL } from "@deco/sdk/auth";
import { trace } from "@deco/sdk/observability";
import {
  getTwoFirstSegments as getWorkspace,
  Path,
  type Workspace,
} from "@deco/sdk/path";
import {
  createServerTimings,
  type ServerTimingsBuilder,
} from "@deco/sdk/timings";
import { createWalletClient } from "@deco/sdk/wallet";
import type { StorageThreadType } from "@mastra/core";
import type { ToolsetsInput, ToolsInput } from "@mastra/core/agent";
import { Agent } from "@mastra/core/agent";
import type { MastraMemory } from "@mastra/core/memory";
import { TokenLimiter } from "@mastra/memory/processors";
import { createServerClient } from "@supabase/ssr";
import {
  type GenerateObjectResult,
  type GenerateTextResult,
  type LanguageModelV1,
  type Message,
  smoothStream,
  type StreamTextResult,
  type TextStreamPart,
} from "ai";
import { getRuntimeKey } from "hono/adapter";
import { join } from "node:path/posix";
import process from "node:process";
import { pickCapybaraAvatar } from "./capybaras.ts";
import { mcpServerTools } from "./mcp.ts";
import type { AgentMemoryConfig } from "./memory/memory.ts";
import { AgentMemory, buildMemoryId } from "./memory/memory.ts";
import { createLLM } from "./models.ts";
import type { DecoChatStorage } from "./storage/index.ts";
import {
  type Agent as Configuration,
  AgentNotFoundError,
} from "./storage/index.ts";
import { createSupabaseStorage } from "./storage/supabaseStorage.ts";
import type {
  AIAgent as IIAgent,
  Message as AIMessage,
  StreamOptions,
  Thread,
  ThreadQueryOptions,
} from "./types.ts";
import { GenerateOptions } from "./types.ts";
import { slugify, toAlphanumericId } from "./utils/slugify.ts";
import { AgentWallet } from "./wallet/index.ts";

const TURSO_AUTH_TOKEN_KEY = "turso-auth-token";
const DEFAULT_ACCOUNT_ID = "c95fc4cec7fc52453228d9db170c372c";
const DEFAULT_GATEWAY_ID = "deco-ai";
const ANONYMOUS_INSTRUCTIONS =
  "You should help users to configure yourself. Users should give you your name, instructions, and optionally a model (leave it default if the user don't mention it, don't force they to set it). This is your only task for now. Tell the user that you are ready to configure yourself when you have all the information.";

const ANONYMOUS_NAME = "Anonymous";

export interface Env {
  ANTHROPIC_API_KEY: string;
  GATEWAY_ID: string;
  ACCOUNT_ID: string;
  CF_ACCOUNT_ID: string;
  TURSO_ORGANIZATION: string;
  TURSO_ADMIN_TOKEN: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  AWS_REGION: string;
  DECO_CHAT_DATA_BUCKET_NAME: string;
}

export interface AgentMetadata extends AuthMetadata {
  threadId?: string;
  resourceId?: string;
  wallet?: Promise<AgentWallet>;
  principalCookie?: string | null;
  timings?: ServerTimingsBuilder;
}

const DEFAULT_MEMORY_LAST_MESSAGES = 8;
const DEFAULT_MAX_STEPS = 25;
const MAX_STEPS = 25;
const DEFAULT_MAX_TOKENS = 8192;
const MAX_TOKENS = 64000;
const MAX_THINKING_TOKENS = 12000;
const MIN_THINKING_TOKENS = 1024;

const NON_SERIALIZABLE_FIELDS = ["WALLET"];

const removeNonSerializableFields = (obj: any) => {
  const newObj: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj ?? {})) {
    if (!NON_SERIALIZABLE_FIELDS.includes(key)) {
      newObj[key] = value;
    }
  }
  return newObj;
};

@Actor()
export class AIAgent extends BaseActor<AgentMetadata> implements IIAgent {
  private _agent?: Agent;

  /**
   * Contains all tools from all servers that have ever been enabled for this agent.
   * These tools are ready to be used. To use them, just filter using the pickCallableTools function.
   */
  protected callableToolSet: ToolsetsInput = {};

  public workspace: Workspace;
  private id: string;
  public _configuration?: Configuration;
  private memoryId?: string;
  private agentMemoryConfig: AgentMemoryConfig;
  private agentId: string;
  private wallet: AgentWallet;
  public storage?: DecoChatStorage;

  constructor(
    public readonly state: ActorState,
    protected override env: any,
  ) {
    super(removeNonSerializableFields(env));
    this.id = toAlphanumericId(this.state.id);
    this.env = {
      CF_ACCOUNT_ID: DEFAULT_ACCOUNT_ID,
      ...process.env,
      ...this.env,
    };
    this.workspace = getWorkspace(this.state.id);
    this.wallet = new AgentWallet({
      agentId: this.id,
      agentPath: this.state.id,
      workspace: this.workspace,
      wallet: createWalletClient(this.env.WALLET_API_KEY, env?.WALLET),
    });
    this.agentMemoryConfig = null as unknown as AgentMemoryConfig;
    this.agentId = this.state.id.split("/").pop() ?? "";
    this.storage = createSupabaseStorage(
      createServerClient(
        SUPABASE_URL,
        this.env.SUPABASE_SERVER_TOKEN,
        { cookies: { getAll: () => [] } },
      ),
    );

    this.state.blockConcurrencyWhile(async () => {
      await this.init();
    });
  }

  public resolvePath(path: string): string {
    if (path.startsWith(".")) {
      return join(this.state.id, path.slice(1));
    }
    if (path.startsWith(Path.folders.home)) {
      return join(this.workspace, path.slice(Path.folders.home.length));
    }

    return path;
  }

  override async enrichMetadata(
    m: AgentMetadata,
    req: Request,
  ): Promise<AgentMetadata> {
    const timings = m.timings;
    const enrichMetadata = timings?.start("enrichMetadata");
    this.metadata = await super.enrichMetadata(m, req);
    this.metadata.hasAccess ||= this._configuration?.visibility === "PUBLIC";

    const runtimeKey = getRuntimeKey();

    // this is a weak check, but it works for now
    if (req.headers.get("host") !== null && runtimeKey !== "deno") { // if host is set so its not an internal request so checks must be applied
      this.assertsPrincipalHasAccess();
    } else if (req.headers.get("host") !== null && runtimeKey === "deno") {
      console.warn(
        "Deno runtime detected, skipping access check. This might fail in production.",
      );
    }

    // Propagate supabase token from request to integration token
    this.metadata.principalCookie = req.headers.get("cookie");
    enrichMetadata?.end();
    return this.metadata;
  }

  // we avoid to let the AI to set the id and tools_set, so we can keep the agent id and tools_set stable
  public async configure({
    id: _id,
    views: _views,
    ...config
  }: Partial<Configuration>): Promise<Configuration> {
    const parsed = await this.configuration();
    const updatedConfig = {
      ...parsed,
      ...config,
      avatar: config.avatar || parsed.avatar || pickCapybaraAvatar(),
    };

    this.storage?.agents.for(this.workspace).update(
      parsed.id,
      updatedConfig,
    );

    await this.init(updatedConfig);
    this._configuration = updatedConfig;

    return updatedConfig;
  }

  async listThreads(): Promise<StorageThreadType[]> {
    return await this.memory.listAgentThreads();
  }

  async createThread(thread: Thread): Promise<Thread> {
    return await this.memory.createThread({
      ...this.thread,
      ...thread,
    });
  }

  async query(options?: ThreadQueryOptions): Promise<Message[]> {
    const currentThreadId = this.thread;
    const { uiMessages, messages } = await this.memory.query({
      ...currentThreadId,
      threadId: options?.threadId ?? currentThreadId.threadId,
    }).catch(
      (error) => {
        console.error("Error querying memory", error);
        return {
          messages: [],
          uiMessages: [],
        };
      },
    );

    const messagesById: Record<string, Message> = {};
    for (const msg of messages as Message[]) {
      if (msg.id) {
        messagesById[msg.id] = msg;
      }
    }

    // Workaround for ui messages missing createdAt property
    // Messages are typed as CoreMessage but contain id and createdAt
    // See: https://github.com/mastra-ai/mastra/issues/3535
    return uiMessages.map((uiMessage) => {
      const message = messagesById[uiMessage.id];
      if (message?.createdAt) {
        return { ...uiMessage, createdAt: message.createdAt };
      }
      return uiMessage;
    });
  }

  public async updateThreadTools(tool_set: Configuration["tools_set"]) {
    const thread = await this.memory.getThreadById(this.thread);
    if (!thread) {
      return {
        success: false,
        message: "Thread not found",
      };
    }
    const metadata = thread?.metadata ?? {};

    const updated = { ...metadata, tool_set };

    const updatedThread = {
      ...thread,
      metadata: updated,
    };

    await this.memory.saveThread({
      thread: updatedThread,
    });

    this.resetCallableToolSet();

    return {
      success: true,
      message: "Thread updated",
    };
  }

  public async getThreadTools(): Promise<Configuration["tools_set"]> {
    const thread = await this.memory.getThreadById(this.thread)
      .catch(() => null);

    if (!thread) {
      return this.getTools();
    }
    const metadata = thread?.metadata ?? {};
    const tool_set = metadata?.tool_set as
      | Configuration["tools_set"]
      | undefined;
    return tool_set ?? this.getTools();
  }

  public async updateTools(tool_set: Configuration["tools_set"]) {
    this.resetCallableToolSet();
    await this.configure({
      tools_set: tool_set,
    });
  }

  public getTools(): Promise<Configuration["tools_set"]> {
    return Promise.resolve(
      this._configuration?.tools_set ?? {},
    );
  }

  resetCallableToolSet(mcpId?: string) {
    if (mcpId) {
      delete this.callableToolSet[mcpId];
    } else {
      this.callableToolSet = {};
    }
  }

  protected async getOrCreateCallableToolSet(
    mcpId: string,
  ): Promise<ToolsInput | null> {
    if (this.callableToolSet[mcpId]) {
      return this.callableToolSet[mcpId];
    }

    const integration = await this.storage?.integrations
      .for(this.workspace)
      .get(mcpId);

    if (!integration) {
      return null;
    }

    const serverTools = await mcpServerTools(integration, this, this.env);

    if (Object.keys(serverTools ?? {}).length === 0) {
      return null;
    }

    this.callableToolSet[mcpId] = serverTools;

    return this.callableToolSet[mcpId];
  }

  protected async pickCallableTools(
    tool_set: Configuration["tools_set"],
  ): Promise<ToolsetsInput> {
    const tools: ToolsetsInput = {};

    for (const [mcpId, filterList] of Object.entries(tool_set)) {
      const allToolsFor = await this.getOrCreateCallableToolSet(mcpId)
        .catch(() => {
          return null;
        });

      if (!allToolsFor) {
        console.warn(`No tools found for server: ${mcpId}. Skipping.`);
        continue;
      }

      if (filterList.length === 0) {
        tools[mcpId] = allToolsFor;
        continue;
      }
      const toolsInput: ToolsInput = {};
      for (const item of filterList) {
        const slug = slugify(item);
        if (slug in allToolsFor) {
          toolsInput[slug] = allToolsFor[slug];
          continue;
        }

        console.warn(`Tool ${item} not found in callableToolSet[${mcpId}]`);
      }

      tools[mcpId] = toolsInput;
    }

    return tools;
  }

  private async initMemory(
    memoryId: string,
    config: Configuration,
    tokenLimit: number,
  ) {
    if (this.memoryId !== memoryId || !this.memory) {
      const openai = createOpenAI({
        apiKey: this.env.OPENAI_API_KEY,
      });
      const tursoOrganization = this.env.TURSO_ORGANIZATION ?? "decoai";
      const tokenStorage = this.env.TURSO_GROUP_DATABASE_TOKEN ?? {
        getToken: (memoryId: string) => {
          return this.state.storage.get<string>(
            `${TURSO_AUTH_TOKEN_KEY}-${memoryId}-${tursoOrganization}`,
          );
        },
        setToken: async (memoryId: string, token: string) => {
          await this.state.storage.put(
            `${TURSO_AUTH_TOKEN_KEY}-${memoryId}-${tursoOrganization}`,
            token,
          );
        },
      };

      // @ts-ignore: "ignore this for now"
      this.agentMemoryConfig = await AgentMemory.buildAgentMemoryConfig({
        agentId: config.id,
        tursoAdminToken: this.env.TURSO_ADMIN_TOKEN,
        tursoOrganization,
        tokenStorage,
        processors: [new TokenLimiter({ limit: tokenLimit })],
        embedder: openai.embedding("text-embedding-3-small"),
        workspace: this.workspace,
        options: {
          semanticRecall: false,
          lastMessages: Math.min(
            DEFAULT_MEMORY_LAST_MESSAGES,
            this._configuration?.memory?.last_messages ??
              DEFAULT_MEMORY_LAST_MESSAGES,
          ),
        },
      });
      this.memoryId = memoryId;
    }
  }

  private async initAgent(config: Configuration) {
    const memoryId = buildMemoryId(this.workspace, config.id);
    const { llm, tokenLimit } = this.createLLM({
      model: config.model || DEFAULT_MODEL,
    });
    await this.initMemory(memoryId, config, tokenLimit);

    this._agent = new Agent({
      memory: this.memory as unknown as MastraMemory,
      name: config.name,
      instructions: config.instructions,
      model: llm,
    });
  }

  public async init(config?: Configuration | null) {
    config ??= await this.configuration();
    await this.initAgent(config);
  }

  private createLLM(
    { model, bypassGateway, bypassOpenRouter }: {
      model: string;
      bypassGateway?: boolean;
      bypassOpenRouter?: boolean;
    },
  ): { llm: LanguageModelV1; tokenLimit: number } {
    // todo(@camudo): change this to a nice algorithm someday
    if (model === "auto") {
      model = "openai:gpt-4.1-mini";
    }

    const [provider, ...rest] = model.split(":");
    const providerModel = rest.join(":");
    const accountId = this.env?.ACCOUNT_ID ?? DEFAULT_ACCOUNT_ID;
    const gatewayId = this.env?.GATEWAY_ID ?? DEFAULT_GATEWAY_ID;
    return createLLM({
      bypassOpenRouter,
      envs: this.env,
      accountId,
      gatewayId,
      provider,
      bypassGateway,
    })(providerModel);
  }

  private get anonymous(): Agent {
    return new Agent({
      memory: this.memory as unknown as MastraMemory,
      name: ANONYMOUS_NAME,
      instructions: ANONYMOUS_INSTRUCTIONS,
      model: this.createLLM({
        model: DEFAULT_MODEL,
      }).llm,
    });
  }
  private get agent(): Agent {
    return this._agent ?? this.anonymous;
  }

  public getAgentName() {
    return this._configuration?.name ?? ANONYMOUS_NAME;
  }

  // Warning: This method also updates the configuration in memory
  async configuration(): Promise<Configuration> {
    const manifest = this.agentId in WELL_KNOWN_AGENTS
      ? WELL_KNOWN_AGENTS[this.agentId as keyof typeof WELL_KNOWN_AGENTS]
      : await this.storage?.agents.for(this.workspace).get(this.agentId)
        .catch((error) => {
          if (error instanceof AgentNotFoundError) {
            return null;
          }
          throw error;
        });

    const merged: Configuration = {
      name: ANONYMOUS_NAME,
      instructions: ANONYMOUS_INSTRUCTIONS,
      tools_set: {},
      avatar: WELL_KNOWN_AGENTS.teamAgent.avatar,
      id: crypto.randomUUID(),
      model: DEFAULT_MODEL,
      views: [],
      visibility: "WORKSPACE",
      ...manifest,
    };

    this._configuration = merged;

    return this._configuration;
  }

  async callTool(toolId: string, input: any): Promise<any> {
    const [integrationId, toolName] = toolId.split(".");

    const toolSet = await this.getThreadTools();

    if (!toolSet[integrationId]) {
      return {
        success: false,
        message: `Integration ${integrationId} not found`,
      };
    }

    const callable = await this.pickCallableTools({
      [integrationId]: [toolName],
    });

    const tool = callable?.[integrationId]?.[toolName];
    if (!tool) {
      return {
        success: false,
        message: `Tool ${toolName} not found`,
      };
    }
    const result = await tool?.execute?.({ context: input }, {
      toolCallId: crypto.randomUUID(),
      messages: [],
    });
    return result;
  }

  public get memory(): AgentMemory {
    return new AgentMemory(this.agentMemoryConfig);
  }

  public get thread(): { threadId: string; resourceId: string } {
    const threadId = this.metadata?.threadId ?? this.memory.generateId(); // private thread with the given resource
    return {
      threadId,
      resourceId: this.metadata?.resourceId ?? this.metadata?.principal?.id ??
        threadId,
    };
  }

  async generateObject<TObject = any>(
    payload: AIMessage[],
    jsonSchema: JSONSchema7,
  ): Promise<GenerateObjectResult<TObject>> {
    const result = await this.agent.generate(payload, {
      ...this.thread,
      output: jsonSchema,
      maxSteps: this.maxSteps(),
      maxTokens: this.maxTokens(),
    }) as any as Promise<GenerateObjectResult<TObject>>;
    await this.memory.addMessage({
      ...this.thread,
      type: "text",
      role: "assistant",
      content: `\`\`\`json\n${JSON.stringify(result)}\`\`\``,
    });
    return result;
  }

  private filterToolsets(
    toolsets: ToolsetsInput,
    restrictedTools?: Record<string, string[]>,
  ): ToolsetsInput {
    if (!restrictedTools) {
      return toolsets;
    }

    return Object.fromEntries(
      Object.entries(toolsets).map(([integrationId, tools]) => {
        if (!restrictedTools[integrationId]) {
          return [integrationId, tools];
        }

        const restrictedForIntegration = restrictedTools[integrationId];
        const availableTools = Object.fromEntries(
          Object.entries(tools).filter(([toolName]) =>
            !restrictedForIntegration.includes(toolName)
          ),
        );

        return [integrationId, availableTools];
      }),
    );
  }

  async generate(
    payload: AIMessage[],
    options?: GenerateOptions,
  ): Promise<GenerateTextResult<any, any>> {
    const toolsets = await this.withToolOverrides(options?.tools);

    const agent = this.withAgentOverrides(options);

    return agent.generate(payload, {
      ...this.thread,
      maxSteps: this.maxSteps(),
      maxTokens: this.maxTokens(),
      instructions: options?.instructions,
      toolsets,
    }) as Promise<GenerateTextResult<any, any>>;
  }

  private maxSteps(): number {
    return Math.min(
      this._configuration?.max_steps ?? DEFAULT_MAX_STEPS,
      MAX_STEPS,
    );
  }

  private maxTokens(): number {
    return Math.min(
      this._configuration?.max_tokens ?? DEFAULT_MAX_TOKENS,
      MAX_TOKENS,
    );
  }

  private async withToolOverrides(
    restrictedTools?: Record<string, string[]>,
    timings?: ServerTimingsBuilder,
  ): Promise<ToolsetsInput> {
    const getThreadToolsTiming = timings?.start("get-thread-tools");
    const tool_set = await this.getThreadTools();
    getThreadToolsTiming?.end();
    const pickCallableToolsTiming = timings?.start("pick-callable-tools");
    const toolsets = await this.pickCallableTools(tool_set);
    pickCallableToolsTiming?.end();
    const filtered = this.filterToolsets(toolsets, restrictedTools);
    return filtered;
  }

  private withAgentOverrides(options?: GenerateOptions): Agent {
    let agent = this.agent;

    if (!options) {
      return agent;
    }

    if (options.model) {
      const { llm } = this.createLLM({
        model: options.model,
        bypassOpenRouter: options.bypassOpenRouter,
      });
      // TODO(@mcandeia) for now, token limiter is not being used because we are avoiding instantiating a new memory.
      agent = new Agent({
        memory: this.memory,
        name: this._configuration?.name ?? ANONYMOUS_NAME,
        instructions: this._configuration?.instructions ??
          ANONYMOUS_INSTRUCTIONS,
        model: llm,
      });
    }

    return agent;
  }

  async onBeforeInvoke(
    opts: InvokeMiddlewareOptions,
    next: (opts: InvokeMiddlewareOptions) => Promise<Response>,
  ) {
    const timings = createServerTimings();
    const methodTiming = timings.start(`actor-${opts.method}`);
    const response = await next({
      ...opts,
      metadata: { ...opts?.metadata ?? {}, timings },
    });
    methodTiming.end();
    try {
      response.headers.set("Server-Timing", timings.printTimings());
    } catch {
      // some headers are immutable
    }
    return response;
  }

  async stream(
    payload: AIMessage[],
    options?: StreamOptions,
  ): Promise<Response> {
    const tracer = trace.getTracer("stream-tracer");

    const timings = this.metadata?.timings ?? createServerTimings();

    /*
     * Additional context from the payload, through annotations (converting to a CoreMessage-like object)
     * TODO (@0xHericles) We should find a way to extend the Message Object
     * See https://github.com/vercel/ai/discussions/3284
     */
    const context = payload.flatMap((message) =>
      Array.isArray(message.annotations)
        ? message.annotations.map((annotation) => ({
          role: "user" as const,
          content: typeof annotation === "string"
            ? annotation
            : JSON.stringify(annotation),
        }))
        : []
    );

    const toolsets = await this.withToolOverrides(options?.tools, timings);
    const agentOverridesTiming = timings.start("agent-overrides");
    const agent = this.withAgentOverrides(options);
    agentOverridesTiming.end();

    const wallet = this.wallet;
    const walletTiming = timings.start("init-wallet");
    const hasBalance = await wallet.canProceed();
    walletTiming.end();

    if (!hasBalance) {
      throw new Error("Insufficient funds");
    }

    const ttfbSpan = tracer.startSpan("stream-ttfb", {
      attributes: {
        "agent.id": this.state.id,
        model: options?.model ?? this._configuration?.model ??
          DEFAULT_MODEL,
        "thread.id": this.thread.threadId,
        "openrouter.bypass": `${options?.bypassOpenRouter ?? false}`,
      },
    });
    let ended = false;
    const endTtfbSpan = () => {
      if (ended) {
        return;
      }
      ended = true;
      ttfbSpan.end();
    };
    const streamTiming = timings.start("stream");

    const experimentalTransform = options?.smoothStream
      ? smoothStream({
        delayInMs: options.smoothStream.delayInMs,
        chunking: options.smoothStream.chunking,
      })
      : undefined;

    const maxLimit = Math.max(MAX_TOKENS, this.maxTokens());
    const budgetTokens = Math.min(
      MAX_THINKING_TOKENS,
      maxLimit - this.maxTokens(),
    );

    const response = await agent.stream(payload, {
      ...this.thread,
      context,
      toolsets,
      instructions: options?.instructions,
      maxSteps: this.maxSteps(),
      maxTokens: this.maxTokens(),
      experimental_transform: experimentalTransform,
      providerOptions: budgetTokens > MIN_THINKING_TOKENS
        ? {
          anthropic: {
            thinking: {
              type: "enabled",
              budgetTokens,
            },
          },
        }
        : {},
      ...(typeof options?.lastMessages === "number"
        ? {
          memoryOptions: {
            lastMessages: options.lastMessages,
            semanticRecall: false,
          },
        }
        : {}),
      onChunk: () => {
        endTtfbSpan();
      },
      onError: () => {
        // TODO(@mcandeia): add error tracking with posthog
      },
      onFinish: (result) => {
        wallet.computeLLMUsage({
          userId: this.metadata?.principal?.id,
          usage: result.usage,
          threadId: this.thread.threadId,
          model: this._configuration?.model ?? DEFAULT_MODEL,
          agentName: this._configuration?.name ?? ANONYMOUS_NAME,
        });
      },
    });
    streamTiming.end();

    const dataStreamResponseTiming = timings.start("data-stream-response");
    const dataStreamResponse = response.toDataStreamResponse({
      sendReasoning: options?.sendReasoning,
      getErrorMessage: (error) => {
        if (error == null) {
          return "unknown error";
        }

        if (typeof error === "string") {
          return error;
        }

        if (error instanceof Error) {
          return error.message;
        }

        return JSON.stringify(error);
      },
    });
    dataStreamResponseTiming.end();

    return dataStreamResponse;
  }

  async *streamText(
    payload: AIMessage[],
  ): AsyncIterableIterator<TextStreamPart<any>, StreamTextResult<any, any>> {
    const tool_set = await this.getThreadTools();
    const toolsets = await this.pickCallableTools(tool_set);

    const response = await this.agent.stream(payload, {
      ...this.thread,
      maxSteps: this.maxSteps(),
      maxTokens: this.maxTokens(),
      toolsets,
    });

    // check this
    yield* response.fullStream;
    // @ts-ignore: this is a bug in the types
    return response;
  }

  walletClient() {
    if (!this.wallet) {
      throw new Error("Wallet not initialized");
    }

    return this.wallet.client;
  }
}
