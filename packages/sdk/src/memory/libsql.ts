import { WebCache } from "@deco/sdk/cache";
import { singleFlight } from "@deco/sdk/common";
import { createClient } from "@libsql/client";
import type { StorageThreadType } from "@mastra/core";
import type { TABLE_NAMES } from "@mastra/core/storage";
import {
  type LibSQLConfig,
  LibSQLStore as MastraLibSQLStore,
  LibSQLVector,
} from "@mastra/libsql";
import { createClient as createTursoAPIClient } from "@tursodatabase/api";
import * as uuid from "uuid";

const sf = singleFlight();
export interface TokenStorage {
  getToken(memoryId: string): Promise<string>;
  setToken(memoryId: string, token: string): Promise<void>;
}

export class LibSQLStore extends MastraLibSQLStore {
  private threadCache: WebCache<StorageThreadType>;
  constructor(config: { config: LibSQLConfig; memoryId: string }) {
    super(config.config);
    this.threadCache = new WebCache<StorageThreadType>(
      `${config.memoryId}-threads`,
      WebCache.MAX_SAFE_TTL,
    );
  }

  override async updateThread(
    args: {
      id: string;
      title: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<StorageThreadType> {
    await this.threadCache.delete(args.id);
    return super.updateThread(args).then(async (thread) => {
      await this.threadCache.set(thread.id, thread);
      return thread;
    });
  }
  override async saveThread(
    { thread }: { thread: StorageThreadType },
  ): Promise<StorageThreadType> {
    await this.threadCache.delete(thread.id).catch(() => {
      // ignore saveThread error
      // Error untracked: Unable to delete cached response
    });
    return super.saveThread({ thread }).then(async () => {
      await this.threadCache.set(thread.id, thread);
      return thread;
    });
  }

  // deno-lint-ignore no-explicit-any
  override saveMessages(args: any): any {
    return super.saveMessages(args).then(async (messages) => {
      const threadId = messages[0].threadId;
      if (!threadId) {
        throw new Error("Thread ID is required");
      }
      const thread = await this.getThreadById({ threadId });
      if (!thread) {
        throw new Error(`Thread ${threadId} not found`);
      }

      await this.saveThread({
        thread: { ...thread, updatedAt: new Date() },
      });
      return messages;
    });
  }

  override async deleteThread(
    { threadId }: { threadId: string },
  ): Promise<void> {
    await this.threadCache.delete(threadId);
    return super.deleteThread({ threadId });
  }

  override async load<R>(
    { tableName, keys }: {
      tableName: TABLE_NAMES;
      keys: Record<string, string>;
    },
  ): Promise<R | null> {
    const byId = "id" in keys;
    if (byId) {
      const id = keys.id;
      return await sf.do(id, async () => {
        const cached = await this.threadCache.get(id);
        return cached ?? await super.load({ tableName, keys });
      }) as Promise<R | null>;
    }
    return await super.load({ tableName, keys });
  }
}

export interface LibSQLCreateStorageOpts {
  memoryId: string;
}

type AdminToken = string;

export interface LibSQLFactoryOpts {
  tursoAdminToken: string;
  tursoOrganization: string;
  tokenStorage: TokenStorage | AdminToken;
}

type TursoAPIClient = ReturnType<typeof createTursoAPIClient>;

const TURSO_GROUP = "deco-agents-v2";
/**
 * This class is used to create a LibSQLStore instance.
 * It handles the creation of the database and the authentication token.
 * It also handles the storage of the authentication token in the tokenStorage and multi-tenancy.
 */
export class LibSQLFactory {
  private turso: TursoAPIClient;
  constructor(
    public opts: LibSQLFactoryOpts,
  ) {
    this.turso = createTursoAPIClient({
      token: this.opts.tursoAdminToken,
      org: this.opts.tursoOrganization,
    });
  }

  private async database(
    memoryId: string,
  ): Promise<{ url: string; authToken: string; created: boolean }> {
    const uniqueDbName = uuid.v5(`${memoryId}-${TURSO_GROUP}`, uuid.v5.URL);
    const dbAuthToken = async (regenerate?: boolean) => {
      if (typeof this.opts.tokenStorage === "string") {
        return this.opts.tokenStorage;
      }
      const token = await this.opts.tokenStorage.getToken(uniqueDbName);
      if (token && !regenerate) {
        return token;
      }
      const newToken = await this.turso.databases.createToken(uniqueDbName);
      await this.opts.tokenStorage.setToken(uniqueDbName, newToken.jwt);
      return newToken.jwt;
    };

    const url =
      `libsql://${uniqueDbName}-${this.opts.tursoOrganization}.turso.io`;
    const { authToken, created } = await this.turso.databases.get(uniqueDbName)
      .then(
        async () => {
          return {
            authToken: await dbAuthToken(),
            created: false,
          };
        },
      ).catch(async () => {
        await this.turso.databases.create(uniqueDbName, { group: TURSO_GROUP })
          .catch((err) => {
            if (err.name === "TursoClientError" && err.status === 409) { // alreadyExists
              return; // ignore
            }
            throw err;
          });
        return {
          authToken: await dbAuthToken(true),
          created: true,
        };
      });
    return { url, authToken, created };
  }

  public async create({ memoryId }: LibSQLCreateStorageOpts): Promise<{
    storage: LibSQLStore;
    vector: LibSQLVector;
  }> {
    const { url, authToken, created } = await this.database(memoryId);

    const vector = new LibSQLVector({
      connectionUrl: url,
      authToken,
    });
    const storage = new LibSQLStore({
      memoryId,
      config: {
        url,
        authToken,
      },
    });

    // On turso create, the database is not ready to be used.
    // So we need to wait for it to be ready.
    const promise = storage.init()
      .catch((e) =>
        console.error("MASTRA tables creation failed with error", e)
      );

    if (created) {
      await promise;
    }

    return { storage, vector };
  }

  public async createRawClient(memoryId: string) {
    const { url, authToken } = await this.database(memoryId);
    return createClient({
      url,
      authToken,
    });
  }
}
