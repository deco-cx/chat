/**
 * Workflow Data Models
 * Based on plans/00-IMPORTANTE-LEIA-PRIMEIRO.md and plans/02-data-model-and-refs.md
 */

import type { ViewDefinition } from "./views.ts";

/**
 * Reference to data from previous steps or external sources
 * Format: @stepId.path.to.value or @resource:type/id
 */
export type AtRef = `@${string}`;

/**
 * A single step in a workflow
 */
export interface WorkflowStep {
  id: string; // Unique identifier (step-1, step-2, etc)
  name: string; // Human-readable name
  description?: string; // What this step does

  // Tool execution
  code: string; // ES module code: "export default async function (input, ctx) { ... }"
  inputSchema: Record<string, unknown>; // JSON Schema for input validation
  outputSchema: Record<string, unknown>; // JSON Schema for output validation

  // Input can contain @refs that need resolution
  input: Record<
    string,
    | string
    | number
    | boolean
    | null
    | AtRef
    | Record<string, unknown>
    | Array<unknown>
  >;

  // Execution metadata
  primaryIntegration?: string; // Main integration ID used (e.g., "SELF", "i:slack_123")
  primaryTool?: string; // Main tool called (e.g., "LIST_TODOS")
  usedTools?: Array<{
    // All tools used in this step
    integration: string;
    tool: string;
  }>;

  // Custom Views (optional)
  inputView?: ViewDefinition; // Custom view for rendering input form
  outputView?: ViewDefinition; // Custom view for rendering output data

  // Execution results (filled after running)
  result?: {
    success: boolean;
    output?: unknown;
    error?: unknown;
    logs?: Array<{ type: string; content: string }>;
    executedAt?: string; // ISO timestamp
    duration?: number; // Execution time in ms
  };
}

/**
 * A workflow is a sequence of steps
 */
export interface Workflow {
  id: string; // Unique identifier
  name: string; // Human-readable name
  description?: string; // What this workflow does

  steps: WorkflowStep[]; // Ordered list of steps

  // Metadata
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  createdBy?: string; // User ID

  // Execution state
  status?: "draft" | "running" | "completed" | "failed";
  currentStepIndex?: number; // Which step is currently running

  // Global workflow input (can be referenced in steps as @input.fieldName)
  input?: Record<
    string,
    string | number | boolean | null | Record<string, unknown>
  >;

  // Final workflow output (result from last step)
  output?: Record<string, unknown> | string | number | boolean | null;
}

/**
 * Result of resolving @refs in input
 */
export interface ResolvedInput {
  resolved: Record<string, unknown>; // Input with @refs replaced by actual values
  errors?: Array<{
    ref: string;
    error: string;
  }>;
}

/**
 * Execution context for a workflow
 */
export interface WorkflowExecutionContext {
  workflow: Workflow;
  stepResults: Map<string, unknown>; // Map of stepId -> result
  globalInput?: Record<string, unknown>;
}
