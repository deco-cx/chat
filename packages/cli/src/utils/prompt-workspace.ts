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
 * @param local - Whether to use local deco.chat instance
 * @returns Promise<string> - The selected team slug
 * @throws Error if no session is found or no teams are available
 */
import { Select } from "@cliffy/prompt";
import { z } from "zod";
import { createWorkspaceClient } from "../mcp.ts";
import { readSession } from "../session.ts";

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
        // @ts-expect-error We need to refactor TEAMS_LIST to stop returning array and use a proper object
      },
      z.any(),
    );

    if (response.isError) {
      throw new Error("Failed to fetch teams");
    }

    const teams = response.structuredContent as Team[];

    if (!teams || teams.length === 0) {
      throw new Error("No teams found. Please create a team first.");
    }

    // Create options for the select component
    const options = teams.map((team) => ({
      name: team.name,
      value: team.slug,
    }));

    // Prompt user to select a team
    const selectedSlug = await Select.prompt({
      message: "Select a workspace:",
      options,
      default: current,
      search: true, // Enable searching since there can be many teams
    });

    // Return the selected team slug as the workspace
    return selectedSlug;
  } finally {
    // Clean up the client connection
    await client.close();
  }
}
