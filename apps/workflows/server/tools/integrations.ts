/**
 * Integration and registry management tools.
 *
 * This file contains all tools related to managing integrations and the registry:
 * - List installed tools/integrations
 * - List available tools for installation
 * - Manage API keys and authorizations
 */
import { createPrivateTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";

/**
 * List all installed integrations/tools in the current workspace
 */
export const createListInstalledToolsTool = (env: Env) =>
  createPrivateTool({
    id: "LIST_INSTALLED_INTEGRATIONS",
    description:
      "List all installed integrations and tools available in the current workspace",
    inputSchema: z.object({}),
    outputSchema: z.object({
      integrations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          icon: z.string().optional(),
          access: z.any().optional(),
        }),
      ),
      success: z.boolean(),
    }),
    execute: async () => {
      try {
        const result = await env.INTEGRATIONS.INTEGRATIONS_LIST({});

        return {
          integrations: result.items || [],
          success: true,
        };
      } catch (error) {
        console.error("Error listing installed tools:", error);
        // Return empty list on error instead of throwing
        return {
          integrations: [],
          success: false,
        };
      }
    },
  });

// Export all integration tools
export const integrationTools = [createListInstalledToolsTool];
