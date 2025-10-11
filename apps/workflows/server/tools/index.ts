/**
 * Central export point for all tools organized by domain.
 *
 * This file aggregates all tools from different domains into a single
 * export, making it easy to import all tools in main.ts while keeping
 * the domain separation.
 */
import { aiExecutorTools } from "./ai-executor.ts";
import { userTools } from "./user.ts";
import { viewTools } from "./views.ts";
import { workflowTools } from "./workflows.ts";
import { workspaceTools } from "./workspace.ts";

// Export all tools from all domains
export const tools = [
  ...userTools,
  ...aiExecutorTools,
  ...workspaceTools,
  ...workflowTools,
  ...viewTools,
];
