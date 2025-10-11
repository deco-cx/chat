/**
 * Workspace tools - Static catalog of known workspace tools
 *
 * Since we don't have DECO_CHAT_WORKSPACE_API binding, we provide
 * a static catalog based on mcp_integration_INTEGRATIONS_LIST discovery
 */
import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";

/**
 * Return static catalog of top workspace tools
 * Based on discovery via mcp_integration_INTEGRATIONS_LIST
 */
export const createDiscoverWorkspaceToolsTool = (_env: Env) =>
  createTool({
    id: "DISCOVER_WORKSPACE_TOOLS",
    description:
      "Get catalog of top workspace tools available for code generation",
    inputSchema: z.object({
      includeSchemas: z.boolean().optional().default(false),
    }),
    outputSchema: z.object({
      integrations: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          icon: z.string().optional(),
          toolCount: z.number(),
          tools: z.array(
            z.object({
              name: z.string(),
              description: z.string(),
              category: z.string(),
            }),
          ),
        }),
      ),
      totalTools: z.number(),
      summary: z.string(),
    }),
    execute: ({ context: _context }) => {
      // Static catalog - VERIFIED WORKING TOOLS ONLY (tested via test-tool.js)
      const catalog = {
        integrations: [
          {
            id: "i:workspace-management",
            name: "Workspace Management",
            description: "Verified working tools for workflow steps",
            icon: "https://assets.webdraw.app/uploads/deco-avocado-light.png",
            toolCount: 4, // Verified working
            tools: [
              // ✅ VERIFIED WORKING
              {
                name: "AI_GENERATE_OBJECT",
                description:
                  "Generate structured JSON with AI (Claude Sonnet 4.5)",
                category: "AI",
              },
              {
                name: "DATABASES_RUN_SQL",
                description: "Execute SQL queries (nested result structure)",
                category: "Database",
              },
              {
                name: "KNOWLEDGE_BASE_SEARCH",
                description: "Search knowledge base documents",
                category: "Knowledge",
              },
              {
                name: "Simple Logic",
                description: "Pure JavaScript calculations (no tool calls)",
                category: "Logic",
              },

              // ⏸️ TODO: NEEDS TESTING (requires setup/data)
              // { name: 'AI_GENERATE', description: 'Generate text with AI', category: 'AI' },
              // { name: 'DATABASES_GET_META', description: 'Get database metadata', category: 'Database' },
              // { name: 'KNOWLEDGE_BASE_ADD_FILE', description: 'Add file to KB', category: 'Knowledge' },
              // { name: 'AGENTS_LIST', description: 'List agents', category: 'Agents' },
              // { name: 'AGENTS_CREATE', description: 'Create agent', category: 'Agents' },
              // { name: 'FS_READ', description: 'Read file', category: 'FileSystem' },
              // { name: 'FS_WRITE', description: 'Write file', category: 'FileSystem' },
              // { name: 'FS_LIST', description: 'List files', category: 'FileSystem' },
              // { name: 'MODELS_LIST', description: 'List AI models', category: 'Models' },
              // { name: 'HOSTING_APPS_LIST', description: 'List hosted apps', category: 'Hosting' },
              // { name: 'GET_WALLET_ACCOUNT', description: 'Get wallet balance', category: 'Billing' },
              // { name: 'PROMPTS_LIST', description: 'List prompts', category: 'Prompts' },

              // ❌ AVOID: Not suitable for dynamic code execution
              // { name: 'DECO_TOOL_RUN_TOOL', description: 'Execute dynamic code (recursive)', category: 'Tools' },
              // { name: 'INTEGRATIONS_LIST', description: 'List integrations (context only)', category: 'Discovery' },
              // { name: 'INTEGRATIONS_CALL_TOOL', description: 'Call any tool (too generic)', category: 'Discovery' },
              // { name: 'DECO_WORKFLOW_START', description: 'Start workflow (external)', category: 'Workflows' },
              // { name: 'DECO_WORKFLOW_GET_STATUS', description: 'Get workflow status (external)', category: 'Workflows' },
            ],
          },
        ],
        totalTools: 4, // Only verified working tools
        summary:
          "Verified working tools for i:workspace-management (AI, DB, KB, Logic)",
      };

      return catalog;
    },
  });

export const workspaceTools = [createDiscoverWorkspaceToolsTool];
