// deno-lint-ignore-file no-explicit-any
import type { ActorState } from "@deco/actors";
import { Actor } from "@deco/actors";
import { SUPABASE_URL } from "@deco/sdk/auth";
import {
  AppContext,
  AuthorizationClient,
  fromWorkspaceString,
  MCPClient,
  MCPClientStub,
  PolicyClient,
  WorkspaceTools,
} from "@deco/sdk/mcp";
import { getTwoFirstSegments, type Workspace } from "@deco/sdk/path";
import { Json } from "@deco/sdk/storage";
import { createServerClient } from "@supabase/ssr";
import { Cloudflare } from "cloudflare";
import { getRuntimeKey } from "hono/adapter";
import { dirname } from "node:path/posix";
import process from "node:process";
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
  internalCall?: boolean;
}

function mapTriggerToTriggerData(
  trigger: Awaited<
    ReturnType<MCPClientStub<WorkspaceTools>["TRIGGERS_GET"]>
  >,
): TriggerData | null {
  if (!trigger) {
    return null;
  }

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
    ...trigger.data,
  } as TriggerData;
}

@Actor()
export class Trigger {
  public metadata?: TriggerMetadata;
  public mcpClient: MCPClientStub<WorkspaceTools>;

  protected data: TriggerData | null = null;
  public agentId: string;
  protected hooks: TriggerHooks<TriggerData> | null = null;
  protected workspace: Workspace;
  private db: ReturnType<typeof createServerClient>;

  constructor(public state: ActorState, protected env: any) {
    this.env = {
      ...process.env,
      ...this.env,
    };
    this.agentId = dirname(dirname(this.state.id)); // strip /triggers/$triggerId
    this.workspace = getTwoFirstSegments(this.state.id);
    this.db = createServerClient(
      SUPABASE_URL,
      this.env.SUPABASE_SERVER_TOKEN,
      { cookies: { getAll: () => [] } },
    );

    this.mcpClient = this.createMCPClient();

    state.blockConcurrencyWhile(async () => {
      try {
        const loadedData = await this.loadData();
        if (loadedData) {
          this.setData(loadedData);
        }
      } catch (error) {
        console.error("Error loading data from Supabase:", error);
      }
    });
  }

  private createMCPClient() {
    const policyClient = PolicyClient.getInstance(this.db);
    const authorizationClient = new AuthorizationClient(policyClient);
    return MCPClient.forContext({
      envVars: this.env,
      db: this.db,
      isLocal: true,
      stub: this.state.stub as AppContext["stub"],
      workspace: fromWorkspaceString(this.workspace),
      cf: new Cloudflare({ apiToken: this.env.CF_API_TOKEN }),
      params: {},
      policy: policyClient,
      authorization: authorizationClient,
    });
  }

  private async loadData(): Promise<TriggerData | null> {
    const triggerData = await this.mcpClient.TRIGGERS_GET({
      id: this.getTriggerId(),
    });

    if (!triggerData) {
      return null;
    }

    return mapTriggerToTriggerData(triggerData);
  }

  enrichMetadata(metadata: TriggerMetadata, req: Request): TriggerMetadata {
    return {
      passphrase: new URL(req.url).searchParams.get("passphrase"),
      internalCall: req.headers.get("host") === null ||
        getRuntimeKey() === "deno",
      reqUrl: req.url,
      ...metadata,
    };
  }

  private setData(data: TriggerData) {
    this.data = data;
    this.hooks = this.data ? hooks[this.data?.type ?? "cron"] : cron;
  }

  private getTriggerId() {
    return this.state.id.split("/").at(-1) || "";
  }

  private async saveRun(run: Omit<TriggerRun, "id" | "timestamp">) {
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
      runData.error = JSON.stringify(error);
    } finally {
      await this.saveRun({
        triggerId: this.getTriggerId(),
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

  async create(data: TriggerData) {
    if (this.metadata?.internalCall === false) {
      return {
        success: false,
        message: "Trigger is not allowed to be created from external sources",
      };
    }

    if (this.data) {
      return {
        success: true,
        message: "Trigger already exists",
      };
    }

    try {
      this.setData(data);
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
