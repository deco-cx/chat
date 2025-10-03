import { and, eq, or } from "drizzle-orm";
import { z } from "zod/v3";
import { StatementSchema } from "../../auth/policy.ts";
import { userFromJWT } from "../../auth/user.ts";
import {
  InternalServerError,
  NotFoundError,
  UserInputError,
} from "../../errors.ts";
import { LocatorStructured } from "../../locator.ts";
import type { QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { MCPClient } from "../index.ts";
import { getIntegration } from "../integrations/api.ts";
import { getRegistryApp } from "../registry/api.ts";
import { apiKeys, organizations, projects } from "../schema.ts";

const SELECT_API_KEY_QUERY = `
  id,
  name,
  workspace,
  enabled,
  policies,
  created_at,
  updated_at,
  deleted_at
` as const;

function mapApiKey(
  apiKey: QueryResult<"deco_chat_api_keys", typeof SELECT_API_KEY_QUERY>,
) {
  return {
    id: apiKey.id,
    name: apiKey.name,
    workspace: apiKey.workspace,
    enabled: apiKey.enabled,
    policies: apiKey.policies,
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

export const listApiKeys = createTool({
  name: "API_KEYS_LIST",
  description: "List all API keys",
  inputSchema: z.lazy(() => z.object({})),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const query = db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("workspace", workspace)
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

const policiesSchema = z
  .array(StatementSchema)
  .optional()
  .describe("Policies for the API key");

const AppClaimsSchema = z.object({
  appName: z.string(),
  integrationId: z.string(),
  state: z.any(),
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
  inputSchema: z.lazy(() =>
    z.object({
      name: z.string().describe("The name of the API key"),
      policies: policiesSchema,
      claims: AppClaimsSchema.optional().describe(
        "App Claims to be added to the API key",
      ),
    }),
  ),
  handler: async ({ name, policies, claims }, c) => {
    assertHasWorkspace(c);
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

    // Insert the API key metadata
    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .insert({
        name,
        workspace,
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
      aud: workspace,
      iat: new Date().getTime(),
    });

    return { ...mapApiKey(apiKey), value };
  },
});

export const reissueApiKey = createTool({
  name: "API_KEYS_REISSUE",
  description: "Reissue an existing API key with new claims",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the API key to reissue"),
      claims: z
        .any()
        .optional()
        .describe("New claims to be added to the API key"),
    }),
  ),
  handler: async ({ id, claims }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    // First, verify the API key exists and is accessible
    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!apiKey) {
      throw new NotFoundError("API key not found");
    }

    // Generate new JWT token with the provided claims

    const issuer = await c.jwtIssuer();
    const value = await issuer.issue({
      ...claims,
      sub: `api-key:${apiKey.id}`,
      aud: workspace,
      iat: new Date().getTime(),
    });

    return { ...mapApiKey(apiKey), value };
  },
});

export const getApiKey = createTool({
  name: "API_KEYS_GET",
  description: "Get an API key by ID",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the API key"),
    }),
  ),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
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
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the API key"),
      name: z.string().optional().describe("New name for the API key"),
      enabled: z
        .boolean()
        .optional()
        .describe("Whether the API key is enabled"),
      policies: policiesSchema,
    }),
  ),
  handler: async ({ id, name, enabled, policies }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    // deno-lint-ignore no-explicit-any
    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (policies !== undefined) updateData.policies = policies;
    updateData.updated_at = new Date().toISOString();

    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .update(updateData)
      .eq("id", id)
      .eq("workspace", workspace)
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
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the API key to delete"),
    }),
  ),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    // Soft delete by setting deleted_at timestamp
    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace", workspace)
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
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the API key to enable"),
    }),
  ),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace", workspace)
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
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the API key to disable"),
    }),
  ),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace", workspace)
      .is("deleted_at", null)
      .select(SELECT_API_KEY_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    return mapApiKey(apiKey);
  },
});

export const checkAccess = createTool({
  name: "API_KEYS_CHECK_ACCESS",
  description: "Check if an API key has access to a resource",
  inputSchema: z.lazy(() =>
    z.object({
      key: z
        .string()
        .optional()
        .describe(
          "The API key to check access for, if not provided, the current key from context will be used",
        ),
      tools: z
        .array(z.string())
        .describe("All tools that wants to check access"),
    }),
  ),
  outputSchema: z.lazy(() =>
    z.object({
      access: z.record(z.string(), z.boolean()),
    }),
  ),
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
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the API key to validate"),
    }),
  ),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: apiKey, error } = await db
      .from("deco_chat_api_keys")
      .select(SELECT_API_KEY_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
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
