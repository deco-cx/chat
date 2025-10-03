/**
 * Prompts the user to select multiple integrations from the available integrations list.
 *
 * This function:
 * 1. Checks if the user has a valid session
 * 2. Creates a workspace client to access global tools
 * 3. Uses the INTEGRATIONS_LIST tool to fetch available integrations
 * 4. Presents a multiple select prompt to the user with search functionality
 * 5. Returns the selected integration bindings as an array
 *
 * @param local - Whether to use local decocms.com instance
 * @param workspace - The workspace to fetch integrations from
 * @returns Promise<DecoBinding[]> - The selected integration bindings
 * @throws Error if no session is found or no integrations are available
 */
import inquirer from "inquirer";
// @ts-ignore - does not have types
import inquirerSearchCheckbox from "inquirer-search-checkbox";
import { createWorkspaceClient } from "./mcp.js";
import { readSession } from "./session.js";
import { sanitizeConstantName } from "./slugify.js";
import { z } from "zod/v3";

// Register the search checkbox plugin
inquirer.registerPrompt("search-checkbox", inquirerSearchCheckbox);

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: string;
  connection: {
    type: string;
    url: string;
  };
}

export interface DecoBinding {
  name: string;
  type: string;
  integration_id: string;
}

export async function promptIntegrations(
  local = false,
  workspace = "",
): Promise<DecoBinding[]> {
  // Check if user has a session
  const session = await readSession();
  if (!session) {
    throw new Error("No session found. Please run 'deco login' first.");
  }

  // Create workspace client
  const client = await createWorkspaceClient({ workspace, local });

  try {
    // Use INTEGRATIONS_LIST tool to get available integrations
    const response = await client.callTool(
      {
        name: "INTEGRATIONS_LIST",
        arguments: {},
      },
      // @ts-expect-error We need to refactor INTEGRATIONS_LIST to stop returning array and use a proper object
      z.any(),
    );

    if (response.isError) {
      throw new Error("Failed to fetch integrations");
    }

    const integrationsResponse = (
      response.structuredContent as {
        items: Integration[];
      }
    )?.items;
    const integrations = (integrationsResponse || [])
      .filter((c) => c.connection.type !== "INNATE")
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!integrations || integrations.length === 0) {
      throw new Error("No integrations found.");
    }

    // Create options for the search checkbox component
    const options = integrations.map((integration) => ({
      name: `${integration.name} - ${integration.description}`,
      value: integration.id,
      short: integration.name,
    }));

    // Use inquirer search checkbox to allow multiple selection with search
    const { selectedIntegrationIds } = await inquirer.prompt([
      {
        type: "search-checkbox",
        name: "selectedIntegrationIds",
        message: "Select integrations (use space to select, enter to confirm):",
        choices: options,
        searchable: true,
        highlight: true,
        searchText: "Type to search integrations:",
        emptyText: "No integrations found matching your search.",
      },
    ]);

    // Convert selected IDs back to integration objects
    const selectedIntegrations = integrations.filter((integration) =>
      selectedIntegrationIds.includes(integration.id),
    );

    // Return the selected integration bindings
    return selectedIntegrations.map(({ name, id }) => ({
      name: sanitizeConstantName(name),
      type: "mcp",
      integration_id: id,
    }));
  } finally {
    // Clean up the client connection
    await client.close();
  }
}
