import { inspect } from "@deco/cf-sandbox";
import z from "zod";
import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import { DeconfigResource } from "../deconfig/deconfig-resource.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  createTool,
  DeconfigClient,
} from "../index.ts";
import { validate } from "../tools/utils.ts";
import {
  createDetailViewUrl,
  createListViewUrl,
  createViewImplementation,
  createViewRenderer,
} from "../views-v2/index.ts";
import { DetailViewRenderInputSchema } from "../views-v2/schemas.ts";
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
 * Returns only the core workflow execution tools (start and get status)
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

  return [decoWorkflowStart, decoWorkflowGetStatus];
}

/**
 * Creates Views 2.0 implementation for workflow views
 *
 * This function creates a complete Views 2.0 implementation that includes:
 * - Resources 2.0 CRUD operations for views
 * - View render operations for workflow-specific views
 * - Resource-centric URL patterns for better organization
 *
 * @returns Views 2.0 implementation for workflow views
 */
export function createWorkflowViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Workflows);

  // Create view renderers for workflow views
  const workflowListRenderer = createViewRenderer({
    name: "workflow_list",
    title: "Workflow List",
    description: "Browse and manage workflows",
    icon: "https://example.com/icons/workflow-list.svg",
    tools: [
      "DECO_RESOURCE_WORKFLOW_SEARCH",
      "DECO_RESOURCE_WORKFLOW_CREATE",
      "DECO_RESOURCE_WORKFLOW_READ",
      "DECO_RESOURCE_WORKFLOW_UPDATE",
      "DECO_RESOURCE_WORKFLOW_DELETE",
    ],
    prompt:
      "You are helping the user browse and manage workflows. You can search for workflows, create new ones, and perform bulk operations. Provide clear feedback on all actions.",
    handler: (_input, _c) => {
      const url = createListViewUrl("workflow", integrationId);
      return Promise.resolve({ url });
    },
  });

  const workflowDetailRenderer = createViewRenderer({
    name: "workflow_detail",
    title: "Workflow Detail",
    description: "View and manage individual workflow details",
    icon: "https://example.com/icons/workflow-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_WORKFLOW_READ",
      "DECO_RESOURCE_WORKFLOW_UPDATE",
      "DECO_RESOURCE_WORKFLOW_DELETE",
      "DECO_WORKFLOW_START",
      "DECO_WORKFLOW_GET_STATUS",
    ],
    prompt:
      "You are helping the user manage a workflow. You can read the workflow details, update its properties, start or stop the workflow, and view its logs. Always confirm actions before executing them.",
    handler: (input, _c) => {
      const url = createDetailViewUrl(
        "workflow",
        integrationId,
        input.resource,
      );
      return Promise.resolve({ url });
    },
  });

  // Create Views 2.0 implementation
  const viewsV2Implementation = createViewImplementation({
    renderers: [workflowListRenderer, workflowDetailRenderer],
  });

  return viewsV2Implementation;
}
