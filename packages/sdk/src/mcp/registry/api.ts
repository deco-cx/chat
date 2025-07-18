import { z } from "zod";
import { UserInputError } from "../../errors.ts";
import type { MCPConnection } from "../../models/mcp.ts";
import {
  DecoConnectionSchema,
  HTTPConnectionSchema,
  InnateConnectionSchema,
  SSEConnectionSchema,
  WebsocketConnectionSchema,
} from "../../models/mcp.ts";
import type { QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";

const DECO_CHAT_APPS_REGISTRY_TABLE = "deco_chat_apps_registry" as const;
const DECO_CHAT_REGISTRY_SCOPES_TABLE = "deco_chat_registry_scopes" as const;

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
  deco_chat_registry_scopes!inner(scope_name)
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

const RegistryAppSchema = z.object({
  id: z.string(),
  workspace: z.string(),
  scopeId: z.string(),
  scopeName: z.string(),
  name: z.string(),
  description: z.string().optional(),
  icon: z.string().optional(),
  connection: MCPConnectionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  unlisted: z.boolean(),
  friendlyName: z.string().optional(),
  verified: z.boolean().optional(),
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
    return {
      id: data.id,
      workspace: data.workspace,
      scopeId: data.scope_id,
      scopeName: data.deco_chat_registry_scopes.scope_name,
      name: data.name,
      friendlyName: data.friendly_name ?? undefined,
      description: data.description ?? undefined,
      icon: data.icon ?? undefined,
      connection: data.connection as MCPConnection,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      unlisted: data.unlisted,
      verified: data.verified ?? false,
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
    await assertWorkspaceResourceAccess(c.tool.name, c);

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

  // Check scope limit before creating new scope
  const { data: existingScopes, error: countError } = await db
    .from(DECO_CHAT_REGISTRY_SCOPES_TABLE)
    .select("id", { count: "exact" })
    .eq("workspace", workspace);

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
        .single();

      if (result.error) throw result.error;
      data = result.data;
    } else if ("name" in ctx && ctx.name) {
      const [scopeName, appName] = ctx.name.slice(1).split("/");
      const result = await c.db
        .from(DECO_CHAT_APPS_REGISTRY_TABLE)
        .select(SELECT_REGISTRY_APP_WITH_SCOPE_QUERY)
        .eq(`${DECO_CHAT_REGISTRY_SCOPES_TABLE}.scope_name`, scopeName)
        .eq("name", appName)
        .single();

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
    await assertWorkspaceResourceAccess(c.tool.name, c);

    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    let query = c.db
      .from(DECO_CHAT_APPS_REGISTRY_TABLE)
      .select(SELECT_REGISTRY_APP_WITH_SCOPE_QUERY)
      .or(`unlisted.eq.false,and(workspace.eq.${workspace},unlisted.eq.true)`);

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

    return { apps: data.map(Mappers.toRegistryApp) };
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
    },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);

    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    if (!name.trim()) {
      throw new UserInputError("App name cannot be empty");
    }

    // Use team slug as default scope if none provided
    const scopeName = scope_name.trim();

    // Ensure scope exists (automatically claim if needed)
    const scopeId = await ensureScope(scopeName, workspace, c.db);

    const { data, error } = await c.db
      .from(DECO_CHAT_APPS_REGISTRY_TABLE)
      .upsert(
        {
          workspace,
          scope_id: scopeId,
          friendly_name: friendlyName?.trim() || null,
          name: name.trim(),
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

    return Mappers.toRegistryApp(data);
  },
});
