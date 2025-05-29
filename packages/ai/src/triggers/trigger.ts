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
import type { ActorState } from "@deco/actors";
import { Actor } from "@deco/actors";
import { SUPABASE_URL } from "@deco/sdk/auth";
import { Hosts } from "@deco/sdk/hosts";
import {
  AppContext,
  AuthorizationClient,
  fromWorkspaceString,
  MCPClient,
  MCPClientStub,
  PolicyClient,
  WorkspaceTools,
} from "@deco/sdk/mcp";
import {
  Callbacks,
  MCPBindingClient,
  TriggerInputBinding,
} from "@deco/sdk/mcp/binder";
import { getTwoFirstSegments, type Workspace } from "@deco/sdk/path";
import { getS3ServerClient, Json } from "@deco/sdk/storage";
import { createServerClient } from "@supabase/ssr";
import { Cloudflare } from "cloudflare";
import { getRuntimeKey } from "hono/adapter";
import { dirname } from "node:path/posix";
import process from "node:process";
import { AIAgent } from "../agent.ts";
import { hooks as cron } from "./cron.ts";
import type { TriggerData, TriggerRun } from "./services.ts";
import { hooks as webhook } from "./webhook.ts";

export const threadOf = (
  data: TriggerData,
  url?: URL,
): { threadId: string | undefined; resourceId: string | undefined } => {
  const resourceId = data.resourceId ?? url?.searchParams.get("resourceId") ??
    undefined;
  const threadId = url?.searchParams.get("threadId") ??
    (resourceId ? crypto.randomUUID() : undefined); // generate a random threadId if resourceId exists.
  return { threadId, resourceId };
};

export interface TriggerHooks<TData extends TriggerData = TriggerData> {
  type: TData["type"];
  onCreated?(data: TData, trigger: Trigger): Promise<void>;
  onDeleted?(data: TData, trigger: Trigger): Promise<void>;
  run(
    data: TData,
    trigger: Trigger,
    args?: unknown,
    method?: keyof Trigger | undefined,
  ): Promise<unknown>;
}

const hooks: Record<TriggerData["type"], TriggerHooks<TriggerData>> = {
  cron,
  webhook,
};

export interface TriggerMetadata {
  passphrase?: string | null;
  reqUrl?: string | null;
  reqHeaders?: Record<string, string>;
  internalCall?: boolean;
}

function mapTriggerToTriggerData(
  trigger: NonNullable<
    Awaited<
      ReturnType<MCPClientStub<WorkspaceTools>["TRIGGERS_GET"]>
    >
  >,
): TriggerData {
  return {
    id: trigger.id,
    resourceId: trigger.user.id,
    createdAt: trigger.createdAt,
    updatedAt: trigger.updatedAt,
    author: {
      id: trigger.user.id,
      name: trigger.user.metadata.full_name,
      email: trigger.user.metadata.email,
      avatar: trigger.user.metadata.avatar_url,
    },
    binding: trigger.binding,
    ...trigger.data,
  } as TriggerData;
}

export interface InvokePayload {
  args: unknown[];
  metadata?: Record<string, unknown>;
}
const buildInvokeUrl = (
  triggerId: string,
  method: keyof Trigger,
  passphrase?: string | null,
  payload?: InvokePayload,
) => {
  const invoke = new URL(
    `https://${Hosts.API}/actors/${Trigger.name}/invoke/${method}`,
  );
  invoke.searchParams.set("deno_isolate_instance_id", triggerId);

  if (passphrase) {
    invoke.searchParams.set("passphrase", passphrase);
  }
  if (payload) {
    invoke.searchParams.set(
      "args",
      encodeURIComponent(JSON.stringify(payload)),
    );
  }

  return invoke;
};

@Actor()
export class Trigger {
  public metadata?: TriggerMetadata;
  public mcpClient: MCPClientStub<WorkspaceTools>;
  public inputBinding?: MCPBindingClient<typeof TriggerInputBinding>;

  protected data: TriggerData | null = null;
  public agentId: string;
  protected hooks: TriggerHooks<TriggerData> | null = null;
  protected workspace: Workspace;
  private db: ReturnType<typeof createServerClient>;
  private env: any;
  constructor(public state: ActorState, protected actorEnv: any) {
    this.env = {
      ...process.env,
      ...actorEnv,
    };
    this.agentId = dirname(dirname(this.state.id)); // strip /triggers/$triggerId
    this.workspace = getTwoFirstSegments(this.state.id);
    this.db = createServerClient(
      SUPABASE_URL,
      this.env.SUPABASE_SERVER_TOKEN,
      { cookies: { getAll: () => [] } },
    );

    this.mcpClient = this._createMCPClient();

    state.blockConcurrencyWhile(async () => {
      try {
        const loadedData = await this._loadData();
        if (loadedData) {
          this._setData(loadedData);
        }
      } catch (error) {
        console.error("Error loading data from Supabase:", error);
      }
    });
  }

  private _createContext(): AppContext {
    const policyClient = PolicyClient.getInstance(this.db);
    const authorizationClient = new AuthorizationClient(policyClient);
    return {
      // can be ignored for now.
      user: null as unknown as AppContext["user"],
      envVars: this.env,
      db: this.db,
      isLocal: true,
      stub: this.state.stub as AppContext["stub"],
      workspace: fromWorkspaceString(this.workspace),
      cf: new Cloudflare({ apiToken: this.env.CF_API_TOKEN }),
      s3: getS3ServerClient({
        accountId: this.env.CF_ACCOUNT_ID,
        accessKeyId: this.env.CF_R2_ACCESS_KEY_ID,
        secretAccessKey: this.env.CF_R2_SECRET_ACCESS_KEY,
      }),
      params: {},
      policy: policyClient,
      authorization: authorizationClient,
    };
  }

  private _createMCPClient() {
    return MCPClient.forContext(this._createContext());
  }

  public _callbacks(
    payload?: InvokePayload,
  ): Callbacks {
    const urlFor = (method: keyof Trigger) =>
      buildInvokeUrl(this.state.id, method, this.metadata?.passphrase, payload)
        .href;

    return {
      stream: urlFor("stream"),
      generate: urlFor("generate"),
      generateObject: urlFor("generateObject"),
    };
  }
  private async _loadData(): Promise<TriggerData | null> {
    const triggerData = await this.mcpClient.TRIGGERS_GET({
      id: this._getTriggerId(),
    });

    if (!triggerData) {
      return null;
    }

    const trigger = mapTriggerToTriggerData(triggerData);
    return trigger;
  }

  private _setData(data: TriggerData) {
    this.data = data;
    if (data.binding) {
      const context = this._createContext();
      if (data.type === "webhook") {
        this.inputBinding = TriggerInputBinding.forConnection(
          data.binding.connection,
          context,
        );
      }
    }
    this.hooks = this.data ? hooks[this.data?.type ?? "cron"] : cron;
  }

  private _getTriggerId() {
    return this.state.id.split("/").at(-1) || "";
  }

  private async _saveRun(run: Omit<TriggerRun, "id" | "timestamp">) {
    await this.db
      .from("deco_chat_trigger_runs")
      .insert({
        trigger_id: run.triggerId,
        result: run.result as Json,
        metadata: run.metadata as Json,
        status: run.status,
      })
      .select("*")
      .single();
  }

  _assertsValidInvoke() {
    if (!this.data) {
      throw new Error("Trigger does not have a data");
    }
    if (!("passphrase" in this.data)) {
      return;
    }
    if (this.data.passphrase !== this.metadata?.passphrase) {
      throw new Error("Invalid passphrase");
    }
  }

  /**
   * Public method section all methods starting from here are publicly accessible
   */

  // PUBLIC METHODS

  enrichMetadata(metadata: TriggerMetadata, req: Request): TriggerMetadata {
    return {
      passphrase: new URL(req.url).searchParams.get("passphrase"),
      internalCall: req.headers.get("host") === null ||
        getRuntimeKey() === "deno",
      reqUrl: req.url,
      reqHeaders: Object.fromEntries(req.headers.entries()),
      ...metadata,
    };
  }

  async run(args?: unknown) {
    const runData: Record<string, unknown> = {};
    try {
      const data = this.data;
      runData.data = data;
      runData.metadata = this.metadata;
      if (!data) {
        return;
      }
      runData.result = await this.hooks?.run(
        data,
        this,
        args,
      );
      return runData.result;
    } catch (error) {
      console.error("Error running trigger:", error);
      runData.error = JSON.stringify(error);
    } finally {
      await this._saveRun({
        triggerId: this._getTriggerId(),
        result: runData.result as Record<string, unknown> | null,
        status: runData.error ? "error" : "success",
        metadata: {
          ...runData.metadata as Record<string, unknown> | null,
          args,
          error: runData.error,
        },
      });
    }
  }

  async alarm() {
    await this.run();
  }

  generateObject(...args: Parameters<AIAgent["generateObject"]>) {
    this._assertsValidInvoke();
    const stub = this.state.stub(AIAgent).new(this.agentId);
    return stub.generateObject(...args);
  }

  stream(...args: Parameters<AIAgent["stream"]>) {
    this._assertsValidInvoke();
    const stub = this.state.stub(AIAgent).new(this.agentId);
    return stub.stream(...args);
  }

  generate(...args: Parameters<AIAgent["generate"]>) {
    this._assertsValidInvoke();
    const stub = this.state.stub(AIAgent).new(this.agentId);
    return stub.generate(...args);
  }

  async create(data: TriggerData) {
    if (this.metadata?.internalCall === false) {
      return {
        success: false,
        message: "Trigger is not allowed to be created from external sources",
      };
    }

    try {
      this._setData(data);
      await this.hooks?.onCreated?.(data, this);

      return {
        success: true,
        message: "Trigger created successfully in Supabase",
      };
    } catch (error) {
      console.error("Error creating trigger in Supabase:", error);
      return {
        success: false,
        message: `Failed to create trigger in Supabase: ${error}`,
      };
    }
  }

  async delete() {
    if (this.metadata?.internalCall === false) {
      return {
        success: false,
        message: "Trigger is not allowed to be deleted from external sources",
      };
    }
    if (!this.data) {
      return {
        success: true,
      };
    }

    try {
      await this.hooks?.onDeleted?.(this.data, this);

      this.data = null;

      return {
        success: true,
        message: "Trigger deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting trigger:", error);
      return {
        success: false,
        message: `Failed to delete trigger: ${error}`,
      };
    }
  }
}
