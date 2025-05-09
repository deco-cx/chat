import type { Client as LibSQLClient } from "@libsql/client";
import type { StorageThreadType } from "@mastra/core";
import type { SharedMemoryConfig } from "@mastra/core/memory";
import { Memory as MastraMemory } from "@mastra/memory";
import type { Workspace } from "@deco/sdk/path";
import { toAlphanumericId } from "../utils/slugify.ts";
import { LibSQLFactory, type LibSQLFactoryOpts } from "./libsql.ts";

type CreateThreadOpts = Parameters<MastraMemory["createThread"]>[0];

interface WorkspaceMemoryConfig extends SharedMemoryConfig {
  libsqlClient: LibSQLClient;
}

interface CreateWorkspaceMemoryOpts
  extends LibSQLFactoryOpts, Omit<SharedMemoryConfig, "storage" | "vector"> {
  workspace: Workspace;
}

export class WorkspaceMemory extends MastraMemory {
  constructor(protected config: WorkspaceMemoryConfig) {
    // @ts-ignore: "ignore this for now"
    super(config);
  }

  static async buildWorkspaceMemoryOpts({
    workspace,
    tursoAdminToken,
    tursoOrganization,
    tokenStorage,
    ...opts
  }: CreateWorkspaceMemoryOpts) {
    const memoryId = buildMemoryId(workspace);

    const libsqlFactory = new LibSQLFactory({
      tursoAdminToken,
      tursoOrganization,
      tokenStorage,
    });

    const libsqlClient = await libsqlFactory.createRawClient(memoryId);

    return {
      libsqlClient,
      ...(await libsqlFactory.create({
        memoryId,
      })),
      ...opts,
    };
  }

  static async create(opts: CreateWorkspaceMemoryOpts) {
    const config = await WorkspaceMemory.buildWorkspaceMemoryOpts(opts);
    return new WorkspaceMemory(config);
  }

  async listThreads(agentId?: string) {
    try {
      const sql = agentId
        ? `SELECT * FROM mastra_threads WHERE metadata->>'agentId' = ?`
        : `SELECT * FROM mastra_threads`;
      const args = agentId ? [agentId] : [];

      const result = await this.config.libsqlClient.execute({
        sql,
        args,
      });

      if (!result.rows) {
        return [];
      }

      return result.rows.map((thread) => ({
        id: thread.id,
        resourceId: thread.resourceId,
        title: thread.title,
        createdAt: thread.createdAt,
        updatedAt: thread.updatedAt,
        metadata: typeof thread.metadata === "string"
          ? JSON.parse(thread.metadata)
          : thread.metadata,
        // deno-lint-ignore no-explicit-any
      })) as any as StorageThreadType[];
    } catch (error) {
      console.error("Error listing threads", error);
      return [];
    }
  }
}

export interface AgentMemoryConfig extends WorkspaceMemoryConfig {
  agentId: string;
}

type CreateAgentMemoryOpts = CreateWorkspaceMemoryOpts & {
  agentId: string;
};

export class AgentMemory extends WorkspaceMemory {
  constructor(protected override config: AgentMemoryConfig) {
    super(config);
  }

  override createThread(opts: CreateThreadOpts) {
    return super.createThread({
      ...opts,
      metadata: {
        ...opts.metadata,
        agentId: this.config.agentId,
      },
    });
  }

  async listAgentThreads() {
    return await this.listThreads(this.config.agentId);
  }

  static async buildAgentMemoryConfig(config: CreateAgentMemoryOpts) {
    const workspaceMemoryConfig = await WorkspaceMemory
      .buildWorkspaceMemoryOpts(config);
    return {
      ...workspaceMemoryConfig,
      agentId: config.agentId,
    };
  }

  static override async create(config: CreateAgentMemoryOpts) {
    const agentMemoryConfig = await AgentMemory.buildAgentMemoryConfig(config);
    return new AgentMemory(agentMemoryConfig);
  }
}

export function buildMemoryId(workspace: Workspace, discriminator?: string) {
  return toAlphanumericId(
    `${workspace}/${discriminator ?? "default"}`,
  );
}
