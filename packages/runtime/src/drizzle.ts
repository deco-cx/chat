import type { DrizzleConfig } from "drizzle-orm";
import {
  drizzle as drizzleProxy,
  type SqliteRemoteDatabase,
} from "drizzle-orm/sqlite-proxy";
import { QueryResult } from "./mcp.ts";
export * from "drizzle-orm/sqlite-core";
export * as orm from "drizzle-orm";
import { sql } from "drizzle-orm";
import { DefaultEnv } from "./index.ts";

const mapGetResult = ({ result: [page] }: { result: QueryResult[] }) => {
  return page.results ?? [];
};

const mapPostResult = ({ result }: { result: QueryResult[] }) => {
  return (
    result
      .map((page) => page.results ?? [])
      .flat()
      // @ts-expect-error - this is ok, result comes as unknown
      .map(Object.values)
  );
};

export function drizzle<
  TSchema extends Record<string, unknown> = Record<string, never>,
>(
  { DECO_CHAT_WORKSPACE_DB }: Pick<DefaultEnv, "DECO_CHAT_WORKSPACE_DB">,
  config?: DrizzleConfig<TSchema>,
) {
  return drizzleProxy((sql, params, method) => {
    // https://orm.drizzle.team/docs/connect-drizzle-proxy says
    // Drizzle always waits for {rows: string[][]} or {rows: string[]} for the return value.
    // When the method is get, you should return a value as {rows: string[]}.
    // Otherwise, you should return {rows: string[][]}.
    const asRows = method === "get" ? mapGetResult : mapPostResult;
    return DECO_CHAT_WORKSPACE_DB.query({
      sql,
      params,
    }).then((result) => ({ rows: asRows(result) }));
  }, config);
}

/**
 * The following code is a custom migration system tweaked
 * from the durable-sqlite original migrator.
 *
 * @see https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-orm/src/durable-sqlite/migrator.ts
 *
 * It applies the migrations without transactions, as a workaround
 * while we don't have remote transactions support on the
 * workspace database durable object. Not ideal and we should
 * look into implementing some way of doing transactions soon.
 */

export interface MigrationMeta {
  sql: string[];
  folderMillis: number;
  hash: string;
  bps: boolean;
}

export interface MigrationConfig {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
  };
  migrations: Record<string, string>;
  /**
   * Prefix for the migrations table name.
   * Can be used to support multiple schemas in the same database.
   */
  namespace?: string;
  debug?: boolean;
}

function readMigrationFiles({
  journal,
  migrations,
}: MigrationConfig): MigrationMeta[] {
  const migrationQueries: MigrationMeta[] = [];

  for (const journalEntry of journal.entries) {
    const query =
      migrations[`m${journalEntry.idx.toString().padStart(4, "0")}`];

    if (!query) {
      throw new Error(`Missing migration: ${journalEntry.tag}`);
    }

    try {
      const result = query.split("--> statement-breakpoint").map((it) => {
        return it;
      });

      migrationQueries.push({
        sql: result,
        bps: journalEntry.breakpoints,
        folderMillis: journalEntry.when,
        hash: "",
      });
    } catch {
      throw new Error(`Failed to parse migration: ${journalEntry.tag}`);
    }
  }

  return migrationQueries;
}

export async function migrateWithoutTransaction(
  db: SqliteRemoteDatabase,
  config: MigrationConfig,
): Promise<void> {
  const debug = config.debug ?? false;

  if (debug) console.log("Migrating database");
  const migrations = readMigrationFiles(config);
  if (debug) console.log("Migrations", migrations);

  try {
    if (debug) console.log("Setting up migrations table");
    const migrationsTable = config.namespace
      ? `${config.namespace}__drizzle_migrations`
      : "__drizzle_migrations";

    // Create migrations table if it doesn't exist
    // Note: Changed from SERIAL to INTEGER PRIMARY KEY AUTOINCREMENT for SQLite compatibility
    const migrationTableCreate = sql`
            CREATE TABLE IF NOT EXISTS ${sql.identifier(migrationsTable)} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash text NOT NULL,
                created_at numeric
            )
        `;
    await db.run(migrationTableCreate);

    // Get the last applied migration
    const dbMigrations = await db.values<[number, string, string]>(
      sql`SELECT id, hash, created_at FROM ${sql.identifier(migrationsTable)} ORDER BY created_at DESC LIMIT 1`,
    );

    const lastDbMigration = dbMigrations[0] ?? undefined;
    if (debug) console.log("Last applied migration:", lastDbMigration);

    // Apply pending migrations sequentially (without transaction wrapper)
    for (const migration of migrations) {
      const hasNoMigrations =
        lastDbMigration === undefined || !lastDbMigration.length;
      if (
        hasNoMigrations ||
        Number(lastDbMigration[2])! < migration.folderMillis
      ) {
        if (debug) console.log(`Applying migration: ${migration.folderMillis}`);

        try {
          // Execute all statements in the migration
          for (const stmt of migration.sql) {
            if (stmt.trim()) {
              // Skip empty statements
              if (debug)
                console.log("Executing:", stmt.substring(0, 100) + "...");
              await db.run(sql.raw(stmt));
            }
          }

          // Record successful migration
          await db.run(
            sql`INSERT INTO ${sql.identifier(
              migrationsTable,
            )} ("hash", "created_at") VALUES(${migration.hash}, ${migration.folderMillis})`,
          );

          if (debug)
            console.log(
              `✅ Migration ${migration.folderMillis} applied successfully`,
            );
        } catch (migrationError: unknown) {
          console.error(
            `❌ Migration ${migration.folderMillis} failed:`,
            migrationError,
          );
          throw new Error(
            `Migration failed at ${migration.folderMillis}: ${migrationError instanceof Error ? migrationError.message : String(migrationError)}`,
          );
        }
      } else {
        if (debug)
          console.log(
            `⏭️ Skipping already applied migration: ${migration.folderMillis}`,
          );
      }
    }

    if (debug) console.log("✅ All migrations completed successfully");
  } catch (error: unknown) {
    console.error("❌ Migration process failed:", error);
    throw error;
  }
}
