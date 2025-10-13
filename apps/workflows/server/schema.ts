/**
 * Workflow Type Definitions
 *
 * This file defines the TypeScript types for workflows used in the frontend.
 * These types match the schema defined in packages/sdk/src/mcp/workflows/schemas.ts
 */

// JSON Schema type
export type JSONSchema = Record<string, unknown>;

// Workflow step definition
export interface WorkflowStepDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  input: Record<string, unknown>;
  execute: string;
  dependencies?: Array<{ integrationId: string }>;
  options?: {
    retries?: {
      limit?: number;
      delay?: number;
      backoff?: "constant" | "linear" | "exponential";
    };
    timeout?: number;
  };
}

// Workflow definition
export interface WorkflowDefinition {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  steps: WorkflowStepDefinition[];
}

// Step execution result
export interface StepExecutionResult {
  executedAt: string;
  value: unknown;
  error?: string;
  duration?: number;
}
