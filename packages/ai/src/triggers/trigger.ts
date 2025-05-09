// deno-lint-ignore-file no-explicit-any
import type { ActorState } from "@deco/actors";
import { Actor } from "@deco/actors";

import { dirname } from "@std/path/posix";
import { getTwoFirstSegments, type Workspace } from "@deco/sdk/path";
import * as fs from "@webdraw/fs";
import process from "node:process";
import { hooks as cron } from "./cron.ts";
import type { TriggerData } from "./services.ts";
import { hooks as webhook } from "./webhook.ts";
import { getRuntimeKey } from "hono/adapter";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL } from "@deco/sdk/auth";
import { createSupabaseStorage } from "../storage/options/supabaseStorage.ts";
import type { DecoChatStorage } from "../storage/index.ts";

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

@Actor()
export class Trigger {
  public metadata?: TriggerMetadata;
  protected data: TriggerData | null = null;
  protected fs: fs.FS;
  public agentId: string;
  protected hooks: TriggerHooks<TriggerData> | null = null;
  protected storage?: DecoChatStorage;
  protected workspace: Workspace;

  constructor(public state: ActorState, protected env: any) {
    this.env = {
      ...process.env,
      ...this.env,
    };
    this.agentId = dirname(dirname(this.state.id)); // strip /triggers/$triggerId
    this.workspace = getTwoFirstSegments(this.state.id);

    if (this.env.SUPABASE_SERVER_TOKEN) {
      this.storage = createSupabaseStorage(
        createServerClient(
          SUPABASE_URL,
          this.env.SUPABASE_SERVER_TOKEN,
          { cookies: { getAll: () => [] } },
        ),
      );
    }

    state.blockConcurrencyWhile(async () => {
      if (this.storage) {
        try {
          const loadedData = await this.loadDataFromSupabase();
          if (loadedData) {
            this.setData(loadedData);
          }
        } catch (error) {
          console.error("Error loading data from Supabase:", error);
        }
      } else {
        console.warn("Supabase storage not available for trigger");
      }
    });
  }

  private async loadDataFromSupabase(): Promise<TriggerData> {
    if (!this.storage) {
      throw new Error("Supabase storage not available");
    }

    const triggerId = this.getTriggerId();

    const triggerData = await this.storage.triggers
      ?.for(this.workspace as Workspace)
      .get(triggerId);

    if (!triggerData) {
      throw new Error("Trigger not found in Supabase");
    }

    return triggerData;
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
      await this.storage?.triggers
        ?.for(this.workspace as Workspace)
        .run({
          triggerId: this.getTriggerId(),
          result: runData.result as Record<string, unknown> | null,
          status: runData.error ? "error" : "success",
          metadata: {
            ...runData.metadata as Record<string, unknown> | null,
            args,
            error: runData.error,
          },
        }).catch((_err) => {
          // ignore
        });
    }
  }

  async alarm() {
    await this.run();
  }

  async create(data: TriggerData, agentId: string, userId: string) {
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

    if (!this.storage) {
      return {
        success: false,
        message: "Supabase storage not available",
      };
    }

    try {
      await this.storage.triggers
        ?.for(this.workspace as Workspace)
        .create(data, agentId, userId);

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

    if (!this.storage) {
      return {
        success: false,
        message: "Supabase storage not available",
      };
    }

    try {
      await this.hooks?.onDeleted?.(this.data, this);
      await this.storage.triggers
        ?.for(this.workspace as Workspace)
        .delete(this.data.id);

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
