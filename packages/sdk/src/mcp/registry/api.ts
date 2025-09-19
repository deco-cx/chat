import { listToolsByConnectionType } from "@deco/ai/mcp";
import { z } from "zod";
import { AppName } from "../../common/index.ts";
import { UserInputError } from "../../errors.ts";
import type { MCPConnection } from "../../models/mcp.ts";
import {
  DecoConnectionSchema,
  HTTPConnectionSchema,
  InnateConnectionSchema,
  SSEConnectionSchema,
  WebsocketConnectionSchema,
} from "../../models/mcp.ts";
import type { Json, QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import {
  createTransitionQuery,
  smartResolveProjectOrgIds,
} from "../workspace-helpers.ts";
export { AppName };
const DECO_CHAT_APPS_REGISTRY_TABLE = "deco_chat_apps_registry" as const;
const DECO_CHAT_REGISTRY_SCOPES_TABLE = "deco_chat_registry_scopes" as const;
const DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE =
  "deco_chat_apps_registry_tools" as const;

// Apps to omit from marketplace/discover
const OMITTED_APPS = [
  "9cecc7d6-d114-44b4-96e3-d4d06faf2c2f",
  "4c5aeb03-6b3d-4b58-bb14-4a0d7ecd4d14",
  "f5fe9093-67a6-416c-8fac-b77d3edf52e0",
  "6bc2c3e3-8858-49cd-b603-ca183e4f4f19",
  "f2bd7ca4-61fb-4dff-9753-45e5b8a85693",
  "0696cdb3-e6da-46ea-93af-e6524cabaa75",
  "5bd518f9-21f6-477f-8fbc-927b1a03018b",
  "b0ae29d5-7220-423c-b57b-d0bbe3816120",
  "fc348403-4bb9-4b95-8cda-b73e8beac4fd",
];

const SELECT_REGISTRY_SCOPE_QUERY = `
  id,
  scope_name,
  workspace,
  created_at,
  updated_at
` as const;

const SELECT_REGISTRY_APP_QUERY = `
  id,
  workspace,
  scope_id,
  metadata,
  name,
  description,
  icon,
  connection,
  created_at,
  updated_at,
  unlisted,
  friendly_name,
  verified
` as const;

const SELECT_REGISTRY_APP_WITH_SCOPE_QUERY = `
  ${SELECT_REGISTRY_APP_QUERY},
  deco_chat_registry_scopes!inner(scope_name),
  deco_chat_apps_registry_tools(
    id,
    name,
    description,
    input_schema,
    output_schema,
    metadata
  )
` as const;

// MCPConnection schema for validation
const MCPConnectionSchema = z.discriminatedUnion("type", [
  HTTPConnectionSchema,
  SSEConnectionSchema,
  WebsocketConnectionSchema,
  DecoConnectionSchema,
  InnateConnectionSchema,
]);

// Zod schemas for output validation
const RegistryScopeSchema = z.object({
  id: z.string(),
  scopeName: z.string(),
  workspace: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const RegistryToolSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const RegistryAppSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  scopeId: z.string(),
  scopeName: z.string(),
  appName: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  connection: MCPConnectionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  unlisted: z.boolean(),
  friendlyName: z.string().optional(),
  verified: z.boolean().optional(),
  tools: z.array(RegistryToolSchema).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export type RegistryScope = {
  id: string;
  scopeName: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
};

export type RegistryApp = z.infer<typeof RegistryAppSchema>;

const Mappers = {
  toRegistryScope: (
    data: QueryResult<
      typeof DECO_CHAT_REGISTRY_SCOPES_TABLE,
      typeof SELECT_REGISTRY_SCOPE_QUERY
    >,
  ): RegistryScope => {
    return {
      id: data.id,
      scopeName: data.scope_name,
      workspace: data.workspace,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  },
  toRegistryApp: (
    data: QueryResult<
      typeof DECO_CHAT_APPS_REGISTRY_TABLE,
      typeof SELECT_REGISTRY_APP_WITH_SCOPE_QUERY
    >,
  ): RegistryApp => {
    const tools = Array.isArray(data.deco_chat_apps_registry_tools)
      ? data.deco_chat_apps_registry_tools.map((tool) => ({
          id: tool.id,
          name: tool.name,
          description: tool.description ?? undefined,
          inputSchema:
            (tool.input_schema as Record<string, unknown>) ?? undefined,
          outputSchema:
            (tool.output_schema as Record<string, unknown>) ?? undefined,
          metadata: (tool.metadata as Record<string, unknown>) ?? undefined,
        }))
      : [];

    return {
      id: data.id,
      workspace: data.workspace,
      scopeId: data.scope_id,
      scopeName: data.deco_chat_registry_scopes.scope_name,
      name: data.name,
      appName: AppName.build(
        data.deco_chat_registry_scopes.scope_name,
        data.name,
      ),
      friendlyName: data.friendly_name ?? undefined,
      description: data.description ?? undefined,
      icon: data.icon ?? undefined,
      connection: data.connection as MCPConnection,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      unlisted: data.unlisted,
      verified: data.verified ?? false,
      metadata: data.metadata as Record<string, unknown> | undefined,
      tools,
    };
  },
};

const createTool = createToolGroup("Registry", {
  name: "App Registry",
  description: "Manage and discover published apps in the registry.",
  icon: "https://assets.decocache.com/mcp/09e44283-f47d-4046-955f-816d227c626f/app.png",
});

export const listRegistryScopes = createTool({
  name: "REGISTRY_LIST_SCOPES",
  description: "List all registry scopes",
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe("Search term to filter scopes by name"),
  }),
  outputSchema: z.object({ scopes: z.array(RegistryScopeSchema) }),
  handler: async ({ search }, c) => {
    await assertWorkspaceResourceAccess(c);

    let query = c.db
      .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
      .select(SELECT_REGISTRY_SCOPE_QUERY);

    if (search) {
      query = query.ilike("scope_name", `%${search}%`);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    return { scopes: data.map(Mappers.toRegistryScope) };
  },
});

const MAX_SCOPES_PER_WORKSPACE = 5;
async function ensureScope(
  scopeName: string,
  workspace: string,
  ids: { projectId: string; orgId: number },
  db: AppContext["db"],
): Promise<string> {
  // First, try to find existing scope
  const { data: existingScope, error: findError } = await db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .select("id, workspace")
    .eq("scope_name", scopeName)
    .maybeSingle();

  if (findError) throw findError;

  if (existingScope) {
    // Check ownership - only the workspace that owns the scope can publish to it
    if (existingScope.workspace !== workspace) {
      throw new UserInputError(
        `Scope "${scopeName}" is owned by another workspace`,
      );
    }
    return existingScope.id;
  }

  // Check scope limit before creating new scope - use transition query
  const baseScopeCountQuery = db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .select("id", { count: "exact" });
  const scopeCountQuery = createTransitionQuery(
    baseScopeCountQuery,
    ids,
    workspace,
  );
  const { data: existingScopes, error: countError } = await scopeCountQuery;

  if (countError) throw countError;

  const scopeCount = existingScopes?.length ?? 0;
  if (scopeCount >= MAX_SCOPES_PER_WORKSPACE) {
    throw new UserInputError(
      `Cannot claim more than ${MAX_SCOPES_PER_WORKSPACE} scopes per workspace. Current count: ${scopeCount}`,
    );
  }

  // Create new scope (automatic claiming) if it doesn't exist
  const { data: newScope, error: createError } = await db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .insert({
      scope_name: scopeName,
      workspace,
      project_id: ids.projectId,
      org_id: ids.orgId,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (createError) throw createError;

  return newScope.id;
}

export const getRegistryApp = createTool({
  name: "REGISTRY_GET_APP",
  description: "Get an app from the registry",
  inputSchema: z.object({
    name: z.string().describe("The name of the app to get").optional(),
    id: z.string().describe("The id of the app to get").optional(),
  }),
  outputSchema: RegistryAppSchema,
  handler: async (ctx, c) => {
    c.resourceAccess.grant(); // this method is public
    let data: QueryResult<
      typeof DECO_CHAT_APPS_REGISTRY_TABLE,
      typeof SELECT_REGISTRY_APP_WITH_SCOPE_QUERY
    > | null = null;

    if ("id" in ctx && ctx.id) {
      const result = await c.db
        .from(DECO_CHAT_APPS_REGISTRY_TABLE)
        .select(SELECT_REGISTRY_APP_WITH_SCOPE_QUERY)
        .eq("id", ctx.id)
        .maybeSingle();

      if (result.error) throw result.error;
      data = result.data;
    } else if ("name" in ctx && ctx.name) {
      const { scopeName, name: appName } = AppName.parse(ctx.name);
      const result = await c.db
        .from(DECO_CHAT_APPS_REGISTRY_TABLE)
        .select(SELECT_REGISTRY_APP_WITH_SCOPE_QUERY)
        .eq(`${DECO_CHAT_REGISTRY_SCOPES_TABLE}.scope_name`, scopeName)
        .eq("name", appName)
        .maybeSingle();

      if (result.error) throw result.error;
      data = result.data;
    }
    if (!data) {
      throw new UserInputError("App not found");
    }
    return Mappers.toRegistryApp(data!);
  },
});
export const listRegistryApps = createTool({
  name: "REGISTRY_LIST_APPS",
  description: "List all apps in the registry for the current workspace",
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe("Search term to filter apps by name or description"),
    scopeName: z.string().optional().describe("Filter apps by scope name"),
  }),
  outputSchema: z.object({ apps: z.array(RegistryAppSchema) }),
  handler: async ({ search, scopeName }, c) => {
    await assertWorkspaceResourceAccess(c);

    assertHasWorkspace(c);

    // Resolve project and org IDs from context
    const ids = await smartResolveProjectOrgIds(c.db, c);

    // Build complex query for public apps and workspace-specific unlisted apps
    const workspace = c.workspace.value;
    const personalSlug = `/shared/${c.locator?.org}`;

    let query = c.db
      .from(DECO_CHAT_APPS_REGISTRY_TABLE)
      .select(SELECT_REGISTRY_APP_WITH_SCOPE_QUERY)
      .or(
        `unlisted.eq.false,` +
          `and(workspace.eq."${workspace}",unlisted.eq.true),` +
          `and(workspace.eq."${personalSlug}",unlisted.eq.true),` +
          `and(project_id.eq.${ids.projectId},org_id.eq.${ids.orgId},unlisted.eq.true)`,
      );

    if (scopeName) {
      query = query.eq("deco_chat_registry_scopes.scope_name", scopeName);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    // Filter out omitted apps
    const filteredData = data.filter((app) => !OMITTED_APPS.includes(app.id));

    return { apps: filteredData.map(Mappers.toRegistryApp) };
  },
});

export const listPublishedApps = createTool({
  name: "REGISTRY_LIST_PUBLISHED_APPS",
  description: "List published apps by the current workspace",
  inputSchema: z.object({
    search: z
      .string()
      .optional()
      .describe("Search term to filter apps by name or description"),
  }),
  outputSchema: z.object({ apps: z.array(RegistryAppSchema) }),
  handler: async ({ search }, c) => {
    c.resourceAccess.grant(); // Public tool, no policies needed

    assertHasWorkspace(c);

    // Resolve project and org IDs from context
    const ids = await smartResolveProjectOrgIds(c.db, c);

    // Use transition query for published apps
    const baseQuery = c.db
      .from(DECO_CHAT_APPS_REGISTRY_TABLE)
      .select(SELECT_REGISTRY_APP_WITH_SCOPE_QUERY);
    let query = createTransitionQuery(baseQuery, ids, c.workspace?.value);

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    const { data, error } = await query.order("created_at", {
      ascending: false,
    });

    if (error) throw error;

    // Filter out omitted apps
    const filteredData = data.filter((app) => !OMITTED_APPS.includes(app.id));

    return { apps: filteredData.map(Mappers.toRegistryApp) };
  },
});

export const publishApp = createTool({
  name: "REGISTRY_PUBLISH_APP",
  description:
    "Publish an app to the registry (automatically claims scope on first use)",
  inputSchema: z.object({
    scopeName: z
      .string()
      .describe(
        "The scope to publish to (defaults to team slug, automatically claimed on first use)",
      ),
    name: z.string().describe("The name of the app"),
    friendlyName: z.string().optional().describe("A friendly name for the app"),
    description: z.string().optional().describe("A description of the app"),
    icon: z.string().optional().describe("URL to an icon for the app"),
    connection: MCPConnectionSchema.describe(
      "The MCP connection configuration for the app",
    ),
    metadata: z.record(z.unknown()).optional().describe("Metadata for the app"),
    unlisted: z
      .boolean()
      .optional()
      .describe("Whether the app should be unlisted"),
  }),
  outputSchema: RegistryAppSchema,
  handler: async (
    {
      scopeName: scope_name,
      name,
      description,
      icon,
      connection,
      unlisted,
      friendlyName,
      metadata,
    },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c);

    assertHasWorkspace(c);

    // Resolve project and org IDs from context
    const ids = await smartResolveProjectOrgIds(c.db, c);
    const workspace = c.workspace.value;

    if (!name.trim()) {
      throw new UserInputError("App name cannot be empty");
    }

    // Use team slug as default scope if none provided
    const scopeName = scope_name.trim();

    // Ensure scope exists (automatically claim if needed)
    const scopeId = await ensureScope(scopeName, workspace, ids, c.db);

    const { data, error } = await c.db
      .from(DECO_CHAT_APPS_REGISTRY_TABLE)
      .upsert(
        {
          workspace, // Keep workspace for backward compatibility during transition
          project_id: ids.projectId,
          org_id: ids.orgId,
          scope_id: scopeId,
          friendly_name: friendlyName?.trim() || null,
          name: name.trim(),
          metadata: metadata as Json,
          description: description?.trim() || null,
          icon: icon?.trim() || null,
          connection,
          updated_at: new Date().toISOString(),
          unlisted: unlisted ?? true,
        },
        {
          onConflict: "scope_id,name",
        },
      )
      .select(SELECT_REGISTRY_APP_WITH_SCOPE_QUERY)
      .single();

    if (error) throw error;

    const { tools = [] } = await listToolsByConnectionType(
      connection,
      c,
      true,
    ).catch(() => ({ tools: [] }));

    // Get current tools for this app to calculate diff
    const { data: currentTools, error: currentToolsError } = await c.db
      .from(DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE)
      .select("name")
      .eq("app_id", data.id);

    if (currentToolsError) throw currentToolsError;

    const currentToolNames = new Set(currentTools?.map((t) => t.name) || []);
    const newToolNames = new Set(tools.map((t) => t.name));

    // Find tools to delete (exist in DB but not in new tools)
    const toolsToDelete = Array.from(currentToolNames).filter(
      (name) => !newToolNames.has(name),
    );

    // Delete old tools that are no longer present
    if (toolsToDelete.length > 0) {
      const { error: deleteError } = await c.db
        .from(DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE)
        .delete()
        .eq("app_id", data.id)
        .in("name", toolsToDelete);

      if (deleteError) throw deleteError;
    }

    // Upsert new/updated tools
    await Promise.all(
      tools.map((tool) =>
        c.db.from(DECO_CHAT_REGISTRY_APPS_TOOLS_TABLE).upsert(
          {
            app_id: data.id,
            name: tool.name,
            description: tool.description || null,
            input_schema: tool.inputSchema || null,
            output_schema: tool.outputSchema || null,
            metadata: null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "app_id,name",
          },
        ),
      ),
    );

    return Mappers.toRegistryApp(data);
  },
});
