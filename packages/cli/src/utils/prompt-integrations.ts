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
 * @param local - Whether to use local deco.chat instance
 * @param workspace - The workspace to fetch integrations from
 * @returns Promise<DecoBinding[]> - The selected integration bindings
 * @throws Error if no session is found or no integrations are available
 *
 * @example
 * ```typescript
 * import { promptIntegrations } from "./utils/prompt-integrations.ts";
 *
 * // Select integrations for the current workspace
 * const selectedBindings = await promptIntegrations();
 * console.log("Selected bindings:", selectedBindings);
 *
 * // Select integrations for a specific workspace
 * const selectedBindings = await promptIntegrations(false, "my-workspace");
 * console.log("Selected bindings:", selectedBindings);
 *
 * // Select integrations for local development
 * const selectedBindings = await promptIntegrations(true);
 * console.log("Selected bindings:", selectedBindings);
 *
 * // Access binding properties
 * selectedBindings.forEach(binding => {
 *   console.log(`Name: ${binding.name}, Type: ${binding.type}, Integration ID: ${binding.integration_id}`);
 * });
 * ```
 */
import { Select } from "@cliffy/prompt";
import { createWorkspaceClient } from "../mcp.ts";
import { readSession } from "../session.ts";
import { sanitizeConstantName } from "./slugify.ts";
import { z } from "zod";

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

interface DecoBinding {
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
        // @ts-expect-error We need to refactor INTEGRATIONS_LIST to stop returning array and use a proper object
      },
      z.any(),
    );

    if (response.isError) {
      throw new Error("Failed to fetch integrations");
    }

    const integrationsResponse = response.structuredContent as Integration[];
    const integrations = (integrationsResponse || [])
      .filter((c) => c.connection.type !== "INNATE")
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!integrations || integrations.length === 0) {
      throw new Error("No integrations found.");
    }

    // Create options for the select component
    const options = integrations.map((integration) => ({
      name: `${integration.name} - ${integration.description}`,
      value: integration.id,
    }));

    // Add an "All" option at the beginning
    const allOptions = [
      { name: "Select All", value: "SELECT_ALL" },
      ...options,
    ];

    const selectedIntegrations: Integration[] = [];
    let continueSelecting = true;

    while (continueSelecting) {
      // Show current selection status
      const currentStatus =
        selectedIntegrations.length > 0
          ? `\nCurrently selected: ${selectedIntegrations.length} integration(s)`
          : "\nNo integrations selected yet";

      // Create options with selection indicators
      const displayOptions = allOptions.map((option) => {
        if (option.value === "SELECT_ALL") {
          const allSelected =
            integrations.length > 0 &&
            selectedIntegrations.length === integrations.length;
          return {
            name: `${allSelected ? "✓" : "○"} ${option.name}`,
            value: option.value,
          };
        }
        const isSelected = selectedIntegrations.some(
          (integration) => integration.id === option.value,
        );
        return {
          name: `${isSelected ? "✓" : "○"} ${option.name}`,
          value: option.value,
        };
      });

      // Add "Done" option if at least one integration is selected
      const finalOptions =
        selectedIntegrations.length > 0
          ? [{ name: "✓ Done", value: "DONE" }, ...displayOptions]
          : [{ name: "○ Skip", value: "DONE" }, ...displayOptions];

      const selected = await Select.prompt({
        message: `Select integrations:${currentStatus}`,
        options: finalOptions,
        search: true, // Enable searching since there can be many integrations
      });

      if (selected === "DONE") {
        continueSelecting = false;
      } else if (selected === "SELECT_ALL") {
        continueSelecting = false;

        // Select all
        selectedIntegrations.splice(
          0,
          selectedIntegrations.length,
          ...integrations,
        );
      } else {
        // Toggle individual selection
        const selectedIntegration = integrations.find(
          (integration) => integration.id === selected,
        );
        if (!selectedIntegration) {
          continue;
        }

        const index = selectedIntegrations.findIndex(
          (integration) => integration.id === selected,
        );
        if (index > -1) {
          selectedIntegrations.splice(index, 1);
        } else {
          selectedIntegrations.push(selectedIntegration);
        }
      }
    }

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
