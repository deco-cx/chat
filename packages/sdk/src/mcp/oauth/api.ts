import { decodeJwt } from "jose";
import { z } from "zod";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { createToolGroup } from "../context.ts";
import { MCPClient } from "../index.ts";

const createTool = createToolGroup("OAuth", {
  name: "OAuth Management",
  description: "Create and manage OAuth codes securely.",
  icon: "https://assets.decocache.com/mcp/5e6930c3-86f6-4913-8de3-0c1fefdf02e3/API-key.png",
});

export const oauthCodeCreate = createTool({
  name: "OAUTH_CODE_CREATE",
  description: "Create an OAuth code for a given API key",
  inputSchema: z.object({
    integrationId: z
      .string()
      .describe("The ID of the integration to create an OAuth code for"),
  }),
  outputSchema: z.object({
    code: z.string().describe("The OAuth code"),
  }),
  handler: async ({ integrationId }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c.tool.name, c);
    const mcpClient = MCPClient.forContext(c);
    const integration = await mcpClient.INTEGRATIONS_GET({
      id: integrationId,
    });
    const connection = integration.connection;
    if (connection.type !== "HTTP" || !connection.token) {
      throw new Error(
        "Only authorized HTTP connections are supported for OAuth codes",
      );
    }
    const currentClaims = decodeJwt(connection.token);
    const claims = {
      ...currentClaims,
      user: JSON.stringify(c.user),
    };
    const code = crypto.randomUUID();

    const { error } = await c.db.from("deco_chat_oauth_codes").insert({
      code,
      claims,
      workspace: c.workspace.value,
    });
    if (error) {
      throw new Error(error.message);
    }
    return {
      code,
    };
  },
});
