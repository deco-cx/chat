/**
 * Workflow Data Models
 * Based on plans/00-IMPORTANTE-LEIA-PRIMEIRO.md and plans/02-data-model-and-refs.md
 *
 * ALL TYPES ARE DERIVED FROM RPC RETURN TYPES - NO NEW TYPES CREATED
 */

import { client } from "@/lib/rpc.ts";

/**
 * Reference to data from previous steps or external sources
 * Format: @stepId.path.to.value or @resource:type/id
 */
export type AtRef = `@${string}`;

/**
 * A single step in a workflow
 */
export type WorkflowStep = NonNullable<
  Awaited<ReturnType<typeof client.READ_WORKFLOW>>
>["workflow"]["steps"][number];
/**
 * Workflow resource (full response from READ operation)
 */
export type WorkflowResource = NonNullable<
  Awaited<ReturnType<typeof client.READ_WORKFLOW>>
>;

/**
 * Workflow data only (without resource metadata)
 */
export type Workflow = WorkflowResource["workflow"];

/**
 * Tool dependency structure
 */
export type WorkflowDependency = {
  integrationId: string;
};

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
