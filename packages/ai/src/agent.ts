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
import type { MCPConnection, ProjectLocator } from "@deco/sdk";
import { type Agent as Configuration, Locator } from "@deco/sdk";
import { type AuthMetadata, BaseActor } from "@deco/sdk/actors";
import {
  DEFAULT_MAX_STEPS,
  DEFAULT_MAX_TOKENS,
  DEFAULT_MODEL,
  MAX_MAX_STEPS,
  MAX_MAX_TOKENS,
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
  workspaceDB,
} from "@deco/sdk/mcp";
import { slugify, toAlphanumericId } from "@deco/sdk/mcp/slugify";
import { createWalletClient } from "@deco/sdk/mcp/wallet";
import {
  createServerTimings,
  type ServerTimingsBuilder,
} from "@deco/sdk/timings";
import { resolveMentions } from "@deco/sdk/utils";
import { D1Store } from "@mastra/cloudflare-d1";
import { convertMessages, MessageList } from "@mastra/core/agent";
import type { LanguageModelUsage, UIMessage } from "ai";
import {
  convertToModelMessages,
  generateObject,
  type GenerateObjectResult,
  generateText,
  type GenerateTextResult,
  jsonSchema,
  stepCountIs,
  streamText,
  type Tool,
} from "ai";
import { getRuntimeKey } from "hono/adapter";
import process from "node:process";
import postgres from "postgres";
import { createAgentOpenAIVoice } from "./agent/audio.ts";
import {
  createLLMInstance,
  DEFAULT_ACCOUNT_ID,
  getLLMConfig,
} from "./agent/llm.ts";
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
} from "./types.ts";

const ANONYMOUS_INSTRUCTIONS =
  "You should help users to configure yourself. Users should give you your name, instructions, and optionally a model (leave it default if the user don't mention it, don't force they to set it). This is your only task for now. Tell the user that you are ready to configure yourself when you have all the information.";

const ANONYMOUS_NAME = "Anonymous";
const LOAD_TOOLS_TIMEOUT_MS = 5_000;

const MAX_MAX_MESSAGES = 30;

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

@Actor()
export class AIAgent extends BaseActor<AgentMetadata> implements IIAgent {
  /**
   * Contains all tools from all servers that have ever been enabled for this agent.
   * These tools are ready to be used. To use them, just filter using the pickCallableTools function.
   */
  protected callableToolSet: Record<string, Record<string, any>> = {};
  protected context: BindingsContext;

  public locator: ProjectLocator;
  private id: string;
  public _configuration?: Configuration;
  private agentId: string;
  private wallet: AgentWallet;
  private agentScoppedMcpClient: MCPClientStub<ProjectTools>;
  private branch: string = "main"; // TODO(@mcandeia) for now only main branch is supported
  private storePromise?: Promise<D1Store>;
  private sql: postgres.Sql;

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
    this.sql = postgres(this.actorEnv.DATABASE_URL, {
      max: 2,
    });
    this.context = toBindingsContext(this.actorEnv, this.sql);
    this.locator = Locator.asFirstTwoSegmentsOf(this.state.id);
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
      ? new SupabaseLLMVault(this._createAppContext(this.metadata))
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

  _createMCPClient(ctx?: AppContext): MCPClientStub<ProjectTools> {
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
  ): Promise<Record<string, Tool> | null> {
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
  ): Promise<Record<string, Record<string, Tool>>> {
    const tools: Record<string, Record<string, Tool>> = {};
    await Promise.all(
      Object.entries(tool_set).map(async ([connection, filterList]) => {
        const mcpId = normalizeMCPId(connection);
        const getOrCreateCallableToolSetTiming = timings?.start(
          `connect-mcp-${mcpId}`,
        );
        const timeout = new AbortController();
        const allToolsFor: Record<string, Tool> | null = await Promise.race([
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
        const toolsInput: Record<string, any> = {};
        for (const item of filterList) {
          const slug = slugify(item);
          if (slug in allToolsFor) {
            toolsInput[slug] = allToolsFor[slug];
            continue;
          }

          console.warn(`Tool ${item} not found in callableToolSet[${mcpId}]`);
        }

        tools[mcpId] = toolsInput;
      }),
    );

    return tools;
  }

  private async _initAgent(config: Configuration) {
    // Process instructions to replace prompt mentions
    const processedInstructions = await resolveMentions(
      config.instructions,
      this.locator,
      this.metadata?.mcpClient,
    );

    // Store processed instructions for later use
    this._configuration = {
      ...config,
      instructions: processedInstructions,
    };
  }

  public async _init(config?: Configuration | null) {
    config ??= await this.configuration();

    await this._initAgent(config);

    // Initialize D1Store and Memory for the Durable Object lifecycle
    await this._initializeMemoryStore();
  }

  public get _thread(): ThreadLocator {
    const threadId = this.metadata?.threadId ?? crypto.randomUUID(); // private thread with the given resource
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

  private _maxOutputTokens(override?: number): number {
    return Math.min(
      override ?? this._configuration?.max_tokens ?? DEFAULT_MAX_TOKENS,
      MAX_MAX_TOKENS,
    );
  }

  private _maxMessages(override?: number): number {
    return Math.min(
      override ??
        this._configuration?.memory?.last_messages ??
        MAX_MAX_MESSAGES,
      MAX_MAX_MESSAGES,
    );
  }

  private _temperature(override?: number): number | undefined {
    const temp = override ?? this._configuration?.temperature;
    // Only return if explicitly set, otherwise let the model use its default
    return temp !== null && temp !== undefined ? temp : undefined;
  }

  /**
   * Wraps an async function with timing and tracing instrumentation
   */
  private async _withTelemetry<T>(
    name: string,
    fn: () => Promise<T>,
    timings?: ServerTimingsBuilder,
    tracer?: any,
  ): Promise<T> {
    const [timing, span] = [timings?.start(name), tracer?.startSpan(name)];
    try {
      return await fn();
    } finally {
      timing?.end();
      span?.end();
    }
  }

  private async _withToolOverrides(
    tools?: Record<string, string[]>,
    timings?: ServerTimingsBuilder,
  ): Promise<Record<string, Record<string, Tool>>> {
    const getToolsTiming = timings?.start("get-tools");
    const tool_set = tools ?? this.getTools();
    getToolsTiming?.end();

    const pickCallableToolsTiming = timings?.start("pick-callable-tools");
    const toolsets = await this._pickCallableTools(tool_set, timings);
    pickCallableToolsTiming?.end();

    return toolsets;
  }

  private _withAgentOverrides(options?: GenerateOptions): any {
    // Simplified - no longer using Mastra Agent
    return {
      name: this._configuration?.name ?? ANONYMOUS_NAME,
      instructions: this._configuration?.instructions ?? ANONYMOUS_INSTRUCTIONS,
      model: options?.model ?? this._configuration?.model,
      bypassOpenRouter: options?.bypassOpenRouter,
    };
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
        sql: this.sql,
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

  /**
   * Initialize D1Store and Memory during Durable Object initialization
   * This runs once when the DO starts up
   */
  private _initializeMemoryStore() {
    const doInit = async () => {
      const db = await workspaceDB({
        workspaceDO: this.context.workspaceDO,
        workspace: { value: this.workspace },
        // @ts-expect-error - this is a valid field
        envVars: this.env,
      });

      // Create D1Client adapter for IWorkspaceDB
      const d1Store = new D1Store({
        client: {
          query: async (args) => {
            using result = await db.exec(args);
            return { result: result.result || [] };
          },
        },
      });
      await d1Store.init();

      return d1Store;
    };

    this.storePromise ??= doInit().catch((error) => {
      this.storePromise = undefined;
      throw error;
    });

    return this.storePromise;
  }

  /**
   * Get memory storage, initializing if needed
   * Provides retry logic if initialization failed during _init
   */
  private _getMemoryStore() {
    return this._initializeMemoryStore();
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
    const storage = await this._getMemoryStore();
    const now = new Date();
    const threadData = {
      id: thread.threadId,
      resourceId: thread.resourceId,
      title: thread.title || "New chat",
      metadata: thread.metadata,
      createdAt: now,
      updatedAt: now,
    };
    await storage.saveThread({ thread: threadData });
    return {
      threadId: threadData.id,
      resourceId: threadData.resourceId,
      title: threadData.title,
      metadata: threadData.metadata,
    };
  }

  /**
   * Ensures a thread exists, creating it if necessary
   * @param threadId - The thread ID
   * @param resourceId - The resource ID
   * @param title - Optional thread title
   * @returns The memory store instance
   */
  private async _ensureThread(
    threadId: string,
    resourceId: string,
    title?: string,
  ): Promise<D1Store> {
    const store = await this._getMemoryStore();

    // Check if thread already exists
    const existingThread = await store.getThreadById({ threadId });

    if (!existingThread) {
      const now = new Date();
      await store.saveThread({
        thread: {
          id: threadId,
          resourceId,
          title: title || "New chat",
          metadata: { agentId: this.agentId },
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    return store;
  }

  async query(options?: ThreadQueryOptions): Promise<UIMessage[]> {
    const storage = await this._getMemoryStore();
    const threadId = options?.threadId ?? this._thread.threadId;
    const resourceId = options?.resourceId ?? this._thread.resourceId;

    // Get messages from storage (adapter handles conversion)
    const messages = await storage.getMessages({
      threadId,
      resourceId,
      format: "v2",
    });

    return convertMessages(messages).to("AIV5.UI");
  }

  async speak(text: string, options?: { voice?: string; speed?: number }) {
    if (!this.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured for speech generation");
    }

    try {
      const voiceHandler = createAgentOpenAIVoice({
        apiKey: this.env.OPENAI_API_KEY,
      });

      const audioBuffer = await voiceHandler.speak(text, options);

      // Convert Uint8Array to ReadableStream for compatibility
      return new ReadableStream({
        start(controller) {
          controller.enqueue(audioBuffer);
          controller.close();
        },
      });
    } catch (error) {
      this._trackEvent("agent_generate_error", {
        error: serializeError(error),
        method: "speak",
      });
      throw error;
    }
  }

  async listen(buffer: Uint8Array) {
    if (!this.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured for speech transcription");
    }

    try {
      const voiceHandler = createAgentOpenAIVoice({
        apiKey: this.env.OPENAI_API_KEY,
      });

      return await voiceHandler.listen(buffer);
    } catch (error) {
      this._trackEvent("agent_generate_error", {
        error: serializeError(error),
        method: "listen",
      });
      throw error;
    }
  }

  public getTools(): Configuration["tools_set"] {
    return this._configuration?.tools_set ?? {};
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

      const toolSet = this.getTools();

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

  public get thread(): { threadId: string; resourceId: string } {
    const threadId = this.metadata?.threadId ?? crypto.randomUUID(); // private thread with the given resource
    return {
      threadId,
      resourceId:
        this.metadata?.resourceId ?? this.metadata?.user?.id ?? threadId,
    };
  }

  /**
   * Convert toolsets to AI SDK 5 tools format
   */
  private _convertToolsToAISDKFormat(
    toolsets: Record<string, Record<string, Tool>>,
  ): Record<string, Tool> {
    const convertedTools: Record<string, Tool> = {};

    for (const [_integrationId, toolSet] of Object.entries(toolsets)) {
      for (const [toolName, toolDef] of Object.entries(toolSet)) {
        if (toolName in convertedTools) {
          throw new Error(
            `Tool ${toolName} already exists on this agent. Please remove it from the agent's toolset.`,
          );
        }

        convertedTools[toolName] = toolDef;
      }
    }

    return convertedTools;
  }

  /**
   * Preprocesses a JSON schema to ensure all object properties are required
   * This helps ensure the LLM generates complete structured outputs
   */
  private _preprocessSchema(schema: JSONSchema7): JSONSchema7 {
    // If the schema is an object type with properties, make all properties required
    if (schema.type === "object" && schema.properties) {
      const allPropertyKeys = Object.keys(schema.properties);
      return {
        ...schema,
        required: allPropertyKeys,
      };
    }

    // Return schema unchanged if not an object or has no properties
    return schema;
  }

  async generateObject<TObject = any>(
    payload: UIMessage[],
    schema: JSONSchema7,
    options?: GenerateOptions,
  ): Promise<GenerateObjectResult<TObject>> {
    const hasBalance = await this.wallet.canProceed(this.workspace);
    if (!hasBalance) {
      this._trackEvent("agent_insufficient_funds_error", {
        error: "Insufficient funds for generateObject",
        method: "generateObject",
      });
      throw new Error("Insufficient funds");
    }

    const thread = {
      threadId: this._thread.threadId,
      resourceId: this._thread.resourceId,
    };

    const tracer = (this as any).telemetry?.tracer;
    const timings = this.metadata?.timings ?? createServerTimings();

    // Parallelize independent operations
    const parallelTiming = timings.start("parallel-preprocessing");

    const agentInstructions =
      options?.instructions ?? this._configuration?.instructions;

    type LLMConfig = Awaited<ReturnType<typeof getLLMConfig>>;
    type StorageResult = { store: any; threadMessages: any[] };

    const [
      agentOverrides,
      processedInstructions,
      llmConfig,
      { store, threadMessages },
    ]: [any, string | undefined, LLMConfig, StorageResult] = await Promise.all([
      // Get agent overrides
      Promise.resolve(
        this._withAgentOverrides({
          ...options,
          bypassOpenRouter: options?.bypassOpenRouter || false,
        }),
      ),

      // Resolve instructions mentions if provided
      this._withTelemetry(
        "resolve-instructions-mentions",
        async () => {
          if (!agentInstructions) return undefined;
          return await resolveMentions(
            agentInstructions,
            this.locator,
            this.metadata?.mcpClient,
          );
        },
        timings,
        tracer,
      ),

      // Get LLM configuration
      this._withTelemetry(
        "get-llm-config",
        async () =>
          await getLLMConfig({
            modelId:
              options?.model ?? this._configuration?.model ?? DEFAULT_MODEL.id,
            llmVault: this.llmVault,
          }),
        timings,
        tracer,
      ),

      // Initialize storage and ensure thread exists
      this._withTelemetry(
        "init-storage-and-thread",
        async (): Promise<StorageResult> => {
          const title =
            payload[0]?.parts
              ?.find((p) => p.type === "text")
              ?.text?.slice(0, 50) || "New chat";

          const store = await this._ensureThread(
            thread.threadId,
            thread.resourceId,
            title,
          );

          const threadMessages = await store.getMessagesPaginated({
            format: "v2",
            threadId: thread.threadId,
            selectBy: {
              last: this._maxMessages(),
            },
          });

          return {
            store,
            threadMessages: threadMessages.messages,
          };
        },
        timings,
        tracer,
      ),
    ]);

    parallelTiming.end();

    // Create MessageList with historical messages and add new messages
    const messageList = new MessageList(thread);
    messageList.add(threadMessages, "memory");
    messageList.add(payload, "user");

    // Save new messages to storage
    await store.saveMessages({
      format: "v2",
      messages: messageList.get.input.v2(),
    });

    // Get all messages in AI SDK format
    const allMessages = messageList.get.all.aiV5.model();

    const { llm } = createLLMInstance({
      ...llmConfig,
      envs: this.env,
      metadata: {
        workspace: this.workspace,
        agentId: this.agentId,
        threadId: thread.threadId,
        resourceId: thread.resourceId,
      },
    });

    // Preprocess schema to ensure all properties are required
    const processedSchema = this._preprocessSchema(schema);

    // Use AI SDK 5's generateObject for structured data generation
    const result = await generateObject({
      model: llm,
      system: processedInstructions ?? agentOverrides.instructions,
      messages: allMessages,
      schema: jsonSchema(processedSchema),
      mode: "json",
      maxRetries: 1,
      temperature: this._temperature(options?.temperature),
      maxOutputTokens: this._maxOutputTokens(options?.maxTokens),
    });

    // Add result to MessageList using Mastra-compatible format
    const outputText = JSON.stringify(result.object);
    messageList.add(
      {
        role: "assistant",
        content: [{ type: "text", text: outputText }],
      },
      "response",
    );

    await store.saveMessages({
      format: "v2",
      messages: messageList.get.response.v2(),
    });

    assertConfiguration(this._configuration);
    this._handleGenerationFinish({
      threadId: thread.threadId,
      usedModelId: this._configuration.model,
      usage: result.usage,
    });

    return result as unknown as GenerateObjectResult<TObject>;
  }

  async generate(
    payload: UIMessage[],
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

    const thread = {
      threadId: options?.threadId ?? this._thread.threadId,
      resourceId: options?.resourceId ?? this._thread.resourceId,
    };

    const tracer = (this as any).telemetry?.tracer;
    const timings = this.metadata?.timings ?? createServerTimings();

    // Parallelize independent operations
    const parallelTiming = timings.start("parallel-preprocessing");

    const agentInstructions =
      options?.instructions ?? this._configuration?.instructions;

    const [
      toolsets,
      agentOverrides,
      processedInstructions,
      llmConfig,
      { store, threadMessages },
    ] = await Promise.all([
      // Get tools if specified
      this._withToolOverrides(options?.tools, timings),

      // Get agent overrides
      Promise.resolve(
        this._withAgentOverrides({
          ...options,
          bypassOpenRouter: options?.bypassOpenRouter || false,
        }),
      ),

      // Resolve instructions mentions if provided
      this._withTelemetry(
        "resolve-instructions-mentions",
        async () => {
          if (!agentInstructions) return undefined;
          return await resolveMentions(
            agentInstructions,
            this.locator,
            this.metadata?.mcpClient,
          );
        },
        timings,
        tracer,
      ),

      // Get LLM configuration
      this._withTelemetry(
        "get-llm-config",
        async () =>
          await getLLMConfig({
            modelId:
              options?.model ?? this._configuration?.model ?? DEFAULT_MODEL.id,
            llmVault: this.llmVault,
          }),
        timings,
        tracer,
      ),

      // Initialize storage and ensure thread exists
      this._withTelemetry(
        "init-storage-and-thread",
        async () => {
          const title =
            payload[0]?.parts
              ?.find((p) => p.type === "text")
              ?.text?.slice(0, 50) || "New chat";

          const store = await this._ensureThread(
            thread.threadId,
            thread.resourceId,
            title,
          );

          const threadMessages = await store.getMessagesPaginated({
            format: "v2",
            threadId: thread.threadId,
            selectBy: {
              last: this._maxMessages(options?.lastMessages),
            },
          });

          return {
            store,
            threadMessages: threadMessages.messages,
          };
        },
        timings,
        tracer,
      ),
    ]);

    parallelTiming.end();

    // Create MessageList with historical messages and add new messages
    const messageList = new MessageList(thread);
    messageList.add(threadMessages, "memory");
    messageList.add(payload, "user");

    // Save new messages to storage
    await store.saveMessages({
      format: "v2",
      messages: messageList.get.input.v2(),
    });

    // Get all messages in AI SDK format
    const allMessages = messageList.get.all.aiV5.model();

    const { llm } = createLLMInstance({
      ...llmConfig,
      bypassOpenRouter: options?.bypassOpenRouter,
      envs: this.env,
      metadata: {
        workspace: this.workspace,
        agentId: this.agentId,
        threadId: thread.threadId,
        resourceId: thread.resourceId,
      },
    });

    // Convert toolsets to AI SDK 5 tools format
    const tools = this._convertToolsToAISDKFormat(toolsets);

    // Use AI SDK 5's generateText
    const result = await generateText({
      model: llm,
      messages: allMessages,
      tools,
      temperature: this._temperature(options?.temperature),
      maxOutputTokens: this._maxOutputTokens(options?.maxTokens),
      system: processedInstructions ?? agentOverrides.instructions,
      stopWhen: [stepCountIs(this._maxSteps(options?.maxSteps))],
    });

    // Add result to MessageList and save assistant response to storage
    messageList.add(result.response.messages, "response");

    await store.saveMessages({
      format: "v2",
      messages: messageList.get.response.v2(),
    });

    assertConfiguration(this._configuration);
    this._handleGenerationFinish({
      threadId: thread.threadId,
      usedModelId: options?.model ?? this._configuration.model,
      usage: result.usage,
    });

    return result as unknown as GenerateTextResult<any, any>;
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

  async stream(
    messages: UIMessage[],
    metadata?: MessageMetadata,
    { threadId, resourceId } = {} as CompletionsOptions,
  ): Promise<Response> {
    try {
      const tracer = (this as any).telemetry?.tracer;
      const timings = this.metadata?.timings ?? createServerTimings();

      // Use metadata from request args instead of message metadata
      const requestMetadata = metadata || ({} as MessageMetadata);

      // Parse options from metadata
      const options: StreamOptions = {
        model: requestMetadata.model,
        instructions: requestMetadata.instructions,
        bypassOpenRouter: requestMetadata.bypassOpenRouter ?? false,
        sendReasoning: requestMetadata.sendReasoning ?? true,
        threadTitle: requestMetadata.threadTitle,
        tools: requestMetadata.tools,
        maxSteps: requestMetadata.maxSteps,
        temperature: requestMetadata.temperature,
        lastMessages: requestMetadata.lastMessages,
        maxTokens: requestMetadata.maxTokens,
        context: requestMetadata.context,
        threadId: threadId ?? this.metadata?.threadId,
        resourceId: resourceId ?? this.metadata?.resourceId,
      };

      const thread = {
        threadId: options.threadId ?? this._thread.threadId,
        resourceId: options.resourceId ?? this._thread.resourceId,
      };

      const bypassOpenRouter = options.bypassOpenRouter ?? false;

      // Context messages are additional UIMessages sent to LLM but not persisted to thread
      const contextMessages = options.context ?? [];

      // Parallelize all independent preprocessing operations
      const parallelTiming = timings.start("parallel-preprocessing");

      const [
        tools,
        hasBalance,
        processedInstructions,
        llmConfig,
        { store, threadMessages },
      ] = await Promise.all([
        // Fetch tools with overrides
        this._withToolOverrides(options.tools, timings),

        // Check wallet balance
        this._withTelemetry(
          "init-wallet",
          async () => await this.wallet.canProceed(this.workspace),
          timings,
          tracer,
        ),

        // Resolve instructions mentions if provided
        this._withTelemetry(
          "resolve-instructions-mentions",
          async () => {
            if (!options.instructions) return undefined;
            return await resolveMentions(
              options.instructions,
              this.locator,
              this.metadata?.mcpClient,
            );
          },
          timings,
          tracer,
        ),

        // Get LLM configuration
        this._withTelemetry(
          "get-llm-config",
          async () =>
            await getLLMConfig({
              modelId:
                options.model ?? this._configuration?.model ?? DEFAULT_MODEL.id,
              llmVault: this.llmVault,
            }),
          timings,
          tracer,
        ),

        // Initialize storage and ensure thread exists
        this._withTelemetry(
          "init-storage-and-thread",
          async () => {
            const title =
              options.threadTitle ||
              messages[0]?.parts
                ?.find((p) => p.type === "text")
                ?.text?.slice(0, 50) ||
              "New chat";

            const store = await this._ensureThread(
              thread.threadId,
              thread.resourceId,
              title,
            );

            const threadMessages = await store.getMessagesPaginated({
              format: "v2",
              threadId: thread.threadId,
              selectBy: {
                last: this._maxMessages(options.lastMessages),
              },
            });

            return {
              store,
              threadMessages: threadMessages.messages,
            };
          },
          timings,
          tracer,
        ),
      ]);

      parallelTiming.end();

      // Check wallet balance after parallel operations
      if (!hasBalance) {
        store;
        this._trackEvent("agent_insufficient_funds_error", {
          error: "Insufficient funds for stream",
          method: "stream",
        });
        throw new Error("Insufficient funds");
      }

      // Step 3: Perform synchronous operations with preprocessed data
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

      // Create LLM instance with preprocessed config
      const { llm } = createLLMInstance({
        ...llmConfig,
        bypassOpenRouter,
        envs: this.env,
        metadata: {
          workspace: this.workspace,
          agentId: this.agentId,
          threadId: thread.threadId,
          resourceId: thread.resourceId,
        },
      });

      // Use AI SDK 5's streamText with built-in stop conditions
      const maxSteps = this._maxSteps(options.maxSteps);

      const messageList = new MessageList(thread);
      messageList.add(threadMessages, "memory");
      messageList.add(messages, "user");

      const threadQueue: Promise<unknown> = store.saveMessages({
        format: "v2",
        messages: messageList.get.input.v2(),
      });

      // Convert toolsets to AI SDK 5 tools format
      const allTools = this._convertToolsToAISDKFormat(tools);

      const allMessages = [
        ...convertToModelMessages(contextMessages),
        ...messageList.get.all.aiV5.model(),
      ];

      const stream = streamText({
        experimental_telemetry: {
          recordInputs: true,
          recordOutputs: true,
          isEnabled: true,
          tracer,
        },
        model: llm,
        messages: allMessages,
        tools: allTools,
        temperature: this._temperature(options.temperature),
        maxOutputTokens: this._maxOutputTokens(options.maxTokens),
        system: processedInstructions,
        stopWhen: [stepCountIs(maxSteps)],
        onChunk: endTtfbSpan,
        onError: (err) => {
          console.error("agent stream error", err);
          this._trackEvent("agent_stream_error", {
            error: serializeError(err),
            threadId: thread.threadId,
            model: options.model ?? this._configuration?.model,
          });
        },
        onFinish: (result) => {
          assertConfiguration(this._configuration);
          const onFinishId = crypto.randomUUID();
          console.log("onFinish start", onFinishId);

          this._handleGenerationFinish({
            threadId: thread.threadId,
            usedModelId: options.model ?? this._configuration.model,
            usage: result.usage as unknown as LanguageModelUsage,
          });

          threadQueue.then(() => {
            console.log("saving messages");
            messageList.add(result.response.messages, "response");

            return store
              .saveMessages({
                messages: messageList.get.response.v2(),
                format: "v2",
              })
              .then(() => {
                console.log("messages saved");
              })
              .catch((err) => {
                console.error("error saving messages", err);
                throw err;
              });
          });

          console.log("onFinish await threadQueue", onFinishId);
          console.log("onFinish end", onFinishId);
        },
        onAbort: (props) => {
          console.error("stream aborted", props);
        },
      });
      streamTiming.end();

      return stream.toUIMessageStreamResponse({
        messageMetadata: ({ part }) => {
          if (part && typeof part === "object" && "finishReason" in part) {
            return {
              finishReason: part.finishReason,
            };
          }
        },
      });
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
