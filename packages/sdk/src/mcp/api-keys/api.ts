import { and, eq, or } from "drizzle-orm";
import { z } from "zod";
import { userFromJWT } from "../../auth/user.ts";
import {
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import { LocatorStructured } from "../../locator.ts";
import {
  policiesSchema,
  Statement,
  StatementSchema,
} from "../../models/index.ts";
import type { QueryResult } from "../../storage/index.ts";
import {
  apiKeySWRCache,
  assertHasLocator,
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { MCPClient } from "../index.ts";
import { getIntegration } from "../integrations/api.ts";
import {
  buildWorkspaceOrProjectIdConditions,
  getProjectIdFromContext,
  workspaceOrProjectIdConditions,
} from "../projects/util.ts";
import { getRegistryApp } from "../registry/api.ts";
import { apiKeys, organizations, projects } from "../schema.ts";

export const SELECT_API_KEY_QUERY = `
  id,
  name,
  workspace,
  project_id,
  enabled,
  policies,
  created_at,
  updated_at,
  deleted_at
` as const;

export function mapApiKey(
  apiKey: QueryResult<"deco_chat_api_keys", typeof SELECT_API_KEY_QUERY>,
) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    workspace: apiKey.workspace,
    projectId: apiKey.project_id,
    enabled: apiKey.enabled,
    policies: apiKey.policies as Statement[],
    createdAt: apiKey.created_at,
    updatedAt: apiKey.updated_at,
    deletedAt: apiKey.deleted_at,
    // Never expose the actual key value for security
  };
}

const createTool = createToolGroup("APIKeys", {
  name: "API Key Management",
  description: "Create and manage API keys securely.",
  icon: "https://assets.decocache.com/mcp/5e6930c3-86f6-4913-8de3-0c1fefdf02e3/API-key.png",
});

/**
 * Returns a Drizzle OR condition that filters API keys by workspace or project locator.
 * This version works with queries that don't include the agents table.
 */
export const matchByWorkspaceOrProjectLocatorForApiKeys = (
  workspace: string,
  locator?: LocatorStructured,
) => {
  return or(
    eq(apiKeys.workspace, workspace),
    locator
      ? and(
          eq(projects.slug, locator.project),
          eq(organizations.slug, locator.org),
        )
      : undefined,
  );
};

const AppClaimsSchema = z.object({
  appName: z.string(),
  integrationId: z.string(),
  state: z.any(),
});

// Shared API key output schema
export const ApiKeySchema = z.object({
  id: z.string().describe("The unique identifier of the API key"),
  name: z.string().describe("The name of the API key"),
  workspace: z.string().nullable().describe("The workspace ID"),
  enabled: z.boolean().describe("Whether the API key is enabled"),
  policies: z
    .array(StatementSchema)
    .describe("Access policies for the API key"),
  createdAt: z.string().describe("Creation timestamp"),
  updatedAt: z.string().describe("Last update timestamp"),
  deletedAt: z
    .string()
    .nullable()
    .describe("Deletion timestamp (null if not deleted)"),
});

const ApiKeyWithValueSchema = ApiKeySchema.extend({
  value: z
    .string()
    .describe(
      "The actual API key value (JWT token) - only returned on creation/reissue",
    ),
});

export const listApiKeys = createTool({
  name: "API_KEYS_LIST",
  description: "List all API keys",
  inputSchema: z.object({}),
  outputSchema: z.object({
    apiKeys: z.array(ApiKeySchema).describe("List of API keys"),
  }),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const query = c.db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .or(await workspaceOrProjectIdConditions(c))
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      apiKeys: data.map(mapApiKey),
    };
  },
});

const ensureStateIsWellFormed = async (state: unknown) => {
  const promises: Promise<unknown>[] = [];

  for (const prop of Object.values(state ?? {})) {
    if (
      prop &&
      typeof prop === "object" &&
      "value" in prop &&
      typeof prop.value === "string"
    ) {
      promises.push(
        Promise.resolve(
          getIntegration.handler({
            id: prop.value,
          }),
        ).then((integration) => {
          // deno-lint-ignore no-explicit-any
          (prop as any)["__type"] = integration.appName; // ensure it's a binding object
        }),
      );
    }
  }

  await Promise.all(promises);

  return state;
};

export const createApiKey = createTool({
  name: "API_KEYS_CREATE",
  description: "Create a new API key",
  inputSchema: z.object({
    name: z.string().describe("The name of the API key"),
    policies: policiesSchema,
    claims: AppClaimsSchema.optional().describe(
      "App Claims to be added to the API key",
    ),
  }),
  outputSchema: ApiKeyWithValueSchema,
  handler: async ({ name, policies, claims }, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);
    const workspace = c.workspace.value;

    // this code ensures that we always validate stat against the app owner before issuing an JWT.
    if (claims?.appName) {
      // ensure app schema is well formed

      const [app, state] = await Promise.all([
        getRegistryApp.handler({
          name: claims.appName,
        }),
        ensureStateIsWellFormed(claims.state),
      ]);

      // get connection from registry

      const validated = (await MCPClient.INTEGRATIONS_CALL_TOOL({
        connection: app.connection,
        params: {
          name: "DECO_CHAT_STATE_VALIDATION",
          arguments: {
            state,
          },
        },
      })) as {
        structuredContent: { valid: boolean; reason?: string };
      };
      // call state validation tool.

      if (validated?.structuredContent?.valid === false) {
        // errors or not valid payloads are considered valid?
        throw new UserInputError(
          `Could not validate state ${validated.structuredContent.reason}`,
        );
      }
    }

    const db = c.db;

    const projectId = await getProjectIdFromContext(c);

    // Insert the API key metadata
    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .insert({
        name,
        workspace,
        project_id: projectId,
        enabled: true,
        policies: policies || [],
      })
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    const issuer = await c.jwtIssuer();
    const value = await issuer.issue({
      ...claims,
      sub: `api-key:${apiKey.id}`,
      aud: c.locator.value,
      iat: new Date().getTime(),
    });

    return { ...mapApiKey(apiKey), value };
  },
});

export const reissueApiKey = createTool({
  name: "API_KEYS_REISSUE",
  description: "Reissue an existing API key with new claims",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to reissue"),
    claims: z
      .any()
      .optional()
      .describe("New claims to be added to the API key"),
    policies: policiesSchema.optional().describe("Policies of the API key"),
  }),
  outputSchema: ApiKeyWithValueSchema,
  handler: async ({ id, claims, policies }, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);
    await assertWorkspaceResourceAccess(c);

    const projectId = await getProjectIdFromContext(c);
    const workspace = c.workspace.value;

    // First, verify the API key exists and is accessible
    const { data: apiKey, error } = await c.db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .or(buildWorkspaceOrProjectIdConditions(workspace, projectId))
      .is("deleted_at", null)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    const { error: updateError } = policies
      ? await c.db
          .from("deco_chat_api_keys")
          .update({
            policies,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .or(buildWorkspaceOrProjectIdConditions(workspace, projectId))
          .is("deleted_at", null)
      : { error: null };

    if (updateError) {
      throw new InternalServerError(updateError.message);
    }

    // Generate new JWT token with the provided claims
    const issuer = await c.jwtIssuer();
    const value = await issuer.issue({
      ...claims,
      sub: `api-key:${apiKey.id}`,
      aud: c.locator.value,
      iat: new Date().getTime(),
    });

    const cacheId = `${c.workspace.value}:${id}`;
    await apiKeySWRCache.delete(cacheId);

    // Return the API key with updated policies if they were provided
    const updatedApiKey = policies ? { ...apiKey, policies } : apiKey;
    return { ...mapApiKey(updatedApiKey), value };
  },
});

export const getApiKey = createTool({
  name: "API_KEYS_GET",
  description: "Get an API key by ID",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key"),
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { data: apiKey, error } = await c.db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    return mapApiKey(apiKey);
  },
});

export const updateApiKey = createTool({
  name: "API_KEYS_UPDATE",
  description: "Update an API key metadata",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key"),
    name: z.string().optional().describe("New name for the API key"),
    enabled: z.boolean().optional().describe("Whether the API key is enabled"),
    policies: policiesSchema,
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id, name, enabled, policies }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    // deno-lint-ignore no-explicit-any
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (policies !== undefined) updateData.policies = policies;
    updateData.updated_at = new Date().toISOString();

    const { data: apiKey, error } = await c.db
      .from("deco_chat_api_keys")
      .update(updateData)
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .is("deleted_at", null)
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return mapApiKey(apiKey);
  },
});

export const deleteApiKey = createTool({
  name: "API_KEYS_DELETE",
  description: "Delete an API key (soft delete)",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to delete"),
  }),
  outputSchema: z.object({
    id: z.string().describe("The ID of the deleted API key"),
    deleted: z.boolean().describe("Confirmation that the key was deleted"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    // Soft delete by setting deleted_at timestamp
    const { data: apiKey, error } = await c.db
      .from("deco_chat_api_keys")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .is("deleted_at", null)
      .select("id")
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      id: apiKey.id,
      deleted: true,
    };
  },
});

export const enableApiKey = createTool({
  name: "API_KEYS_ENABLE",
  description: "Enable an API key",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to enable"),
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { data: apiKey, error } = await c.db
      .from("deco_chat_api_keys")
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .is("deleted_at", null)
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return mapApiKey(apiKey);
  },
});

export const disableApiKey = createTool({
  name: "API_KEYS_DISABLE",
  description: "Disable an API key",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to disable"),
  }),
  outputSchema: ApiKeySchema,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { data: apiKey, error } = await c.db
      .from("deco_chat_api_keys")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .is("deleted_at", null)
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return mapApiKey(apiKey);
  },
});

const CheckAccessInputSchema = z.object({
  key: z
    .string()
    .optional()
    .describe(
      "The API key to check access for, if not provided, the current key from context will be used",
    ),
  tools: z.array(z.string()).describe("All tools that wants to check access"),
});

const CheckAccessOutputSchema = z.object({
  access: z.record(z.string(), z.boolean()),
});

export const checkAccess = createTool({
  name: "API_KEYS_CHECK_ACCESS",
  description: "Check if an API key has access to a resource",
  inputSchema: CheckAccessInputSchema,
  outputSchema: CheckAccessOutputSchema,
  handler: async ({ key, tools }, c) => {
    assertHasWorkspace(c);
    c.resourceAccess.grant(); // this is public because it uses the current key from context

    let user = c.user;
    if (key) {
      const fromJWT = await userFromJWT(
        key,
        c.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY &&
          c.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY
          ? {
              public: c.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY,
              private: c.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY,
            }
          : undefined,
      );
      user = fromJWT ?? user;
    }
    const hasAccess = await Promise.all(
      tools.map(async (tool) => {
        return [
          tool,
          await assertWorkspaceResourceAccess(c, tool)
            .then(() => true)
            .catch(() => false),
        ];
      }),
    );
    return {
      access: Object.fromEntries(hasAccess),
    };
  },
});

export const validateApiKey = createTool({
  name: "API_KEYS_VALIDATE",
  description: "Validate an API key by ID",
  inputSchema: z.object({
    id: z.string().describe("The ID of the API key to validate"),
  }),
  outputSchema: ApiKeySchema.extend({
    valid: z.boolean().describe("Whether the API key is valid"),
  }),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const { data: apiKey, error } = await c.db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .or(await workspaceOrProjectIdConditions(c))
      .eq("enabled", true)
      .is("deleted_at", null)
      .single();

    if (error || !apiKey) {
      throw new NotFoundError("API key not found or invalid");
    }

    return {
      ...mapApiKey(apiKey),
      valid: true,
    };
  },
});
