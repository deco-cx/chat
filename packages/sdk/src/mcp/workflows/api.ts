import { inspect } from "@deco/cf-sandbox";
import { z } from "zod";
import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { impl } from "../bindings/binder.ts";
import { WellKnownBindings } from "../bindings/index.ts";
import { VIEW_BINDING_SCHEMA } from "../bindings/views.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import { DeconfigResource } from "../deconfig/deconfig-resource.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  createMCPToolsStub,
  createTool,
  createToolGroup,
  DeconfigClient,
  PROJECT_TOOLS,
} from "../index.ts";
import { validate } from "../tools/utils.ts";
import {
  createViewImplementation,
  createViewRenderer
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
  group: WellKnownMcpGroups.Workflows,
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
  validate: async (workflow, context, _deconfig) => {
    // Create an MCPClientStub to call INTEGRATIONS_LIST
    const client = createMCPToolsStub({
      tools: PROJECT_TOOLS,
      context,
    });

    const result = await client.INTEGRATIONS_LIST({});
    const integrations = result.items;

    // Validate step dependencies (integration references)
    for (const step of workflow.steps) {
      if (step.dependencies && step.dependencies.length > 0) {
        for (const dependency of step.dependencies) {
          const integration = integrations.find(
            (item: { id: string; name: string }) =>
              item.id === dependency.integrationId,
          );

          if (!integration) {
            const availableIntegrations = integrations.map(
              (item: { id: string; name: string }) => ({
                id: item.id,
                name: item.name,
              }),
            );

            throw new Error(
              `Step '${step.name}': Dependency validation failed. Integration '${dependency.integrationId}' not found.\n\nAvailable integrations:\n${JSON.stringify(availableIntegrations, null, 2)}`,
            );
          }
        }
      }
    }
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
    inputSchema: z.lazy(() =>
      z.object({
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
    ),
    outputSchema: z.lazy(() =>
      z.object({
        runId: z
          .string()
          .optional()
          .describe("The unique ID for tracking this workflow run"),
        error: z
          .string()
          .optional()
          .describe("Error message if workflow start failed"),
      }),
    ),
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
    inputSchema: z.lazy(() =>
      z.object({
        runId: z.string().describe("The unique ID of the workflow run"),
      }),
    ),
    outputSchema: z.lazy(() =>
      z.object({
        status: z
          .enum(["pending", "running", "completed", "failed"])
          .describe("The current status of the workflow run"),
        currentStep: z
          .string()
          .optional()
          .describe(
            "The name of the step currently being executed (if running)",
          ),
        stepResults: z.record(z.any()).describe("Results from completed steps"),
        finalResult: z
          .any()
          .optional()
          .describe("The final workflow result (if completed)"),
        partialResult: z
          .any()
          .optional()
          .describe(
            "Partial results from completed steps (if pending/running)",
          ),
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
    ),
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
      // TODO: Do not ship it to main

      // const url = createDetailViewUrl(
      //   "workflow",
      //   integrationId,
      //   input.resource,
      // );

      const url = new URL("/workflow", "http://localhost:8787");
      url.searchParams.set("resourceURI", input.resource);

      return Promise.resolve({ url: url.href });
    },
  });

  // Create Views 2.0 implementation
  const viewsV2Implementation = createViewImplementation({
    renderers: [workflowDetailRenderer],
  });

  return viewsV2Implementation;
}

const createWorkflowTool = createToolGroup("Workflows", {
  name: "Workflows Management",
  description: "Manage your workflows",
  icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
});
/**
 * Creates legacy workflow views implementation for backward compatibility
 *
 * This provides the legacy VIEW_BINDING_SCHEMA implementation that was used
 * before the Views 2.0 system. It creates workflow list and detail views
 * using the internal://resource URL pattern.
 *
 * @returns Legacy workflow views implementation using VIEW_BINDING_SCHEMA
 */
export const workflowViews = impl(
  VIEW_BINDING_SCHEMA,
  [
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
                "DECO_WORKFLOW_START",
                "DECO_WORKFLOW_GET_STATUS",
                "DECO_RESOURCE_WORKFLOW_UPDATE",
              ],
              rules: [
                "You are a workflow editing specialist. Use the workflow tools to edit the current workflow. A good strategy is to test each step, one at a time in isolation and check how they affect the overall workflow.",
              ],
            },
          ],
        };
      },
    },
  ],
  createWorkflowTool,
);
