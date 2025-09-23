import { inspect } from "@deco/cf-sandbox";
import z from "zod";
import { VIEW_BINDING_SCHEMA } from "../bindings/views.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import { DeconfigResource } from "../deconfig/deconfig-resource.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  createTool,
  DeconfigClient,
  impl,
  WellKnownBindings,
} from "../index.ts";
import { validate } from "../tools/utils.ts";
import {
  WORKFLOW_CREATE_PROMPT,
  WORKFLOW_DELETE_PROMPT,
  WORKFLOW_READ_PROMPT,
  WORKFLOW_SEARCH_PROMPT,
  WORKFLOW_UPDATE_PROMPT,
  WORKFLOWS_GET_STATUS_PROMPT,
  WORKFLOWS_START_WITH_URI_PROMPT,
} from "./prompts.ts";
import {
  CodeStepDefinitionSchema,
  ToolCallStepDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStepDefinitionSchema,
} from "./schemas.ts";
import {
  extractStepLogs,
  extractWorkflowTiming,
  fetchWorkflowStatus,
  findCurrentStep,
  formatWorkflowError,
  mapWorkflowStatus,
  processWorkflowSteps,
} from "./utils.ts";

/**
 * Legacy WorkflowResource for backward compatibility
 * This is the old DeconfigResource implementation
 */
export const WorkflowResource = DeconfigResource.define({
  directory: "/src/workflows",
  resourceName: "workflow",
  schema: WorkflowDefinitionSchema,
  enhancements: {
    DECO_CHAT_RESOURCES_CREATE: {
      description: WORKFLOW_CREATE_PROMPT,
    },
    DECO_CHAT_RESOURCES_UPDATE: {
      description: WORKFLOW_UPDATE_PROMPT,
    },
  },
});

export type CodeStepDefinition = z.infer<typeof CodeStepDefinitionSchema>;
export type ToolCallStepDefinition = z.infer<
  typeof ToolCallStepDefinitionSchema
>;
export type WorkflowStepDefinition = z.infer<
  typeof WorkflowStepDefinitionSchema
>;

/**
 * Workflow Resource V2
 *
 * This module provides a Resources 2.0 implementation for workflow management
 * using the DeconfigResources 2.0 system with file-based storage.
 *
 * Key Features:
 * - File-based workflow storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe workflow definitions with Zod validation
 * - Full CRUD operations for workflow management
 * - Integration with existing workflow schema system
 *
 * Usage:
 * - Workflows are stored as JSON files in /src/workflows directory
 * - Each workflow has a unique ID and follows Resources 2.0 URI format
 * - Full validation of workflow definitions against existing schemas
 */

// Create the WorkflowResourceV2 using DeconfigResources 2.0
export const WorkflowResourceV2 = DeconfigResourceV2.define({
  directory: "/src/workflows",
  resourceName: "workflow",
  dataSchema: WorkflowDefinitionSchema,
  enhancements: {
    DECO_RESOURCE_WORKFLOW_SEARCH: {
      description: WORKFLOW_SEARCH_PROMPT,
    },
    DECO_RESOURCE_WORKFLOW_READ: {
      description: WORKFLOW_READ_PROMPT,
    },
    DECO_RESOURCE_WORKFLOW_CREATE: {
      description: WORKFLOW_CREATE_PROMPT,
    },
    DECO_RESOURCE_WORKFLOW_UPDATE: {
      description: WORKFLOW_UPDATE_PROMPT,
    },
    DECO_RESOURCE_WORKFLOW_DELETE: {
      description: WORKFLOW_DELETE_PROMPT,
    },
  },
});

// Export types for TypeScript usage
export type WorkflowDataV2 = z.infer<typeof WorkflowDefinitionSchema>;
export type WorkflowResourceV2Type = typeof WorkflowResourceV2;

// Helper function to create a workflow resource instance
export function createWorkflowResourceV2(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return WorkflowResourceV2.client(deconfig, integrationId);
}

// Helper function to create a workflow resource implementation
export function createWorkflowResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return WorkflowResourceV2.create(deconfig, integrationId);
}

export interface WorkflowBindingImplOptions {
  resourceWorkflowRead: (
    uri: string,
  ) => Promise<{ data: z.infer<typeof WorkflowDefinitionSchema> }>;
}

/**
 * Creates workflow binding implementation that accepts a resource reader
 * Similar to the tools pattern but for workflows
 */
export function createWorkflowBindingImpl({
  resourceWorkflowRead,
}: WorkflowBindingImplOptions) {
  const decoWorkflowStart = createTool({
    name: "DECO_WORKFLOW_START",
    description: WORKFLOWS_START_WITH_URI_PROMPT,
    inputSchema: z.object({
      uri: z
        .string()
        .describe("The Resources 2.0 URI of the workflow to execute"),
      input: z
        .object({})
        .passthrough()
        .describe(
          "The input data that will be validated against the workflow's input schema and passed to the first step",
        ),
      stopAfter: z
        .string()
        .optional()
        .describe(
          "Optional step name where execution should halt. The workflow will execute up to and including this step, then stop. Useful for partial execution, debugging, or step-by-step testing.",
        ),
      state: z
        .object({})
        .passthrough()
        .optional()
        .describe(
          "Optional pre-computed step results to inject into the workflow state. Format: { 'step-name': STEP_RESULT }. Allows skipping steps by providing their expected outputs, useful for resuming workflows or testing with known intermediate results.",
        ),
    }),
    outputSchema: z.object({
      runId: z
        .string()
        .optional()
        .describe("The unique ID for tracking this workflow run"),
      error: z
        .string()
        .optional()
        .describe("Error message if workflow start failed"),
    }),
    handler: async ({ uri, input, stopAfter, state }, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c);

      try {
        // Read the workflow definition using the resource reader
        const { data: workflow } = await resourceWorkflowRead(uri);

        if (!workflow) {
          return { error: "Workflow not found" };
        }

        // Validate input against the workflow's input schema
        const inputValidation = validate(input, workflow.inputSchema);
        if (!inputValidation.valid) {
          return {
            error: `Input validation failed: ${inspect(inputValidation)}`,
          };
        }

        // Create workflow instance using Cloudflare Workflows
        const workflowInstance = await c.workflowRunner.create({
          params: {
            input,
            stopAfter,
            state,
            steps: workflow.steps,
            name: workflow.name,
            context: {
              workspace: c.workspace,
              locator: c.locator,
            },
          },
        });

        // Return the workflow instance ID directly from Cloudflare
        const runId = workflowInstance.id;
        return { runId };
      } catch (error) {
        return {
          error: `Workflow start failed: ${inspect(error)}`,
        };
      }
    },
  });

  const decoWorkflowGetStatus = createTool({
    name: "DECO_WORKFLOW_GET_STATUS",
    description: WORKFLOWS_GET_STATUS_PROMPT,
    inputSchema: z.object({
      runId: z.string().describe("The unique ID of the workflow run"),
    }),
    outputSchema: z.object({
      status: z
        .enum(["pending", "running", "completed", "failed"])
        .describe("The current status of the workflow run"),
      currentStep: z
        .string()
        .optional()
        .describe("The name of the step currently being executed (if running)"),
      stepResults: z.record(z.any()).describe("Results from completed steps"),
      finalResult: z
        .any()
        .optional()
        .describe("The final workflow result (if completed)"),
      partialResult: z
        .any()
        .optional()
        .describe("Partial results from completed steps (if pending/running)"),
      error: z
        .string()
        .optional()
        .describe("Error message if the workflow failed"),
      logs: z
        .array(
          z.object({
            type: z.enum(["log", "warn", "error"]),
            content: z.string(),
          }),
        )
        .describe("Console logs from the execution"),
      startTime: z.number().describe("When the workflow started (timestamp)"),
      endTime: z
        .number()
        .optional()
        .describe("When the workflow ended (timestamp, if completed/failed)"),
    }),
    handler: async ({ runId }, c) => {
      await assertWorkspaceResourceAccess(c);

      try {
        // Get workflow status from both sources
        const workflowStatus = await fetchWorkflowStatus(c, runId);

        // Map to our standardized status format
        const status = mapWorkflowStatus(workflowStatus.status);

        // Process workflow data
        const stepResults = processWorkflowSteps(workflowStatus);
        const currentStep = findCurrentStep(workflowStatus.steps, status);
        const logs = extractStepLogs(workflowStatus.steps);
        const { startTime, endTime } = extractWorkflowTiming(workflowStatus);
        const error = formatWorkflowError(workflowStatus);

        // Calculate partial result for ongoing workflows
        const partialResult =
          Object.keys(stepResults).length > 0 && status !== "completed"
            ? {
                completedSteps: Object.keys(stepResults),
                stepResults,
              }
            : undefined;

        return {
          status,
          currentStep,
          stepResults,
          finalResult: workflowStatus.output,
          partialResult,
          error,
          logs,
          startTime,
          endTime,
        };
      } catch (error) {
        throw new Error(`Workflow run '${runId}' not found: ${inspect(error)}`);
      }
    },
  });

  // Create workflow views
  const workflowViews = impl(VIEW_BINDING_SCHEMA, [
    // DECO_CHAT_VIEWS_LIST
    {
      description: "List views exposed by this MCP",
      handler: (_, c) => {
        c.resourceAccess.grant();

        const org = c.locator?.org;
        const project = c.locator?.project;

        if (!org || !project) {
          return { views: [] };
        }

        return {
          views: [
            // Workflow List View
            {
              name: "WORKFLOWS_LIST",
              title: "Workflows",
              description: "Manage and monitor your workflows",
              icon: "workflow",
              url: `internal://resource/list?name=workflow`,
              tools: WellKnownBindings.Resources.map(
                (resource) => resource.name,
              ),
              rules: [
                "You are a specialist for crud operations on resources. Use the resource tools to read, search, create, update, or delete items; do not fabricate data.",
              ],
            },
            // Workflow Detail View (for individual workflow management)
            {
              name: "WORKFLOW_DETAIL",
              title: "Workflow Detail",
              description: "View and manage individual workflow details",
              icon: "workflow",
              url: `internal://resource/detail?name=workflow`,
              mimeTypePattern: "application/json",
              resourceName: "workflow",
              tools: [
                decoWorkflowStart.name,
                decoWorkflowGetStatus.name,
                "DECO_RESOURCE_WORKFLOW_READ",
                "DECO_RESOURCE_WORKFLOW_UPDATE",
                "DECO_RESOURCE_WORKFLOW_SEARCH",
              ],
              rules: [
                "You are a workflow editing specialist. Use the workflow tools to edit the current workflow. A good strategy is to test each step, one at a time in isolation and check how they affect the overall workflow.",
              ],
            },
          ],
        };
      },
    },
  ]);

  return [decoWorkflowStart, decoWorkflowGetStatus, ...workflowViews];
}
