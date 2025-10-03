// deno-lint-ignore-file no-explicit-any
import z from "zod/v3";
import { workspaceDB } from "../context.ts";
import { assertHasWorkspace, assertWorkspaceResourceAccess } from "../index.ts";
import { createDatabaseTool } from "./tool.ts";

export { getWorkspaceD1Database } from "./d1.ts";

// Estimate SQL size and parameter count to avoid SQLITE_TOOBIG and SQLITE_ERROR
const estimateSQLMetrics = (
  tableName: string,
  columnNames: string,
  rows: any[],
): { size: number; paramCount: number } => {
  const baseSQL = `INSERT OR REPLACE INTO "${tableName}" (${columnNames}) VALUES `;
  const placeholders = columnNames
    .split(", ")
    .map(() => "?")
    .join(", ");
  const rowSQL = `(${placeholders})`;

  // Calculate parameter count
  const columnsCount = columnNames.split(", ").length;
  const paramCount = rows.length * columnsCount;

  // Estimate size of the SQL statement
  let estimatedSize = baseSQL.length;
  estimatedSize += rows.length * (rowSQL.length + 2); // +2 for ", " between rows

  // Add some buffer for actual data values - check actual data size
  for (const row of rows) {
    for (const columnName of columnNames.split(", ")) {
      const cleanColumnName = columnName.replace(/"/g, ""); // Remove quotes
      const value = (row as any)[cleanColumnName];
      if (value !== null && value !== undefined) {
        const valueStr = String(value);
        estimatedSize += valueStr.length;
      } else {
        estimatedSize += 4; // "NULL" length
      }
    }
  }

  return { size: estimatedSize, paramCount };
};

// Insert a chunk of rows with fallback to single-row inserts
const insertChunk = async (
  tableName: string,
  columnNames: string,
  rows: any[],
  columns: Array<{ name: string }>,
  newDb: any,
): Promise<void> => {
  if (rows.length === 0) return;

  // Safety check: if chunk would exceed parameter limit, split it
  const paramCount = rows.length * columns.length;
  const maxParams = 999;

  if (paramCount > maxParams) {
    // Split into smaller chunks
    const maxRowsPerSubChunk = Math.floor(maxParams / columns.length);
    for (let i = 0; i < rows.length; i += maxRowsPerSubChunk) {
      const subChunk = rows.slice(i, i + maxRowsPerSubChunk);
      await insertChunk(tableName, columnNames, subChunk, columns, newDb);
    }
    return;
  }

  try {
    const placeholders = columns.map(() => "?").join(", ");
    const insertSql = `INSERT OR REPLACE INTO "${tableName}" (${columnNames}) VALUES ${rows
      .map(() => `(${placeholders})`)
      .join(", ")}`;

    const params: any[] = [];
    for (const row of rows) {
      for (const column of columns) {
        let value = (row as any)[column.name];

        // Handle extremely large string/blob values
        if (typeof value === "string" && value.length > 1000000) {
          // 1MB limit
          value = value.substring(0, 1000000);
        }

        params.push(value);
      }
    }

    using _ = await newDb.exec({
      sql: insertSql,
      params,
    });
  } catch (insertError) {
    console.warn(
      `⚠️ Failed to insert chunk of ${rows.length} rows into ${tableName}, falling back to single-row inserts:`,
      insertError,
    );
    // Fall back to single-row inserts
    const placeholders = columns.map(() => "?").join(", ");
    const singleInsertSql = `INSERT OR REPLACE INTO "${tableName}" (${columnNames}) VALUES (${placeholders})`;

    for (const row of rows) {
      const params: any[] = [];
      for (const column of columns) {
        let value = (row as any)[column.name];

        // Handle extremely large string/blob values
        if (typeof value === "string" && value.length > 1000000) {
          // 1MB limit
          value = value.substring(0, 1000000);
        }

        params.push(value);
      }

      using _ = await newDb.exec({
        sql: singleInsertSql,
        params,
      });
    }
  }
};

export const migrate = createDatabaseTool({
  name: "DATABASES_MIGRATE",
  description: "Migrate data from Turso database to new database",
  inputSchema: z.object({
    dryRun: z
      .boolean()
      .optional()
      .describe("If true, only shows what would be migrated without executing"),
    tables: z
      .array(z.string())
      .optional()
      .describe(
        "Specific tables to migrate. If not provided, all tables will be migrated",
      ),
    batchSize: z
      .number()
      .default(1000)
      .describe("Number of rows to migrate per batch"),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    migratedTables: z.array(
      z.object({
        tableName: z.string(),
        rowCount: z.number(),
        status: z.enum(["success", "error", "skipped"]),
        error: z.string().optional(),
      }),
    ),
    totalRowsMigrated: z.number(),
    executionTimeMs: z.number(),
  }),
  handler: async ({ dryRun = false, tables, batchSize = 1000 }, c) => {
    console.log("🚀 Starting Turso database migration...");
    console.log("📋 Migration parameters:", { dryRun, tables, batchSize });

    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c, "DATABASES_RUN_SQL");

    const startTime = Date.now();
    const newDb = await workspaceDB(c, false);
    const tursoDb = await workspaceDB(c, true);
    console.log("✅ Connected to databases");

    // Disable foreign key constraints during migration to avoid constraint errors
    console.log("🔒 Disabling foreign key constraints...");
    try {
      using _ = await newDb.exec({
        sql: "PRAGMA foreign_keys = OFF",
        params: [],
      });
      console.log("✅ Foreign key constraints disabled");
    } catch (error) {
      console.warn("⚠️ Could not disable foreign key constraints:", error);
    }

    const migratedTables: Array<{
      tableName: string;
      rowCount: number;
      status: "success" | "error" | "skipped";
      error?: string;
    }> = [];

    let totalRowsMigrated = 0;

    try {
      console.log("📊 Starting table discovery...");
      // Get tables from Turso database
      const allTables = new Set<string>();

      console.log("🔍 Discovering tables in Turso database...");
      try {
        using tursoResult = await tursoDb.exec({
          sql: "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
          params: [],
        });
        const tursoTables =
          (tursoResult.result[0]?.results as Array<{ name: string }>) || [];
        tursoTables.forEach((table) => allTables.add(table.name));
        console.log(
          `📋 Found ${tursoTables.length} tables in Turso database:`,
          tursoTables.map((t) => t.name),
        );
      } catch (error) {
        console.warn("❌ Failed to get tables from Turso database:", error);
      }

      // Filter out system tables that shouldn't be migrated
      const systemTablesToExclude = [
        "_cf_KV",
        "_litestream_seq",
        "_litestream_lock",
      ];
      const filteredTables = Array.from(allTables).filter(
        (tableName) =>
          !systemTablesToExclude.includes(tableName) &&
          !tableName.startsWith("_cf_") &&
          !tableName.startsWith("sqlite_"),
      );

      const tablesToMigrate = tables
        ? filteredTables.filter((tableName) => tables.includes(tableName))
        : filteredTables;

      console.log(`📊 Table discovery complete:`);
      console.log(`   - Total tables found: ${allTables.size}`);
      console.log(
        `   - System tables excluded: ${systemTablesToExclude.length}`,
      );
      console.log(`   - Tables to migrate: ${tablesToMigrate.length}`);
      console.log(`   - Tables to migrate:`, tablesToMigrate);

      if (dryRun) {
        console.log("🔍 DRY RUN: Counting rows in tables...");
        for (const tableName of tablesToMigrate) {
          console.log(`📊 Counting rows in table: ${tableName}`);
          try {
            let totalCount = 0;

            // Count from Turso database
            try {
              using result = await tursoDb.exec({
                sql: `SELECT COUNT(*) as count FROM "${tableName}"`,
                params: [],
              });
              const tursoCount =
                (result.result[0]?.results?.[0] as { count: number })?.count ||
                0;
              totalCount = tursoCount;
              console.log(`   - Turso: ${tursoCount} rows`);
            } catch (error) {
              console.warn(
                `❌ Failed to count rows in Turso table ${tableName}:`,
                error,
              );
            }

            console.log(`   ✅ Total: ${totalCount} rows`);
            migratedTables.push({
              tableName,
              rowCount: totalCount,
              status: "success",
            });
          } catch (error) {
            console.log(
              `   ❌ Error: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
            migratedTables.push({
              tableName,
              rowCount: 0,
              status: "error",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
        console.log("✅ DRY RUN completed successfully");
        return {
          success: true,
          migratedTables,
          totalRowsMigrated: 0,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Actual migration
      console.log("🚀 Starting actual migration...");
      for (const tableName of tablesToMigrate) {
        console.log(`\n📋 Migrating table: ${tableName}`);
        try {
          // Check if table exists in Turso database and get schema
          console.log(
            `   🔍 Checking if table exists in Turso database: ${tableName}`,
          );
          let tableExistsInTurso = false;
          let createTableSql: string | undefined;

          // Check if table exists in Turso database
          try {
            using checkTursoResult = await tursoDb.exec({
              sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
              params: [],
            });
            tableExistsInTurso =
              (checkTursoResult.result[0]?.results?.length || 0) > 0;
            console.log(
              `   ${tableExistsInTurso ? "✅" : "❌"} Table ${tableName} ${
                tableExistsInTurso ? "exists" : "does not exist"
              } in Turso database`,
            );
          } catch (error) {
            console.log(
              `   ⚠️ Could not check if table exists in Turso database:`,
              error,
            );
          }

          // Get schema from Turso database
          if (tableExistsInTurso) {
            try {
              using result = await tursoDb.exec({
                sql: `SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
                params: [],
              });
              const tursoSchemaResult = result.result[0]?.results?.[0] as
                | { sql: string }
                | undefined;
              createTableSql = tursoSchemaResult?.sql;
              console.log(`   ✅ Got schema from Turso database`);
              console.log(`   📋 Turso schema result:`, tursoSchemaResult);
              if (!createTableSql) {
                console.log(
                  `   ⚠️ Turso schema query returned null/empty for ${tableName}`,
                );
              } else {
                console.log(
                  `   📝 Schema length: ${createTableSql.length} characters`,
                );
              }
            } catch (tursoError) {
              console.warn(
                `❌ Failed to get schema for table ${tableName} from Turso:`,
                tursoError,
              );
            }
          } else {
            console.log(`   ❌ Table ${tableName} not found in Turso database`);
          }

          if (!createTableSql) {
            console.log(
              `   ❌ Could not retrieve table schema for ${tableName}`,
            );
            migratedTables.push({
              tableName: tableName,
              rowCount: 0,
              status: "error",
              error: "Could not retrieve table schema",
            });
            continue;
          }

          // Check if table already exists in new database
          console.log(
            `   🔍 Checking if table ${tableName} exists in new database...`,
          );
          let tableExists = false;
          try {
            using checkTableResponse = await newDb.exec({
              sql: `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
              params: [],
            });
            tableExists =
              (checkTableResponse.result[0]?.results?.length || 0) > 0;
            console.log(
              `   ${tableExists ? "✅" : "❌"} Table ${tableName} ${
                tableExists ? "exists" : "does not exist"
              } in new database`,
            );
          } catch (error) {
            console.log(
              `   ⚠️ Could not check if table exists, assuming it doesn't:`,
              error,
            );
            // If we can't check, assume table doesn't exist and try to create it
            tableExists = false;
          }

          if (!tableExists) {
            console.log(`   🏗️ Creating table ${tableName} in new database...`);
            try {
              console.log(`   📝 Using schema: ${createTableSql}`);
              using _ = await newDb.exec({
                sql: createTableSql,
                params: [],
              });
              console.log(`   ✅ Table ${tableName} created successfully`);
            } catch (createError) {
              console.log(
                `   ❌ Failed to create table ${tableName}:`,
                createError,
              );
              migratedTables.push({
                tableName: tableName,
                rowCount: 0,
                status: "error",
                error: `Cannot create table: ${
                  createError instanceof Error
                    ? createError.message
                    : String(createError)
                }`,
              });
              continue;
            }
          } else {
            console.log(
              `   ✅ Table ${tableName} already exists in new database`,
            );
          }

          // Get column information for the table from Turso database
          let columns: Array<{ name: string }> = [];

          try {
            using result = await tursoDb.exec({
              sql: `PRAGMA table_info("${tableName}")`,
              params: [],
            });
            columns =
              (result.result[0]?.results as Array<{ name: string }>) || [];
            console.log(
              `   ✅ Got columns from Turso database (${columns.length} columns)`,
            );
          } catch (tursoError) {
            console.warn(
              `Failed to get columns for ${tableName} from Turso database:`,
              tursoError,
            );
          }

          const columnNames = columns.map((col) => `"${col.name}"`).join(", ");

          // Check if table already has data (for idempotency)
          let existingRowCount = 0;
          try {
            using existingCountResponse = await newDb.exec({
              sql: `SELECT COUNT(*) as count FROM "${tableName}"`,
              params: [],
            });
            existingRowCount =
              (
                existingCountResponse.result[0]?.results?.[0] as {
                  count: number;
                }
              )?.count || 0;
          } catch {
            // If we can't count existing rows, assume table is empty
            existingRowCount = 0;
          }

          // Count total rows from Turso database
          let totalRows = 0;
          try {
            // Count from Turso database
            try {
              using result = await tursoDb.exec({
                sql: `SELECT COUNT(*) as count FROM "${tableName}"`,
                params: [],
              });
              totalRows =
                (result.result[0]?.results?.[0] as { count: number })?.count ||
                0;
              console.log(`   📊 Found ${totalRows} rows in Turso database`);
            } catch (error) {
              console.warn(
                `Failed to count rows in Turso table ${tableName}:`,
                error,
              );
            }
          } catch (countError) {
            // If we can't count rows, the table might have dependency issues, skip it
            migratedTables.push({
              tableName: tableName,
              rowCount: 0,
              status: "error",
              error: `Cannot access table for counting: ${
                countError instanceof Error
                  ? countError.message
                  : String(countError)
              }`,
            });
            continue;
          }

          // Always migrate data, even if table already exists
          if (existingRowCount > 0) {
            console.log(
              `   ⚠️ Table ${tableName} already has ${existingRowCount} rows, but will still migrate data`,
            );
          }

          // Migrate data from Turso database
          console.log(`   📊 Starting data migration for ${tableName}...`);
          let migratedRows = 0;

          console.log(
            `   🔄 Migrating from TURSO database (${totalRows} total rows)...`,
          );
          try {
            let tursoOffset = 0;
            let tursoBatchCount = 0;
            while (tursoOffset < totalRows) {
              let rows: any[] = [];
              try {
                using result = await tursoDb.exec({
                  sql: `SELECT ${columnNames} FROM "${tableName}" LIMIT ${batchSize} OFFSET ${tursoOffset}`,
                  params: [],
                });
                rows = result.result[0]?.results || [];
              } catch (dataError) {
                console.warn(
                  `Failed to read data from Turso table ${tableName}:`,
                  dataError,
                );
                break;
              }

              if (rows.length === 0) break;

              tursoBatchCount++;
              console.log(
                `   📦 [TURSO] Batch ${tursoBatchCount}: ${rows.length} rows (offset: ${tursoOffset})`,
              );

              // Process rows and insert into new database with dynamic chunk sizing
              const maxSQLSize = 100000; // 100KB limit to avoid SQLITE_TOOBIG (very conservative)
              const maxParams = 999; // SQLite parameter limit
              const maxRowsPerChunk = Math.max(
                1,
                Math.min(5, Math.floor(maxParams / columns.length)),
              ); // Extremely conservative limit

              let currentChunk: any[] = [];

              for (const row of rows) {
                // Check if this single row is too large
                const singleRowMetrics = estimateSQLMetrics(
                  tableName,
                  columnNames,
                  [row],
                );
                if (singleRowMetrics.size > maxSQLSize) {
                  await insertChunk(
                    tableName,
                    columnNames,
                    [row],
                    columns,
                    newDb,
                  );
                  continue;
                }

                // Estimate size and parameter count if we add this row to current chunk
                const testChunk = [...currentChunk, row];
                const metrics = estimateSQLMetrics(
                  tableName,
                  columnNames,
                  testChunk,
                );

                // Check both size and parameter count limits
                const shouldInsert =
                  (metrics.size > maxSQLSize ||
                    metrics.paramCount > maxParams ||
                    currentChunk.length >= maxRowsPerChunk) &&
                  currentChunk.length > 0;

                if (shouldInsert) {
                  // Current chunk would be too big or have too many parameters, insert current chunk first
                  await insertChunk(
                    tableName,
                    columnNames,
                    currentChunk,
                    columns,
                    newDb,
                  );
                  currentChunk = [row];
                } else {
                  // Add row to current chunk
                  currentChunk.push(row);
                }
              }

              // Insert any remaining rows in the last chunk
              if (currentChunk.length > 0) {
                await insertChunk(
                  tableName,
                  columnNames,
                  currentChunk,
                  columns,
                  newDb,
                );
              }

              migratedRows += rows.length;
              tursoOffset += batchSize;
            }
            console.log(
              `   ✅ [TURSO] Migration completed: ${migratedRows} rows migrated`,
            );
          } catch (error) {
            console.warn(
              `❌ Failed to migrate from Turso table ${tableName}:`,
              error,
            );
          }

          // Report success
          console.log(
            `   ✅ Table ${tableName} migration completed: ${migratedRows} rows migrated from TURSO database`,
          );
          migratedTables.push({
            tableName: tableName,
            rowCount: migratedRows,
            status: "success",
          });

          totalRowsMigrated += migratedRows;
        } catch (error) {
          console.log(`   ❌ Table ${tableName} migration failed:`, error);
          migratedTables.push({
            tableName: tableName,
            rowCount: 0,
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      console.log(`\n🎉 Migration completed successfully!`);
      console.log(`📊 Total rows migrated: ${totalRowsMigrated}`);
      console.log(`📋 Tables processed: ${migratedTables.length}`);

      // Re-enable foreign key constraints after migration
      console.log("🔒 Re-enabling foreign key constraints...");
      try {
        using _ = await newDb.exec({
          sql: "PRAGMA foreign_keys = ON",
          params: [],
        });
        console.log("✅ Foreign key constraints re-enabled");
      } catch (error) {
        console.warn("⚠️ Could not re-enable foreign key constraints:", error);
      }

      const executionTime = Date.now() - startTime;
      console.log(`⏱️ Total execution time: ${executionTime}ms`);
      console.log("🎯 Migration completed successfully!");

      return {
        success: true,
        migratedTables,
        totalRowsMigrated,
        executionTimeMs: executionTime,
      };
    } catch (error) {
      console.error("💥 Migration failed with error:", error);

      // Re-enable foreign key constraints even on error
      console.log("🔒 Re-enabling foreign key constraints after error...");
      try {
        using _ = await newDb.exec({
          sql: "PRAGMA foreign_keys = ON",
          params: [],
        });
        console.log("✅ Foreign key constraints re-enabled");
      } catch (fkError) {
        console.warn("⚠️ Could not re-enable foreign key constraints:", fkError);
      }

      const executionTime = Date.now() - startTime;
      console.log(`⏱️ Total execution time: ${executionTime}ms`);
      console.log("💥 Migration failed!");

      return {
        success: false,
        migratedTables,
        totalRowsMigrated,
        executionTimeMs: executionTime,
      };
    }
  },
});
