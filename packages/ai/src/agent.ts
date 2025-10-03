// deno-lint-ignore-file no-explicit-any

// NOTE:
// Do not use private class fields or methods prefixed with '#'.
// JavaScript's private syntax (#) is not compatible with Proxy objects,
// as it enforces that 'this' must be the original instance, not a proxy.
// This will cause runtime errors like:
//   TypeError: Receiver must be an instance of class ...
//
// Instead, use a leading underscore (_) to indicate a method or property is private.
// Also, visibility modifiers (like 'private' or 'protected') from TypeScript
// are not enforced at runtime in JavaScript and are not preserved in the transpiled output.

import type { JSONSchema7 } from "@ai-sdk/provider";
import type { ActorState, InvokeMiddlewareOptions } from "@deco/actors";
import { Actor } from "@deco/actors";
import { type Agent as Configuration, Locator } from "@deco/sdk";
import { type AuthMetadata, BaseActor } from "@deco/sdk/actors";
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_MAX_THINKING_TOKENS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MEMORY,
  DEFAULT_MODEL,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
  MIN_MAX_TOKENS,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk/constants";
import { contextStorage } from "@deco/sdk/fetch";
import {
  type AppContext,
  assertWorkspaceResourceAccess,
  BindingsContext,
  createResourceAccess,
  fromWorkspaceString,
  MCPClient,
  type MCPClientStub,
  PrincipalExecutionContext,
  type ProjectTools,
  serializeError,
  SupabaseLLMVault,
  toBindingsContext,
} from "@deco/sdk/mcp";
import type { AgentMemoryConfig } from "@deco/sdk/memory";
import { AgentMemory, slugify, toAlphanumericId } from "@deco/sdk/memory";
import { trace } from "@deco/sdk/observability";
import {
  createServerTimings,
  type ServerTimingsBuilder,
} from "@deco/sdk/timings";
import { Telemetry, type WorkingMemory } from "@mastra/core";
import type { ToolsetsInput, ToolsInput } from "@mastra/core/agent";
import { Agent } from "@mastra/core/agent";
import type { MastraMemory } from "@mastra/core/memory";
import { TokenLimiter } from "@mastra/memory/processors";
import type { LanguageModelUsage, ModelMessage, UIMessage } from "ai";
import { type GenerateObjectResult, type GenerateTextResult } from "ai";
import { getRuntimeKey } from "hono/adapter";
import jsonSchemaToZod from "json-schema-to-zod";
import process from "node:process";
import { Readable } from "node:stream";
import { z } from "zod/v3";
import type { MCPConnection, ProjectLocator } from "../../sdk/src/index.ts";
import { createWalletClient } from "../../sdk/src/mcp/wallet/index.ts";
import { resolveMentions } from "../../sdk/src/utils/prompt-mentions.ts";
import { convertToModelMessages } from "./agent/ai-message.ts";
import { createAgentOpenAIVoice } from "./agent/audio.ts";
import {
  createLLMInstance,
  DEFAULT_ACCOUNT_ID,
  getLLMConfig,
} from "./agent/llm.ts";
import { getProviderOptions } from "./agent/provider-options.ts";
import {
  shouldSummarizePDFs,
  summarizePDFMessages,
} from "./agent/summarize-pdf.ts";
import { AgentWallet } from "./agent/wallet.ts";
import { pickCapybaraAvatar } from "./capybaras.ts";
import { mcpServerTools } from "./mcp.ts";
import type {
  CompletionsOptions,
  GenerateOptions,
  AIAgent as IIAgent,
  MessageMetadata,
  StreamOptions,
  Thread,
  ThreadQueryOptions,
  Toolset,
} from "./types.ts";

const TURSO_AUTH_TOKEN_KEY = "turso-auth-token";
const ANONYMOUS_INSTRUCTIONS =
  "You should help users to configure yourself. Users should give you your name, instructions, and optionally a model (leave it default if the user don't mention it, don't force they to set it). This is your only task for now. Tell the user that you are ready to configure yourself when you have all the information.";

const ANONYMOUS_NAME = "Anonymous";
const LOAD_TOOLS_TIMEOUT_MS = 5_000;

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
  userCookie?: string | null;
  timings?: ServerTimingsBuilder;
  mcpClient?: MCPClientStub<ProjectTools>;
  toolsets?: Toolset[];
}

const normalizeMCPId = (mcpId: string | MCPConnection) => {
  if (typeof mcpId === "string") {
    return mcpId.startsWith("i:") || mcpId.startsWith("a:")
      ? mcpId.slice(2)
      : mcpId;
  }

  if ("url" in mcpId) {
    return decodeURIComponent(mcpId.url);
  }

  return crypto.randomUUID();
};

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

const assertConfiguration: (
  config: Configuration | undefined,
) => asserts config is Configuration = (config) => {
  if (!config) {
    throw new Error("Agent is not initialized");
  }
};

interface ThreadLocator {
  threadId: string;
  resourceId: string;
}

const agentWorkingMemoryToWorkingMemoryConfig = (
  workingMemory: NonNullable<Configuration["memory"]>["working_memory"],
): WorkingMemory => {
  if (!workingMemory?.enabled) {
    return { enabled: false };
  }

  const template = workingMemory.template;
  if (template) {
    try {
      const parsed = JSON.parse(template);

      // in case parsed is a string
      if (typeof parsed === "object") {
        const getSchema = new Function(
          "z",
          // @ts-ignore: jsonSchemaToZod is a function
          `return ${jsonSchemaToZod(parsed)}`,
        );
        return { enabled: true, schema: getSchema(z) };
      }

      return { enabled: true, template };
    } catch {
      // Not JSON, treat as markdown template
      return { enabled: true, template };
    }
  }
  return { enabled: true };
};

@Actor()
export class AIAgent extends BaseActor<AgentMetadata> implements IIAgent {
  private _maybeAgent?: Agent;

  /**
   * Contains all tools from all servers that have ever been enabled for this agent.
   * These tools are ready to be used. To use them, just filter using the pickCallableTools function.
   */
  protected callableToolSet: ToolsetsInput = {};
  protected context: BindingsContext;

  public locator: ProjectLocator;
  private id: string;
  public _configuration?: Configuration;
  private agentMemoryConfig: AgentMemoryConfig;
  private agentId: string;
  private wallet: AgentWallet;
  private agentScoppedMcpClient: MCPClientStub<ProjectTools>;
  private telemetry?: Telemetry;
  private branch: string = "main"; // TODO(@mcandeia) for now only main branch is supported

  constructor(
    public readonly state: ActorState,
    protected actorEnv: any,
  ) {
    super(removeNonSerializableFields(actorEnv));
    this.id = toAlphanumericId(this.state.id);
    this.env = {
      CF_ACCOUNT_ID: DEFAULT_ACCOUNT_ID,
      ...process.env,
      ...this.env,
    };
    this.context = toBindingsContext(this.actorEnv);
    this.locator = Locator.asFirstTwoSegmentsOf(this.state.id);
    this.agentMemoryConfig = null as unknown as AgentMemoryConfig;
    this.agentId = this.state.id.split("/").pop() ?? "";
    this.agentScoppedMcpClient = this._createMCPClient();
    this.wallet = new AgentWallet({
      agentId: this.id,
      agentPath: this.state.id,
      wallet: createWalletClient(this.env.WALLET_API_KEY, actorEnv?.WALLET),
    });
    this.state.blockConcurrencyWhile(async () => {
      await this._runWithContext(async () => {
        await this._init().catch((error) => {
          console.error("Error initializing agent", error);
          this._trackEvent("agent_init_error", {
            error: error.message,
          });
          throw error;
        });
      });
    });
  }

  public get workspace() {
    return Locator.adaptToRootSlug(this.locator, this.metadata?.user?.id);
  }

  private get llmVault() {
    return this.env.LLMS_ENCRYPTION_KEY
      ? new SupabaseLLMVault(
          this.context.db,
          this.env.LLMS_ENCRYPTION_KEY,
          this.workspace,
        )
      : undefined;
  }

  private _trackEvent(event: string, properties: Record<string, unknown> = {}) {
    this.context.posthog.trackEvent(event as any, {
      distinctId: this.metadata?.user?.id ?? this.id,
      $process_person_profile: this.metadata?.user !== null,
      actorId: this.id,
      actorType: "agent",
      agentId: this.agentId,
      ...properties,
    });
  }

  private _createAppContext(metadata?: AgentMetadata): AppContext {
    const workspace = fromWorkspaceString(this.workspace, this.branch);
    const { org, project } = Locator.parse(this.locator);
    const principalContext: PrincipalExecutionContext = {
      params: {},
      user: metadata?.user!,
      isLocal: metadata?.user == null,
      cookie: metadata?.userCookie ?? undefined,
      workspace,
      locator: {
        org,
        project,
        value: this.locator,
        branch: this.branch,
      },
      resourceAccess: createResourceAccess(),
    };

    return {
      ...this.context,
      ...principalContext,
    };
  }

  _createMCPClient(ctx?: AppContext) {
    return MCPClient.forContext(ctx ?? this._createAppContext(this.metadata));
  }

  public _resetCallableToolSet(mcpId?: string) {
    if (mcpId) {
      delete this.callableToolSet[mcpId];
    } else {
      this.callableToolSet = {};
    }
  }
  protected async _getOrCreateCallableToolSet(
    connection: string | MCPConnection,
    signal?: AbortSignal,
  ): Promise<ToolsInput | null> {
    const mcpId =
      typeof connection === "string" ? connection : normalizeMCPId(connection);

    if (this.callableToolSet[mcpId]) {
      return this.callableToolSet[mcpId];
    }
    const integration =
      typeof connection === "string"
        ? await this.metadata?.mcpClient?.INTEGRATIONS_GET({
            id: connection,
          })
        : { connection };

    if (!integration) {
      this._trackEvent("agent_mcp_client_error", {
        error: "Integration not found",
        integrationId: mcpId,
      });
      return null;
    }

    try {
      const serverTools = await mcpServerTools(
        { ...integration, id: mcpId, name: mcpId },
        this,
        signal,
        this.env as any,
      );

      if (Object.keys(serverTools ?? {}).length === 0) {
        return null;
      }

      this.callableToolSet[mcpId] = serverTools;

      return this.callableToolSet[mcpId];
    } catch (error) {
      console.error("Error getting server tools", error);
      this._trackEvent("agent_tool_connection_error", {
        error: serializeError(error),
        integrationId: mcpId,
      });
      throw error;
    }
  }

  protected async _pickCallableTools(
    tool_set: Configuration["tools_set"],
    timings?: ServerTimingsBuilder,
    toolsetsFromOptions?: Toolset[],
  ): Promise<ToolsetsInput> {
    const tools: ToolsetsInput = {};
    const toolsets =
      toolsetsFromOptions?.map(({ connection, filters }) => {
        return [connection, filters] as [MCPConnection, string[]];
      }) ?? [];
    await Promise.all(
      [...Object.entries(tool_set), ...toolsets].map(
        async ([connection, filterList]) => {
          const mcpId = normalizeMCPId(connection);
          const getOrCreateCallableToolSetTiming = timings?.start(
            `connect-mcp-${mcpId}`,
          );
          const timeout = new AbortController();
          const allToolsFor = await Promise.race([
            this._getOrCreateCallableToolSet(connection, timeout.signal).catch(
              (err) => {
                console.error("list tools error", err);
                this._trackEvent("agent_tool_connection_error", {
                  error: serializeError(err),
                  integrationId: mcpId,
                  method: "_pickCallableTools",
                });
                return null;
              },
            ),
            new Promise((resolve) =>
              setTimeout(() => resolve(null), LOAD_TOOLS_TIMEOUT_MS),
            ).then(() => {
              // should not rely only on timeout abort because it also aborts subsequent requests
              timeout.abort();
              return null;
            }),
          ]);
          if (!allToolsFor) {
            console.warn(`No tools found for server: ${mcpId}. Skipping.`);
            getOrCreateCallableToolSetTiming?.end("timeout"); // sinalize timeout for timings
            return;
          }
          getOrCreateCallableToolSetTiming?.end();

          if (filterList.length === 0) {
            tools[mcpId] = allToolsFor;
            return;
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
        },
      ),
    );

    return tools;
  }

  private async _initMemory(config: Configuration, tokenLimit: number) {
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

    const { id: agentId, memory } = config;

    // @ts-ignore: "ignore this for now"
    this.agentMemoryConfig = await AgentMemory.buildAgentMemoryConfig({
      agentId,
      tursoAdminToken: this.env.TURSO_ADMIN_TOKEN,
      tursoOrganization,
      tokenStorage,
      workspaceDO: this.actorEnv.WORKSPACE_DB,
      processors: [new TokenLimiter({ limit: tokenLimit })],
      openAPIKey: this.env.OPENAI_API_KEY ?? undefined,
      workspace: this.workspace,
      options: {
        threads: {
          /**
           * Thread title generation breaks the Working Memory
           * TODO(@gimenes): Bring this back once this is fixed: https://github.com/mastra-ai/mastra/issues/5354
           * Maybe we can create a custom thread title generator that uses a small LLM to generate a title.
           */
          generateTitle: false,
        },
        workingMemory: agentWorkingMemoryToWorkingMemoryConfig(
          memory?.working_memory ?? DEFAULT_MEMORY.working_memory,
        ),
        semanticRecall:
          memory?.semantic_recall ?? DEFAULT_MEMORY.semantic_recall,
        lastMessages: memory?.last_messages ?? DEFAULT_MEMORY.last_messages,
      },
    });
  }

  private async _initAgent(config: Configuration) {
    const llmConfig = await getLLMConfig({
      modelId: config.model,
      llmVault: this.llmVault,
    });

    const { llm, tokenLimit } = createLLMInstance({
      ...llmConfig,
      envs: this.env,
      metadata: {
        workspace: this.workspace,
        agentId: config.id,
        threadId: this.metadata?.threadId || "",
        resourceId: this.metadata?.resourceId || "",
      },
    });

    await this._initMemory(config, tokenLimit);

    this.telemetry = Telemetry.init({ serviceName: "agent" });
    this.telemetry.tracer = trace.getTracer("agent");

    // Process instructions to replace prompt mentions
    const processedInstructions = await resolveMentions(
      config.instructions,
      this.locator,
      this.metadata?.mcpClient,
    );

    this._maybeAgent = new Agent({
      memory: this._memory as unknown as MastraMemory,
      name: config.name,
      instructions: processedInstructions,
      model: llm,
      mastra: {
        // @ts-ignore: Mastra requires a logger, but we don't use it
        getLogger: () => undefined,
        getTelemetry: () => this.telemetry,
        generateId: () => this._memory.generateId(),
        getStorage: () => undefined,
      },
      voice: this.env.OPENAI_API_KEY
        ? createAgentOpenAIVoice({ apiKey: this.env.OPENAI_API_KEY })
        : undefined,
    });
  }

  public async _init(config?: Configuration | null) {
    config ??= await this.configuration();

    await this._initAgent(config);
  }

  private get _anonymous(): Agent {
    return new Agent({
      memory: this._memory as unknown as MastraMemory,
      name: ANONYMOUS_NAME,
      instructions: ANONYMOUS_INSTRUCTIONS,
      model: createLLMInstance({
        model: DEFAULT_MODEL.id,
        envs: this.env,
        metadata: {
          workspace: this.workspace,
          agentId: "anonymous",
        },
      }).llm,
      mastra: {
        // @ts-ignore: Mastra requires a logger, but we don't use it
        getLogger: () => undefined,
        getTelemetry: () => this.telemetry,
        generateId: () => this._memory.generateId(),
        getStorage: () => undefined,
      },
    });
  }
  private get _agent(): Agent {
    return this._maybeAgent ?? this._anonymous;
  }

  public get _memory(): AgentMemory {
    return new AgentMemory(this.agentMemoryConfig);
  }

  public get _thread(): ThreadLocator {
    const threadId = this.metadata?.threadId ?? this._memory.generateId(); // private thread with the given resource
    return {
      threadId,
      resourceId:
        this.metadata?.resourceId ?? this.metadata?.user?.id ?? threadId,
    };
  }

  private _maxSteps(override?: number): number {
    return Math.min(
      override ?? this._configuration?.max_steps ?? DEFAULT_MAX_STEPS,
      MAX_MAX_STEPS,
    );
  }

  private _maxTokens(): number {
    return Math.min(
      this._configuration?.max_tokens ?? DEFAULT_MAX_TOKENS,
      MAX_MAX_TOKENS,
    );
  }

  // Build additional context from UIMessage.parts (annotations)
  private _partsToContext(
    parts: UIMessage<MessageMetadata>["parts"] | undefined,
  ): ModelMessage[] {
    if (!parts || !Array.isArray(parts)) {
      return [];
    }

    // Extract text parts and convert to model messages
    const textParts = parts
      .filter((part: any) => part.type === "text")
      .map((part: any) => part.text)
      .filter(Boolean);

    if (textParts.length === 0) {
      return [];
    }

    // Combine all text parts into a single user message
    return [
      {
        role: "user" as const,
        content: textParts.join("\n"),
      } as ModelMessage,
    ];
  }

  private async _withToolOverrides(
    tools?: Record<string, string[]>,
    timings?: ServerTimingsBuilder,
    thread = this._thread,
    toolsetsFromOptions?: Toolset[],
  ): Promise<ToolsetsInput> {
    const getThreadToolsTiming = timings?.start("get-thread-tools");
    const tool_set = tools ?? (await this.getThreadTools(thread));
    getThreadToolsTiming?.end();

    const pickCallableToolsTiming = timings?.start("pick-callable-tools");
    const toolsets = await this._pickCallableTools(
      tool_set,
      timings,
      toolsetsFromOptions,
    );
    pickCallableToolsTiming?.end();

    return toolsets;
  }

  private async _withAgentOverrides(options?: GenerateOptions): Promise<Agent> {
    let agent = this._agent;
    if (!options) {
      return agent;
    }

    if (options.model) {
      const llmConfig = await getLLMConfig({
        modelId: options.model,
        llmVault: this.llmVault,
      });
      const { llm } = createLLMInstance({
        ...llmConfig,
        bypassOpenRouter: options.bypassOpenRouter,
        envs: this.env,
        metadata: {
          workspace: this.workspace,
          agentId: this.agentId,
          threadId: this._thread.threadId,
          resourceId: this._thread.resourceId,
        },
      });

      // TODO(@mcandeia) for now, token limiter is not being used because we are avoiding instantiating a new memory.
      agent = new Agent({
        memory: this._memory,
        name: this._configuration?.name ?? ANONYMOUS_NAME,
        model: llm,
        instructions:
          this._configuration?.instructions ?? ANONYMOUS_INSTRUCTIONS,
        voice: this.env.OPENAI_API_KEY
          ? createAgentOpenAIVoice({ apiKey: this.env.OPENAI_API_KEY })
          : undefined,
        mastra: {
          // @ts-ignore: Mastra requires a logger, but we don't use it
          getLogger: () => undefined,
          getTelemetry: () => this.telemetry,
          generateId: () => this._memory.generateId(),
          getStorage: () => undefined,
        },
      });
    }

    return agent;
  }
  private _runWithContext<T>(fn: () => Promise<T>) {
    return contextStorage.run(
      {
        env: this.actorEnv,
        ctx: {
          passThroughOnException: () => {},
          waitUntil: () => {},
          props: {},
        },
      },
      fn,
    );
  }

  _token() {
    return this.context.jwtIssuer().then((issuer) =>
      issuer.issue({
        sub: `agent:${this.id}`,
        aud: this.workspace,
      }),
    );
  }

  async _handleGenerationFinish({
    threadId,
    usedModelId,
    usage,
  }: {
    threadId: string;
    usedModelId: string;
    usage: LanguageModelUsage;
  }) {
    if (!this.metadata?.mcpClient) {
      console.error("No MCP client found, skipping usage tracking");
      this._trackEvent("agent_mcp_client_error", {
        error: "No MCP client found for usage tracking",
        method: "_handleGenerationFinish",
      });
      return;
    }
    const userId = this.metadata.user?.id;
    const { model, modelId } = await getLLMConfig({
      modelId: usedModelId,
      llmVault: this.llmVault,
    });

    await this.wallet.computeLLMUsage({
      userId,
      usage,
      threadId,
      model,
      modelId,
      workspace: this.workspace,
    });

    // Fire-and-forget: record last used for this agent
    try {
      const accessorId = this.metadata?.user?.id as string | undefined;
      if (accessorId) {
        await this.context.db.from("user_activity").insert({
          user_id: accessorId,
          resource: "agent",
          key: "id",
          value: this.agentId,
        });
      }
    } catch (err) {
      // Swallow errors to avoid impacting user flow
      console.warn("Failed to record agent last used activity", err);
    }
  }

  /**
   * Public method section all methods starting from here are publicly accessible
   */

  // PUBLIC METHODS

  async onBeforeInvoke(
    opts: InvokeMiddlewareOptions,
    next: (opts: InvokeMiddlewareOptions) => Promise<Response>,
  ) {
    const timings = opts.timings ?? createServerTimings();
    const methodTiming = timings.start(`actor-${opts.method}`);
    const response = await this._runWithContext(async () => {
      return await next({
        ...opts,
        metadata: { ...(opts?.metadata ?? {}), timings },
      });
    });
    methodTiming.end();
    return response;
  }

  override async enrichMetadata(
    m: AgentMetadata,
    req: Request,
  ): Promise<AgentMetadata> {
    const timings = m.timings;
    const enrichMetadata = timings?.start("enrichMetadata");
    this.metadata = await super.enrichMetadata(m, req);
    this.metadata.userCookie = req.headers.get("cookie");

    const runtimeKey = getRuntimeKey();
    const ctx = this._createAppContext(this.metadata);

    // this is a weak check, but it works for now
    if (
      req.headers.get("host") !== null &&
      runtimeKey !== "deno" &&
      this._configuration?.visibility !== "PUBLIC"
    ) {
      // if host is set so its not an internal request so checks must be applied
      await assertWorkspaceResourceAccess(ctx, "AGENTS_GET");
    } else if (req.headers.get("host") !== null && runtimeKey === "deno") {
      console.warn(
        "Deno runtime detected, skipping access check. This might fail in production.",
      );
    }
    // Propagate supabase token from request to integration token
    this.metadata.mcpClient = this._createMCPClient(ctx);
    enrichMetadata?.end();
    return this.metadata;
  }

  // we avoid to let the AI to set the id and tools_set, so we can keep the agent id and tools_set stable
  public async configure({
    id: _id,
    ...config
  }: Partial<Configuration>): Promise<Configuration> {
    try {
      const parsed = await this.configuration();
      const updatedConfig = {
        ...parsed,
        ...config,
        avatar: config.avatar || parsed.avatar || pickCapybaraAvatar(),
      };

      const dbConfig = await this.metadata?.mcpClient?.AGENTS_UPDATE({
        agent: updatedConfig,
        id: parsed.id,
      });

      if (!dbConfig) {
        throw new Error("Failed to update agent");
      }

      // Ensure model is always defined
      const configWithModel: Configuration = {
        ...dbConfig,
        model: dbConfig.model ?? DEFAULT_MODEL.id,
      };

      await this._initAgent(configWithModel);
      this._configuration = configWithModel;

      return configWithModel;
    } catch (error) {
      console.error("Error configuring agent", error);
      this._trackEvent("agent_configure_error", {
        error: serializeError(error),
        agentId: this.agentId,
      });
      throw new Error(`Error configuring agent: ${error}`);
    }
  }

  async createThread(thread: Thread): Promise<Thread> {
    return await this._memory.createThread({
      ...this._thread,
      ...thread,
    });
  }

  async query(
    options?: ThreadQueryOptions,
  ): Promise<UIMessage<MessageMetadata>[]> {
    const currentThreadId = this._thread;
    const { uiMessages } = await this._memory
      .query({
        ...currentThreadId,
        threadId: options?.threadId ?? currentThreadId.threadId,
      })
      .catch((error) => {
        console.error("Error querying memory", error);
        this._trackEvent("agent_memory_query_error", {
          error: serializeError(error),
          threadId: options?.threadId ?? currentThreadId.threadId,
        });
        return { uiMessages: [] };
      });

    return uiMessages as UIMessage<MessageMetadata>[];
  }

  async speak(text: string, options?: { voice?: string; speed?: number }) {
    if (!this._maybeAgent) {
      this._trackEvent("agent_generate_error", {
        error: "Agent not initialized for speak",
        method: "speak",
      });
      throw new Error("Agent not initialized");
    }

    try {
      const readableStream = await this._maybeAgent.voice.speak(text, {
        speaker: options?.voice || "echo",
        properties: {
          speed: options?.speed || 1.0,
          pitch: "default",
        },
      });

      return readableStream;
    } catch (error) {
      this._trackEvent("agent_generate_error", {
        error: serializeError(error),
        method: "speak",
      });
      throw error;
    }
  }

  async listen(buffer: Uint8Array) {
    if (!this._maybeAgent) {
      this._trackEvent("agent_generate_error", {
        error: "Agent not initialized for listen",
        method: "listen",
      });
      throw new Error("Agent not initialized");
    }
    try {
      const nodeStream = new Readable({
        read() {
          this.push(buffer);
          this.push(null);
        },
      });
      const transcription = await this._maybeAgent.voice.listen(nodeStream);
      return transcription;
    } catch (error) {
      this._trackEvent("agent_generate_error", {
        error: serializeError(error),
        method: "listen",
      });
      throw error;
    }
  }

  public async updateThreadTools(tool_set: Configuration["tools_set"]) {
    const thread = await this._memory.getThreadById(this._thread);
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

    await this._memory.saveThread({
      thread: updatedThread,
    });

    this._resetCallableToolSet();

    return {
      success: true,
      message: "Thread updated",
    };
  }

  public async getThreadTools(
    threadLocator = this._thread,
  ): Promise<Configuration["tools_set"]> {
    const thread = await this._memory
      .getThreadById(threadLocator)
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

  public getTools(): Promise<Configuration["tools_set"]> {
    return Promise.resolve(this._configuration?.tools_set ?? {});
  }

  // Warning: This method also updates the configuration in memory
  async configuration(): Promise<Configuration> {
    const client = this.metadata?.mcpClient ?? this.agentScoppedMcpClient;
    const manifest =
      this.agentId in WELL_KNOWN_AGENTS
        ? WELL_KNOWN_AGENTS[this.agentId as keyof typeof WELL_KNOWN_AGENTS]
        : await client
            .AGENTS_GET({ id: this.agentId })
            .catch((err: unknown) => {
              console.error("Error getting agent", err);
              this._trackEvent("agent_mcp_client_error", {
                error: serializeError(err),
                method: "configuration",
                agentId: this.agentId,
              });
              return null;
            });

    const merged: Configuration = {
      name: ANONYMOUS_NAME,
      instructions: ANONYMOUS_INSTRUCTIONS,
      tools_set: {},
      avatar: pickCapybaraAvatar(),
      id: crypto.randomUUID(),
      views: [],
      visibility: "WORKSPACE",
      ...manifest,
      // Ensure model is always defined
      model: manifest?.model ?? DEFAULT_MODEL.id,
    };

    this._configuration = merged;

    return this._configuration;
  }

  async callTool(toolId: string, input: any): Promise<any> {
    try {
      const [integrationId, toolName] = toolId.split(".");

      const toolSet = await this.getThreadTools();

      if (!toolSet[integrationId]) {
        this._trackEvent("agent_tool_connection_error", {
          error: `Integration ${integrationId} not found`,
          integrationId,
          toolId,
          method: "callTool",
        });
        return {
          success: false,
          message: `Integration ${integrationId} not found`,
        };
      }

      const callable = await this._pickCallableTools({
        [integrationId]: [toolName],
      });

      const tool = callable?.[integrationId]?.[toolName];
      if (!tool) {
        this._trackEvent("agent_tool_connection_error", {
          error: `Tool ${toolName} not found`,
          integrationId,
          toolName,
          toolId,
          method: "callTool",
        });
        return {
          success: false,
          message: `Tool ${toolName} not found`,
        };
      }
      const result = await tool?.execute?.(
        { context: input },
        {
          toolCallId: crypto.randomUUID(),
          messages: [],
        },
      );
      return result;
    } catch (error) {
      this._trackEvent("agent_tool_error", {
        error: serializeError(error),
        toolId,
        method: "callTool",
      });
      throw error;
    }
  }

  public get memory(): AgentMemory {
    return new AgentMemory(this.agentMemoryConfig);
  }

  public get thread(): { threadId: string; resourceId: string } {
    const threadId = this.metadata?.threadId ?? this.memory.generateId(); // private thread with the given resource
    return {
      threadId,
      resourceId:
        this.metadata?.resourceId ?? this.metadata?.user?.id ?? threadId,
    };
  }

  async generateObject<TObject = any>(
    payload: UIMessage<MessageMetadata>[],
    jsonSchema: JSONSchema7,
  ): Promise<GenerateObjectResult<TObject>> {
    const hasBalance = await this.wallet.canProceed(this.workspace);
    if (!hasBalance) {
      this._trackEvent("agent_insufficient_funds_error", {
        error: "Insufficient funds for generateObject",
        method: "generateObject",
      });
      throw new Error("Insufficient funds");
    }

    const converter = convertToModelMessages(this._agent);
    const aiMessages = await Promise.all(payload.map(converter));

    const result = (await this._agent.generateVNext(aiMessages, {
      ...this.thread,
      output: jsonSchema,
      maxSteps: this._maxSteps(),
      modelSettings: {
        temperature: this._configuration?.temperature ?? undefined,
        maxOutputTokens: this._maxTokens(),
      },
    })) as unknown as GenerateObjectResult<TObject>;

    assertConfiguration(this._configuration);
    this._handleGenerationFinish({
      threadId: this.thread.threadId,
      usedModelId: this._configuration.model,
      usage: result.usage,
    });

    return result;
  }

  async generate(
    payload: UIMessage<MessageMetadata>[],
    options?: GenerateOptions,
  ): Promise<GenerateTextResult<any, any>> {
    const hasBalance = await this.wallet.canProceed(this.workspace);
    if (!hasBalance) {
      this._trackEvent("agent_insufficient_funds_error", {
        error: "Insufficient funds for generate",
        method: "generate",
      });
      throw new Error("Insufficient funds");
    }

    const toolsets = await this._withToolOverrides(options?.tools);

    const agent = await this._withAgentOverrides({
      ...options,
      bypassOpenRouter: options?.bypassOpenRouter || false,
    });

    const converter = convertToModelMessages(this._agent);
    const aiMessages = await Promise.all(payload.map(converter));

    const result = (await agent.generateVNext(aiMessages, {
      ...this.thread,
      maxSteps: this._maxSteps(options?.maxSteps),
      modelSettings: {
        temperature: this._configuration?.temperature ?? undefined,
        maxOutputTokens: this._maxTokens(),
      },
      instructions: options?.instructions,
      toolsets,
    })) as unknown as GenerateTextResult<any, undefined>;

    assertConfiguration(this._configuration);
    this._handleGenerationFinish({
      threadId: this.thread.threadId,
      usedModelId: options?.model ?? this._configuration.model,
      usage: result.usage,
    });

    return result;
  }

  async generateThreadTitle(content: string) {
    const mcpClient = this.metadata?.mcpClient ?? this.agentScoppedMcpClient;
    const result = await mcpClient.AI_GENERATE({
      model: "openai:gpt-4.1-nano",
      messages: [
        {
          role: "user",
          content: `Generate a title for the thread that started with the following user message:
            <Rule>Make it short and concise</Rule>
            <Rule>Make it a single sentence</Rule>
            <Rule>Keep the same language as the user message</Rule>
            <Rule>Return ONLY THE TITLE! NO OTHER TEXT!</Rule>

            <UserMessage>
              ${content}
            </UserMessage>`,
        },
      ],
    });
    return result.text;
  }

  private async resolveThreadTitle(
    firstMessageContent: string,
    thread: { threadId: string; resourceId: string },
  ): Promise<string | undefined> {
    try {
      const existing = await this._memory
        .getThreadById(thread)
        .catch(() => null);

      if (existing?.title) {
        return existing.title;
      }

      const generated = await this.generateThreadTitle(firstMessageContent);
      if (existing) {
        await this._memory.saveThread({
          thread: { ...existing, title: generated },
        });
      }
      return generated;
    } catch {
      // returns undefined so mastra can generate a title
    }
  }

  async stream(
    messages: UIMessage<MessageMetadata>[],
    { threadId, resourceId } = {} as CompletionsOptions,
  ): Promise<Response> {
    try {
      const tracer = this.telemetry?.tracer;
      const timings = this.metadata?.timings ?? createServerTimings();

      // Extract all configuration from the latest message metadata
      const latestMessage = messages[messages.length - 1];
      const messageMetadata =
        latestMessage?.metadata || ({} as MessageMetadata);

      // Parse options from metadata
      const options: StreamOptions = {
        model: messageMetadata.model,
        instructions: messageMetadata.instructions,
        bypassOpenRouter: messageMetadata.bypassOpenRouter ?? false,
        sendReasoning: messageMetadata.sendReasoning ?? true,
        threadTitle: messageMetadata.threadTitle,
        tools: messageMetadata.tools,
        maxSteps: messageMetadata.maxSteps,
        pdfSummarization: messageMetadata.pdfSummarization ?? true,
        toolsets: messageMetadata.toolsets,
        annotations: messageMetadata.annotations,
        threadId: threadId ?? this.metadata?.threadId,
        resourceId: resourceId ?? this.metadata?.resourceId,
      };

      const thread = {
        threadId: options.threadId ?? this._thread.threadId,
        resourceId: options.resourceId ?? this._thread.resourceId,
      };

      const isClaude = (
        options.model ??
        this._configuration?.model ??
        ""
      ).includes("claude");

      // Check PDF in the latest message (the one being sent)
      const { hasPdf, hasMinimumSizeForSummarization } =
        shouldSummarizePDFs(latestMessage);
      let bypassOpenRouter = isClaude && hasPdf;
      bypassOpenRouter ||= options.bypassOpenRouter || false;

      // Summarize PDFs in the latest message if needed
      if (
        hasPdf &&
        options.pdfSummarization &&
        hasMinimumSizeForSummarization
      ) {
        if (!this.metadata?.mcpClient) {
          this._trackEvent("agent_mcp_client_error", {
            error: "MCP client not found for PDF summarization",
            method: "stream_pdf_summarization",
          });
          throw new Error("MCP client not found");
        }
        const summarizedLatest = await summarizePDFMessages(
          latestMessage,
          this.metadata.mcpClient,
          {
            // TODO: fallback to a custom model if this one is disabled.
            model: "openai:gpt-4.1-mini",
            maxChunkSize: 8_000,
            maxSummaryTokens: 2_000,
            maxTotalTokens: 16_000,
          },
        );
        // Replace the latest message with the summarized version
        messages = [
          ...messages.slice(0, -1),
          summarizedLatest as UIMessage<MessageMetadata>,
        ];
      }

      // Build context from annotations (passed as UIMessage.parts)
      const context = this._partsToContext(options.annotations);

      const toolsets = await this._withToolOverrides(
        options.tools,
        timings,
        thread,
        options.toolsets,
      );

      const agentOverridesTiming = timings.start("agent-overrides");
      const agent = await this._withAgentOverrides({
        model: options.model,
        instructions: options.instructions,
        maxSteps: options.maxSteps,
        bypassOpenRouter,
      });
      agentOverridesTiming.end();

      const wallet = this.wallet;
      const walletTiming = timings.start("init-wallet");
      const hasBalance = await wallet.canProceed(this.workspace);
      walletTiming.end();

      if (!hasBalance) {
        this._trackEvent("agent_insufficient_funds_error", {
          error: "Insufficient funds for stream",
          method: "stream",
        });
        throw new Error("Insufficient funds");
      }

      const ttfbSpan = tracer?.startSpan("stream-ttfb", {
        attributes: {
          "agent.id": this.state.id,
          model: options.model ?? this._configuration?.model,
          "thread.id": thread.threadId,
          "openrouter.bypass": `${bypassOpenRouter}`,
        },
      });
      let ended = false;
      const endTtfbSpan = () => {
        if (ended) {
          return;
        }
        ended = true;
        ttfbSpan?.end();
      };
      const streamTiming = timings.start("stream");

      const maxLimit = Math.max(MIN_MAX_TOKENS, this._maxTokens());
      const budgetTokens = Math.min(
        DEFAULT_MAX_THINKING_TOKENS,
        maxLimit - this._maxTokens(),
      );

      const converter = convertToModelMessages(this._agent);
      const aiMessages = await Promise.all(messages.map(converter));

      // Process instructions if provided in options
      let processedInstructions = options.instructions;
      if (processedInstructions) {
        const [resolveInstructionsTimings, resolveInstructionsSpan] = [
          timings.start("resolve-instructions-mentions"),
          tracer?.startSpan("resolve-instructions-mentions"),
        ];
        processedInstructions = await resolveMentions(
          processedInstructions,
          this.workspace,
          this.metadata?.mcpClient,
        );
        resolveInstructionsTimings.end();
        resolveInstructionsSpan?.end();
      }

      const response = await agent.streamVNext(aiMessages, {
        format: "aisdk",
        ...thread,
        context,
        toolsets,
        instructions: processedInstructions,
        maxSteps: this._maxSteps(options.maxSteps),
        modelSettings: {
          temperature: this._configuration?.temperature ?? undefined,
          maxOutputTokens: this._maxTokens(),
        },
        providerOptions: getProviderOptions({ budgetTokens }),
        onChunk: endTtfbSpan,
        onError: (err) => {
          console.error("agent stream error", err);
          this._trackEvent("agent_stream_error", {
            error: serializeError(err),
            threadId: thread.threadId,
            model: options.model ?? this._configuration?.model,
          });
        },
        memory: {
          ...this.memory,
          thread: {
            title:
              options.threadTitle ??
              (await this.resolveThreadTitle(
                latestMessage.parts
                  ?.filter((p: any) => p.type === "text")
                  .map((p: any) => p.text)
                  .join(" ") ?? "",
                thread,
              )),
            id: thread.threadId,
          },
          resource: thread.resourceId,
        },
        onFinish: (result) => {
          assertConfiguration(this._configuration);
          this._handleGenerationFinish({
            threadId: thread.threadId,
            usedModelId: options.model ?? this._configuration.model,
            usage: result.usage as unknown as LanguageModelUsage,
          });
        },
      });
      streamTiming.end();

      const dataStreamResponseTiming = timings.start("data-stream-response");
      const dataStreamResponse = response.toUIMessageStreamResponse({
        sendReasoning: options.sendReasoning,
      });
      dataStreamResponseTiming.end();

      return dataStreamResponse;
    } catch (err) {
      console.error("Error on stream", err);
      this._trackEvent("agent_stream_error", {
        error: serializeError(err),
        method: "stream_main",
      });
      throw err;
    }
  }

  public getAgentName() {
    return this._configuration?.name ?? ANONYMOUS_NAME;
  }
}
