/**
 * Prompts the user to select a workspace from their available teams.
 *
 * This function:
 * 1. Checks if the user has a valid session
 * 2. Creates a workspace client to access global tools
 * 3. Uses the TEAMS_LIST tool to fetch available teams
 * 4. Presents a searchable select prompt to the user
 * 5. Returns the selected team slug as the workspace
 *
 * @param local - Whether to use local decocms.com instance
 * @param current - Current workspace to use as default
 * @returns Promise<string> - The selected team slug
 * @throws Error if no session is found or no teams are available
 */
import inquirer from "inquirer";
import { createWorkspaceClient } from "./mcp.js";
import { readSession } from "./session.js";
// @ts-ignore - does not have types
import inquirerSearchList from "inquirer-search-list";
import { z } from "zod/v3";

interface Team {
  id: number;
  name: string;
  slug: string;
  theme: {
    picture: string;
    variables: Record<string, unknown>;
  };
  created_at: string;
  avatar_url: string;
}

export async function promptWorkspace(
  local = false,
  current = "",
): Promise<string> {
  // Register the search-list plugin
  try {
    inquirer.registerPrompt("search-list", inquirerSearchList);
  } catch {
    console.warn(
      "Could not load search functionality, falling back to basic list",
    );
  }

  // Check if user has a session
  const session = await readSession();
  if (!session) {
    throw new Error("No session found. Please run 'deco login' first.");
  }

  // Create workspace client with empty workspace to access global tools
  const client = await createWorkspaceClient({ workspace: "", local });

  try {
    // Use TEAMS_LIST tool to get available teams
    const response = await client.callTool(
      {
        name: "TEAMS_LIST",
        arguments: {},
      },
      // @ts-expect-error We need to refactor TEAMS_LIST to stop returning array and use a proper object
      z.any(),
    );

    if (response.isError) {
      throw new Error("Failed to fetch teams");
    }

    const { items: teams } = response.structuredContent as { items: Team[] };

    if (!teams || teams.length === 0) {
      throw new Error("No teams found. Please create a team first.");
    }

    // Create options for the select component
    const choices = teams.map((team) => ({
      name: team.name,
      value: team.slug,
    }));

    // Prompt user to select a team with search functionality
    let selectedSlug: string;

    try {
      // Try using search-list first
      const result = await inquirer.prompt([
        {
          type: "search-list",
          name: "selectedSlug",
          message: "Select a workspace:",
          choices,
          default: current,
        },
      ]);
      selectedSlug = result.selectedSlug;
    } catch {
      // Fallback to basic list if search-list fails
      const result = await inquirer.prompt([
        {
          type: "list",
          name: "selectedSlug",
          message: "Select a workspace:",
          choices,
          default: current,
        },
      ]);
      selectedSlug = result.selectedSlug;
    }

    // Return the selected team slug as the workspace
    return selectedSlug;
  } finally {
    // Clean up the client connection
    await client.close();
  }
}
