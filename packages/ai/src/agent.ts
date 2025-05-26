// deno-lint-ignore-file no-explicit-any
import { createOpenAI } from "@ai-sdk/openai";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { ActorState, InvokeMiddlewareOptions } from "@deco/actors";
import { Actor } from "@deco/actors";
import {
  type Agent as Configuration,
  DEFAULT_MODEL,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { type AuthMetadata, BaseActor } from "@deco/sdk/actors";
import { JwtIssuer, SUPABASE_URL } from "@deco/sdk/auth";
import { contextStorage } from "@deco/sdk/fetch";
import {
  AppContext,
  AuthorizationClient,
  canAccessWorkspaceResource,
  ForbiddenError,
  fromWorkspaceString,
  MCPClient,
  MCPClientStub,
  PolicyClient,
  WorkspaceTools,
} from "@deco/sdk/mcp";
import type { AgentMemoryConfig } from "@deco/sdk/memory";
import {
  AgentMemory,
  buildMemoryId,
  slugify,
  toAlphanumericId,
} from "@deco/sdk/memory";
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
import { OpenAIVoice } from "@mastra/voice-openai";
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
import { Cloudflare } from "cloudflare";
import { getRuntimeKey } from "hono/adapter";
import { join } from "node:path/posix";
import process from "node:process";
import { pickCapybaraAvatar } from "./capybaras.ts";
import { mcpServerTools } from "./mcp.ts";
import { createLLM } from "./models.ts";
import type {
  AIAgent as IIAgent,
  Message as AIMessage,
  StreamOptions,
  Thread,
  ThreadQueryOptions,
} from "./types.ts";
import { GenerateOptions } from "./types.ts";
import { AgentWallet } from "./wallet/index.ts";
import { Buffer } from "node:buffer";
import { AudioMessage } from "./index.ts";

const TURSO_AUTH_TOKEN_KEY = "turso-auth-token";
const DEFAULT_ACCOUNT_ID = "c95fc4cec7fc52453228d9db170c372c";
const DEFAULT_GATEWAY_ID = "deco-ai";
const ANONYMOUS_INSTRUCTIONS =
  "You should help users to configure yourself. Users should give you your name, instructions, and optionally a model (leave it default if the user don't mention it, don't force they to set it). This is your only task for now. Tell the user that you are ready to configure yourself when you have all the information.";

const ANONYMOUS_NAME = "Anonymous";
const LOAD_TOOLS_TIMEOUT_MS = 5_000;
const DEFAULT_TEXT_TO_SPEECH_MODEL = "tts-1";
const DEFAULT_SPEECH_TO_TEXT_MODEL = "whisper-1";
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

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
  mcpClient?: MCPClientStub<WorkspaceTools>;
}

const normalizeMCPId = (mcpId: string) => {
  return mcpId.startsWith("i:") || mcpId.startsWith("a:")
    ? mcpId.slice(2)
    : mcpId;
};

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

function isAudioMessage(message: AIMessage): message is AudioMessage {
  return "audioBase64" in message && typeof message.audioBase64 === "string";
}

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
  private db: Awaited<ReturnType<typeof createServerClient>>;
  private agentScoppedMcpClient: MCPClientStub<WorkspaceTools>;
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
    this.workspace = getWorkspace(this.state.id);
    this.wallet = new AgentWallet({
      agentId: this.id,
      agentPath: this.state.id,
      workspace: this.workspace,
      wallet: createWalletClient(this.env.WALLET_API_KEY, actorEnv?.WALLET),
    });
    this.agentMemoryConfig = null as unknown as AgentMemoryConfig;
    this.agentId = this.state.id.split("/").pop() ?? "";
    this.db = createServerClient(
      SUPABASE_URL,
      this.env.SUPABASE_SERVER_TOKEN,
      { cookies: { getAll: () => [] } },
    );

    this.agentScoppedMcpClient = this.createMCPClient();
    this.state.blockConcurrencyWhile(async () => {
      await this.runWithContext(async () => {
        await this.init();
      });
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

  public get embedder() {
    const openai = createOpenAI({
      apiKey: this.env.OPENAI_API_KEY,
    });
    return openai.embedding("text-embedding-3-small");
  }

  createAppContext(metadata?: AgentMetadata): AppContext {
    const policyClient = PolicyClient.getInstance(this.db);
    return {
      params: {},
      envVars: this.env as any,
      db: this.db,
      user: metadata?.user!,
      isLocal: metadata?.user == null,
      stub: this.state.stub as AppContext["stub"],
      cookie: metadata?.userCookie ?? undefined,
      workspace: fromWorkspaceString(this.workspace),
      cf: new Cloudflare({ apiToken: this.env.CF_API_TOKEN }),
      policy: policyClient,
      authorization: new AuthorizationClient(policyClient),
    };
  }

  createMCPClient(ctx?: AppContext) {
    return MCPClient.forContext(ctx ?? this.createAppContext(this.metadata));
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
    const ctx = this.createAppContext(this.metadata);

    // this is a weak check, but it works for now
    if (
      req.headers.get("host") !== null && runtimeKey !== "deno" &&
      this._configuration?.visibility !== "PUBLIC"
    ) { // if host is set so its not an internal request so checks must be applied
      const canAccess = await canAccessWorkspaceResource(
        "AGENTS_GET",
        null,
        ctx,
      );

      if (!canAccess) throw new ForbiddenError("Cannot access agent");
    } else if (req.headers.get("host") !== null && runtimeKey === "deno") {
      console.warn(
        "Deno runtime detected, skipping access check. This might fail in production.",
      );
    }
    // Propagate supabase token from request to integration token
    this.metadata.mcpClient = this.createMCPClient(ctx);
    enrichMetadata?.end();
    return this.metadata;
  }

  // we avoid to let the AI to set the id and tools_set, so we can keep the agent id and tools_set stable
  public async configure({
    id: _id,
    views: _views,
    ...config
  }: Partial<Configuration>): Promise<Configuration> {
    try {
      const parsed = await this.configuration();
      const updatedConfig = {
        ...parsed,
        ...config,
        avatar: config.avatar || parsed.avatar || pickCapybaraAvatar(),
      };

      await this.metadata?.mcpClient?.AGENTS_UPDATE({
        agent: updatedConfig,
        id: parsed.id,
      });

      await this.init(updatedConfig);
      this._configuration = updatedConfig;

      return updatedConfig;
    } catch (error) {
      console.error("Error configuring agent", error);
      throw new Error(`Error configuring agent: ${error}`);
    }
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
    signal?: AbortSignal,
  ): Promise<ToolsInput | null> {
    if (this.callableToolSet[mcpId]) {
      return this.callableToolSet[mcpId];
    }

    const integration = await this.metadata?.mcpClient?.INTEGRATIONS_GET({
      id: mcpId,
    });

    if (!integration) {
      return null;
    }

    const serverTools = await mcpServerTools(
      { ...integration, id: mcpId },
      this,
      signal,
      this.env as any,
    );

    if (Object.keys(serverTools ?? {}).length === 0) {
      return null;
    }

    this.callableToolSet[mcpId] = serverTools;

    return this.callableToolSet[mcpId];
  }

  protected async pickCallableTools(
    tool_set: Configuration["tools_set"],
    timings?: ServerTimingsBuilder,
  ): Promise<ToolsetsInput> {
    const tools: ToolsetsInput = {};
    await Promise.all(
      Object.entries(tool_set).map(async ([mcpId, filterList]) => {
        const getOrCreateCallableToolSetTiming = timings?.start(
          `connect-mcp-${normalizeMCPId(mcpId)}`,
        );
        const timeout = new AbortController();
        const allToolsFor = await Promise.race(
          [
            this.getOrCreateCallableToolSet(
              mcpId,
              timeout.signal,
            )
              .catch(() => {
                return null;
              }),
            new Promise((resolve) =>
              setTimeout(() => resolve(null), LOAD_TOOLS_TIMEOUT_MS)
            ).then(() => {
              // should not rely only on timeout abort because it also aborts subsequent requests
              timeout.abort();
              return null;
            }),
          ],
        );
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
      }),
    );

    return tools;
  }

  private async initMemory(
    memoryId: string,
    config: Configuration,
    tokenLimit: number,
  ) {
    if (this.memoryId !== memoryId || !this.memory) {
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
        embedder: this.embedder,
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
      voice: this.createVoiceConfig(),
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

  /**
   * Get the audio transcription of the given audio stream
   * @param audioStream - The audio stream to get the transcription of
   * @returns The transcription of the audio stream
   */
  private async getAudioTranscription(audioStream: ReadableStream) {
    const transcription = await this.agent.voice.listen(audioStream as any);
    return transcription as string;
  }

  public getAgentName() {
    return this._configuration?.name ?? ANONYMOUS_NAME;
  }

  // Warning: This method also updates the configuration in memory
  async configuration(): Promise<Configuration> {
    const client = this.metadata?.mcpClient ?? this.agentScoppedMcpClient;
    const manifest = this.agentId in WELL_KNOWN_AGENTS
      ? WELL_KNOWN_AGENTS[this.agentId as keyof typeof WELL_KNOWN_AGENTS]
      : await client.AGENTS_GET({
        id: this.agentId,
      }).catch((err) => {
        console.error("Error getting agent", err);
        return null;
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
      resourceId: this.metadata?.resourceId ?? this.metadata?.user?.id ??
        threadId,
    };
  }

  async generateObject<TObject = any>(
    payload: AIMessage[],
    jsonSchema: JSONSchema7,
  ): Promise<GenerateObjectResult<TObject>> {
    const aiMessages = await Promise.all(
      payload.map((msg) => this.convertToAIMessage(msg)),
    );
    const result = await this.agent.generate(aiMessages, {
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

  private async handleAudioTranscription(audio: {
    audioBase64: string;
  }): Promise<string> {
    const buffer = Buffer.from(audio.audioBase64, "base64");
    if (buffer.length > MAX_AUDIO_SIZE) {
      throw new Error("Audio size exceeds the maximum allowed size");
    }
    const audioStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new Uint8Array(buffer),
        );
        controller.close();
      },
    });

    const transcription = await this.getAudioTranscription(audioStream as any);

    return transcription;
  }

  async generate(
    payload: AIMessage[],
    options?: GenerateOptions,
  ): Promise<GenerateTextResult<any, any>> {
    console.log("[AGENT] payload", JSON.stringify(payload, null, 2));
    const toolsets = await this.withToolOverrides(options?.tools);

    const agent = this.withAgentOverrides(options);

    const aiMessages = await Promise.all(
      payload.map((msg) => this.convertToAIMessage(msg)),
    );
    console.log("[AGENT] aiMessages", JSON.stringify(aiMessages, null, 2));

    return agent.generate(aiMessages, {
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
    const toolsets = await this.pickCallableTools(tool_set, timings);
    pickCallableToolsTiming?.end();
    const filtered = this.filterToolsets(toolsets, restrictedTools);
    return filtered;
  }

  private createVoiceConfig() {
    if (!this.env.OPENAI_API_KEY) {
      return undefined;
    }

    return new OpenAIVoice({
      listeningModel: {
        apiKey: this.env.OPENAI_API_KEY,
        name: DEFAULT_SPEECH_TO_TEXT_MODEL as any,
      },
      speechModel: {
        apiKey: this.env.OPENAI_API_KEY,
        name: DEFAULT_TEXT_TO_SPEECH_MODEL as any,
      },
    });
  }

  private withAgentOverrides(options?: GenerateOptions): Agent {
    let agent = this.agent;
    console.log("[AGENT] withAgentOverrides", JSON.stringify(options, null, 2));
    if (!options) {
      return agent;
    }

    if (options.model) {
      console.log("[AGENT] options.model try create llm");
      const { llm } = this.createLLM({
        model: options.model,
        bypassOpenRouter: options.bypassOpenRouter,
      });
      console.log("[AGENT] llm created");
      // TODO(@mcandeia) for now, token limiter is not being used because we are avoiding instantiating a new memory.
      console.log("[AGENT] creating agent");
      agent = new Agent({
        memory: this.memory,
        name: this._configuration?.name ?? ANONYMOUS_NAME,
        instructions: this._configuration?.instructions ??
          ANONYMOUS_INSTRUCTIONS,
        model: llm,
        voice: this.createVoiceConfig(),
      });
      console.log("[AGENT] agent created");
    }

    return agent;
  }
  private runWithContext<T>(fn: () => Promise<T>) {
    return contextStorage.run({
      env: this.actorEnv,
      ctx: {
        passThroughOnException: () => {},
        waitUntil: () => {},
        props: {},
      },
    }, fn);
  }

  private async convertToAIMessage(message: AIMessage): Promise<Message> {
    if (isAudioMessage(message)) {
      const transcription = await this.handleAudioTranscription({
        audioBase64: message.audioBase64,
      });

      return {
        role: "user",
        id: crypto.randomUUID(),
        content: transcription,
      };
    }
    return message;
  }

  async onBeforeInvoke(
    opts: InvokeMiddlewareOptions,
    next: (opts: InvokeMiddlewareOptions) => Promise<Response>,
  ) {
    const timings = createServerTimings();
    const methodTiming = timings.start(`actor-${opts.method}`);
    const response = await this.runWithContext(async () => {
      return await next({
        ...opts,
        metadata: { ...opts?.metadata ?? {}, timings },
      });
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

    // if no wallet was initialized, let the stream proceed.
    // we can change this later to be more restrictive.
    const wallet = this.wallet;
    const userId = this.metadata?.user?.id;
    if (userId) {
      const walletTiming = timings.start("init-wallet");
      const hasBalance = await wallet.canProceed(userId);
      walletTiming.end();
      if (!hasBalance) {
        throw new Error("Insufficient funds");
      }
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
        // The default chunking breaks cloudflare due to using too much CPU.
        // This is a simpler function that does the job.
        chunking: (buffer) => buffer.slice(0, 5) || null,
      })
      : undefined;

    const maxLimit = Math.max(MAX_TOKENS, this.maxTokens());
    const budgetTokens = Math.min(
      MAX_THINKING_TOKENS,
      maxLimit - this.maxTokens(),
    );

    const aiMessages = await Promise.all(
      payload.map((msg) => this.convertToAIMessage(msg)),
    );

    const response = await agent.stream(
      aiMessages,
      {
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
          if (userId) {
            wallet.computeLLMUsage({
              userId,
              usage: result.usage,
              threadId: this.thread.threadId,
              model: this._configuration?.model ?? DEFAULT_MODEL,
              agentName: this._configuration?.name ?? ANONYMOUS_NAME,
            });
          }
        },
      },
    );
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

    const aiMessages = await Promise.all(
      payload.map((msg) => this.convertToAIMessage(msg)),
    );

    const response = await this.agent.stream(aiMessages, {
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

  token() {
    return JwtIssuer.forSecret(this.env.ISSUER_JWT_SECRET).create({
      sub: `agent:${this.id}`,
      aud: this.workspace,
    });
  }
}
