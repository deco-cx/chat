/**
 * How integrations work:
 *
 * RUN INTEGRATIONS_SEARCH to get a list of integrations, both installed and to be installed via the marketplace.
 *
 * In case the integration you are looking for is not installed, you can install it using INTEGRATION_INSTALL.
 *
 * Once you have the installation id, you can enable the integration using INTEGRATION_ENABLE.
 *
 * If you need to disable an integration, use INTEGRATION_DISABLE.
 */
import { z } from "zod";
import type { AIAgent } from "../agent.ts";
import { mcpServerTools } from "../mcp.ts";
import { type Integration, IntegrationSchema } from "../storage/index.ts";
import { createInnateTool } from "../utils/createTool.ts";
import {
  getDecoRegistryServerClient,
  searchInstalledIntegations,
  searchMarketplaceIntegations,
} from "./utils.ts";

export const DECO_INTEGRATIONS_SEARCH = createInnateTool({
  id: "DECO_INTEGRATIONS_SEARCH",
  description: `
Search for integrations in both marketplace and installed.
If no query is provided, it will return all installed integrations. For better results, try searching for the service name, i.e. GoogleSheets, GoogleCalendar, Notion, etc.
It's always handy to search for installed integrations with no query, since all integrations will be returned. Also, some integrations are handy agents that may help you with common tasks.
`,
  inputSchema: z.object({
    query: z.string().describe("The query to search for").optional(),
    filters: z.object({
      installed: z.boolean().describe(
        "Whether to filter by installed integrations. Explicitly set to false to only search in marketplace or true to only search for installed integrations",
      ).optional(),
    }).optional(),
    verbose: z.boolean()
      .describe(
        "Whether to return full version of the integrations. Try not using this property, it will make the tool WAY more expensive",
      )
      .optional(),
  }),
  outputSchema: z.object({
    integrations: z.array(
      IntegrationSchema.omit({ connection: true }).and(z.object({
        installed: z.boolean().describe(
          "Whether the integration is installed. Call INTEGRATION_INSTALL to install an integration",
        ),
        enabled: z.boolean().describe(
          "Whether the integration is enabled to be used by the agent. Call INTEGRATION_ENABLE to enable an integration",
        ),
      })),
    ).describe("The Integrations that match the query"),
  }),
  execute: (agent) => async ({ context }) => {
    const query = context.query ?? undefined;
    const filters = context.filters;

    const [
      marketplace,
      installed,
      toolSet,
    ] = await Promise.all([
      filters?.installed === true
        ? Promise.resolve([])
        : searchMarketplaceIntegations(query),
      filters?.installed === false
        ? Promise.resolve([])
        : searchInstalledIntegations(agent, query),
      agent.getThreadTools(),
    ]);

    const list = [
      ...marketplace.map(({ id, name, description, icon, provider }) => ({
        id,
        name,
        description,
        icon,
        installed: false,
        enabled: false,
        provider,
      })),
      ...installed.map(({ id, name, description, icon }) => ({
        id,
        name,
        description,
        icon,
        installed: true,
        enabled: Boolean(toolSet?.[id]) ?? false,
      })),
    ].map(({ description, icon, ...rest }) =>
      context.verbose ? { ...rest, description, icon } : rest
    );

    return {
      integrations: list,
    };
  },
});

const CONFIGURE_INTEGRATION_OUTPUT_SCHEMA = z.object({
  success: z.boolean().describe("Whether the configuration was successful"),
  message: z.string().describe(
    "A message describing the result of the configuration attempt",
  ).optional(),
  data: IntegrationSchema.omit({ id: true }).optional(),
});

export const DECO_INTEGRATION_INSTALL = createInnateTool({
  id: "DECO_INTEGRATION_INSTALL",
  description:
    "Install an integration. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool. Also, after installing, enable the integration using the INTEGRATION_ENABLE tool.",
  inputSchema: z.object({
    id: z.string().describe(
      "The id of the integration to install. To know the available ids, use the DECO_INTEGRATIONS_SEARCH tool",
    ),
  }),
  outputSchema: z.object({
    installationId: z.string().describe(
      "The id of the installation. Use this id to enable the integration using the DECO_INTEGRATIONS_SEARCH tool",
    ),
  }),
  execute: (agent) => async ({ context }) => {
    const client = await getDecoRegistryServerClient();

    try {
      const result = await client.callTool({
        name: "CONFIGURE",
        arguments: { id: context.id },
      }) as { content: { text: string }[] };

      const parsed = CONFIGURE_INTEGRATION_OUTPUT_SCHEMA.parse(
        JSON.parse(result.content[0].text),
      );

      const id = crypto.randomUUID();

      const created = await agent.storage?.integrations
        .for(agent.workspace)
        .create({ id, ...(parsed.data as Omit<Integration, "id">) });

      client.close();

      if (!created?.id) {
        throw new Error("Failed to create integration");
      }

      return { installationId: created.id };
    } catch (error) {
      client.close();

      throw error;
    }
  },
});

const listToolsForIntegration = async (
  integrationId: string,
  agent: AIAgent,
) => {
  const integration = await agent.storage?.integrations
    .for(agent.workspace)
    .get(integrationId);

  if (!integration) {
    throw new Error("Integration not found");
  }

  const result = await mcpServerTools(integration, agent);

  return {
    tools: Object.values(result).map(({ id, description }) => ({
      id,
      name: id,
      description,
    })),
  };
};

export const DECO_INTEGRATION_LIST_TOOLS = createInnateTool({
  id: "DECO_INTEGRATION_LIST_TOOLS",
  description: "List tools this integration provides",
  inputSchema: z.object({
    installationId: z.string().describe(
      "The installation id of the integration to list tools for",
    ),
  }),
  outputSchema: z.object({
    tools: z.array(z.object({
      name: z.string().describe("The name of the tool"),
      description: z.string().describe("The description of the tool"),
    })).describe("The tools this integration provides"),
  }),
  execute: (agent) => ({ context }) => {
    const { installationId } = context;

    return listToolsForIntegration(installationId, agent);
  },
});

export const DECO_INTEGRATION_ENABLE = createInnateTool({
  id: "DECO_INTEGRATION_ENABLE",
  description:
    "Enable an installed integration. Use this tool after installing an integration.",
  inputSchema: z.object({
    installationId: z.string().describe(
      "The installation id of the integration to enable",
    ),
    toolNames: z.array(z.string()).describe(
      "The names of the tools to enable. If no tools are provided, all tools will be enabled.",
    ).optional(),
  }),
  outputSchema: z.null(),
  execute: (agent) => async ({ context }) => {
    const { installationId, toolNames } = context;

    const { tools } = await listToolsForIntegration(installationId, agent);

    if (tools.length === 0) {
      throw new Error("Looks like this integration has no tools");
    }

    const set = new Set(toolNames);
    const toolList = toolNames
      ? tools.filter((t) => set.has(t.name)).map((t) => t.name)
      : tools.map((t) => t.name);

    // Maybe there's a race condition here, but it's unlikely
    const toolSet = await agent.getThreadTools();
    await agent.updateThreadTools({
      ...toolSet,
      [installationId]: toolList,
    });

    return null;
  },
});

export const DECO_INTEGRATION_DISABLE = createInnateTool({
  id: "DECO_INTEGRATION_DISABLE",
  description: "Disable an integration to be used by the agent",
  inputSchema: z.object({
    installationId: z.string().describe(
      "The installation id of the integration to disable",
    ),
    toolNames: z.array(z.string()).describe(
      "The names of the tools to enable. If no tools are provided, all tools will be enabled.",
    ).optional(),
  }),
  outputSchema: z.null(),
  execute: (agent) => async ({ context }) => {
    const { installationId, toolNames } = context;

    const toolSet = await agent.getThreadTools();

    if (toolNames) {
      toolSet[installationId] = toolSet[installationId].filter(
        (tool) => !toolNames.includes(tool),
      );
    } else {
      delete toolSet[installationId];
    }

    await agent.updateThreadTools(toolSet);

    return null;
  },
});

export const tools = {
  DECO_INTEGRATIONS_SEARCH,
  DECO_INTEGRATION_INSTALL,
  DECO_INTEGRATION_ENABLE,
  DECO_INTEGRATION_DISABLE,
  DECO_INTEGRATION_LIST_TOOLS,
} as const;
