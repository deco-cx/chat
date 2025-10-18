import { inspect } from "@deco/cf-sandbox";
import z from "zod";
import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { NotFoundError } from "../../errors.ts";
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
  runTool,
} from "../index.ts";
import { validate } from "../tools/utils.ts";
import {
  createDetailViewUrl,
  createViewImplementation,
  createViewRenderer,
} from "../views-v2/index.ts";
import { DetailViewRenderInputSchema } from "../views-v2/schemas.ts";
import {
  WORKFLOW_CREATE_PROMPT,
  WORKFLOW_DELETE_PROMPT,
  WORKFLOW_READ_PROMPT,
  WORKFLOW_RUN_READ_PROMPT,
  WORKFLOW_SEARCH_PROMPT,
  WORKFLOW_UPDATE_PROMPT,
  WORKFLOWS_START_WITH_URI_PROMPT,
} from "./prompts.ts";
import {
  CodeStepDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowRunDataSchema,
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
import {
  createResourceImplementation,
  type ResourceDefinition,
} from "../resources-v2/helpers.ts";
import type {
  InstanceGetResponse as CFInstanceGetResponse,
  InstanceListResponse as CFInstanceListResponse,
} from "cloudflare/resources/workflows/instances/instances";
import { ToolDefinitionSchema } from "../tools/schemas.ts";

/**
 * Metadata stored in workflow instance params.context
 */
interface WorkflowInstanceMetadata {
  workflowURI?: string;
  startedBy?: {
    id: string;
    email: string | undefined;
    name: string | undefined;
  };
  startedAt?: string;
}

/**
 * Structure of params passed to Cloudflare Workflows instances
 */
interface WorkflowInstanceParams {
  name?: string;
  context?: WorkflowInstanceMetadata & {
    workspace?: unknown;
    locator?: unknown;
  };
  [key: string]: unknown;
}

/**
 * Extended Cloudflare instance detail with typed params
 */
interface CFInstanceWithParams extends CFInstanceGetResponse {
  params: WorkflowInstanceParams;
}

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

    // Validate code step dependencies
    // New schema: steps have a `def` property containing the code step definition
    const codeSteps = workflow.steps.map((step) => step.def);

    for (const codeDef of codeSteps) {
      if (codeDef.dependencies && codeDef.dependencies.length > 0) {
        for (const dependency of codeDef.dependencies) {
          // Check if integration exists
          const integration = integrations.find(
            (item: { id: string; name: string; description?: string }) =>
              item.id === dependency.integrationId,
          );

          if (!integration) {
            const availableIntegrations = integrations.map(
              (item: { id: string; name: string; description?: string }) => ({
                id: item.id,
                name: item.name,
                description: item.description || "No description available",
              }),
            );

            throw new Error(
              `Code step '${codeDef.name}': Dependency validation failed. Integration '${dependency.integrationId}' not found.\n\nAvailable integrations:\n${JSON.stringify(availableIntegrations, null, 2)}`,
            );
          }

          // Check if all specified tools exist in the integration
          const integrationTools = Array.isArray(integration.tools)
            ? integration.tools
            : [];

          // If toolNames is undefined, all tools from the integration are available (backward compatibility)
          const toolsToValidate =
            dependency.toolNames ??
            integrationTools.map((t: { name: string }) => t.name);

          for (const toolName of toolsToValidate) {
            const tool = integrationTools.find(
              (t: { name: string }) => t.name === toolName,
            );

            if (!tool) {
              const availableTools = integrationTools.map(
                (t: {
                  name: string;
                  description?: string;
                  inputSchema?: Record<string, unknown>;
                  outputSchema?: Record<string, unknown>;
                }) => ({
                  name: t.name,
                  description: t.description || "No description available",
                  inputSchema: t.inputSchema || {},
                  outputSchema: t.outputSchema || {},
                }),
              );

              throw new Error(
                `Code step '${codeDef.name}': Dependency validation failed. Tool '${toolName}' not found in integration '${integration.name}' (${dependency.integrationId}).\n\nAvailable tools in this integration:\n${JSON.stringify(availableTools, null, 2)}`,
              );
            }
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
  resourceWorkflowUpdate: (
    uri: string,
    data: z.infer<typeof WorkflowDefinitionSchema>,
  ) => Promise<{ data: z.infer<typeof WorkflowDefinitionSchema> }>;
}

/**
 * Creates workflow binding implementation that accepts a resource reader
 * Returns only the core workflow execution tools (start and get status)
 */
export function createWorkflowBindingImpl({
  resourceWorkflowRead,
  resourceWorkflowUpdate,
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
        uri: z
          .string()
          .optional()
          .describe(
            "The Resources 2.0 URI of the workflow run (rsc://i:workflows-management/workflow_run/{runId}). Use DECO_RESOURCE_WORKFLOW_RUN_READ to get status and results.",
          ),
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
        if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
          return { error: "Workflow has no steps to execute" };
        }
        const inputSchema: Record<string, unknown> = workflow.steps[0].def
          .inputSchema ?? {
          type: "object",
        };
        const inputValidation = validate(input, inputSchema);
        if (!inputValidation.valid) {
          return {
            error: `First step input validation failed: ${inspect(inputValidation)}`,
          };
        }

        // Prepare metadata to be passed via context (persisted in instance params)
        const startedBy = c.user
          ? {
              // normalize to strings to avoid circular/complex structures
              id: String((c.user as { id?: string | number }).id ?? ""),
              email: (c.user as { email?: string })?.email,
              name:
                (c.user as { metadata?: { full_name?: string }; name?: string })
                  ?.metadata?.full_name ?? (c.user as { name?: string })?.name,
            }
          : undefined;
        const workflowURI = uri;
        const startedAt = new Date().toISOString();

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
              workflowURI,
              startedBy,
              startedAt,
            },
          },
        });

        // Return the workflow instance ID and Resources 2.0 URI
        const runId = workflowInstance.id;
        const runUri = `rsc://i:workflows-management/workflow_run/${encodeURIComponent(runId)}`;
        return { runId, uri: runUri };
      } catch (error) {
        return {
          error: `Workflow start failed: ${inspect(error)}`,
        };
      }
    },
  });

  const decoWorkflowRunStep = createTool({
    name: "DECO_WORKFLOW_RUN_STEP",
    description: "Run a step in a workflow",
    inputSchema: z.lazy(() =>
      z.object({
        tool: ToolDefinitionSchema,
        input: z
          .object({})
          .passthrough()
          .describe("The input data for the step"),
      }),
    ),
    outputSchema: z.lazy(() =>
      z.object({
        result: z.unknown().describe("The result of the step"),
      }),
    ),
    handler: async ({ tool, input }, c) => {
      const result = await runTool.handler({
        tool,
        input,
        authorization: c.cookie,
      });
      console.log({
        result,
      });
      return { result: result, resolvedInput: input, tool };
    },
  });

  const decoWorkflowCreateStep = createTool({
    name: "DECO_WORKFLOW_CREATE_STEP",
    description: "Create a new step in a workflow",
    inputSchema: z.lazy(() =>
      z.object({
        workflowUri: z
          .string()
          .describe(
            "The Resources 2.0 URI of the workflow to create the step in",
          ),
        step: WorkflowStepDefinitionSchema.omit({ output: true }),
      }),
    ),
    outputSchema: z.lazy(() =>
      z.object({
        success: z
          .boolean()
          .describe("Whether the step was created successfully"),
        error: z
          .string()
          .optional()
          .describe("Error message if the step creation failed"),
      }),
    ),
    handler: async ({ workflowUri, step }, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c);

      const { data: workflow } = await resourceWorkflowRead(workflowUri);

      console.log({ workflow });

      if (!workflow) {
        return { success: false, error: "Workflow not found" };
      }
      const newWorkflow = {
        ...workflow,
        steps: [...workflow.steps, step],
      };
      console.log({ newWorkflow });
      await resourceWorkflowUpdate(workflowUri, newWorkflow);

      console.log({ success: true });

      return { success: true };
    },
  });

  const decoWorkflowEditStep = createTool({
    name: "DECO_WORKFLOW_EDIT_STEP",
    description: "Edit a step in a workflow",
    inputSchema: z.lazy(() =>
      z.object({
        workflowUri: z
          .string()
          .describe(
            "The Resources 2.0 URI of the workflow to edit the step in",
          ),
        step: WorkflowStepDefinitionSchema.omit({ output: true }),
      }),
    ),
    outputSchema: z.lazy(() =>
      z.object({
        success: z
          .boolean()
          .describe("Whether the step was edited successfully"),
        error: z
          .string()
          .optional()
          .describe("Error message if the step editing failed"),
      }),
    ),
    handler: async ({ workflowUri, step }, c) => {
      try {
        assertHasWorkspace(c);
        await assertWorkspaceResourceAccess(c);

        const { data: workflow } = await resourceWorkflowRead(workflowUri);

        if (!workflow) {
          return { success: false, error: "Workflow not found" };
        }

        const stepIndex = workflow.steps.findIndex(
          (s) => s.def.name === step.def.name,
        );
        if (stepIndex === -1) {
          return { success: false, error: "Step not found" };
        }
        const updatedStep = {
          ...step,
          output: {},
        };
        const updatedWorkflow = {
          ...workflow,
          steps: workflow.steps.map((s, index) =>
            index === stepIndex ? updatedStep : s,
          ),
        };
        await resourceWorkflowUpdate(workflowUri, updatedWorkflow);

        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: `Step editing failed: ${inspect(error)}`,
        };
      }
    },
  });

  const decoWorkflowReadStep = createTool({
    name: "DECO_WORKFLOW_READ_STEP",
    description: "Read a step in a workflow",
    inputSchema: z.lazy(() =>
      z.object({
        workflowUri: z
          .string()
          .describe(
            "The Resources 2.0 URI of the workflow to read the step from",
          ),
        stepName: z.string().describe("The name of the step to read"),
      }),
    ),
    outputSchema: z.lazy(() =>
      z.object({
        step: WorkflowStepDefinitionSchema.describe("The step definition"),
      }),
    ),
    handler: async ({ workflowUri, stepName }, c) => {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c);

      const { data: workflow } = await resourceWorkflowRead(workflowUri);

      if (!workflow) {
        throw new NotFoundError(`Workflow ${workflowUri} not found`);
      }
      const step = workflow.steps.find((s) => s.def.name === stepName);

      if (!step) {
        throw new NotFoundError(
          `Step ${stepName} not found in workflow ${workflowUri}`,
        );
      }
      return { step };
    },
  });

  return [
    decoWorkflowStart,
    decoWorkflowRunStep,
    decoWorkflowCreateStep,
    decoWorkflowReadStep,
    decoWorkflowEditStep,
  ];
}

const WORKFLOW_DETAIL_PROMPT = `
You are a workflow orchestrator.
Your goal is to understand the user's enquires and help them manage and test their workflow.
You can read the workflow details, update its properties, run steps in the workflow, start the workflow and monitor the workflow execution. 
When you start a workflow using DECO_WORKFLOW_START, it returns a workflow_run URI.
Use DECO_RESOURCE_WORKFLOW_RUN_READ with that URI to monitor execution status, view step results, and retrieve logs. 

<STEP_EDITING>You can edit steps in the workflow using DECO_WORKFLOW_EDIT_STEP. Use this to update the definition of a step.</STEP_EDITING>
<STEP_EXECUTION>You can run steps in the workflow using DECO_WORKFLOW_RUN_STEP.</STEP_EXECUTION>
<WORKFLOW_START>You can start the workflow using DECO_WORKFLOW_START.</WORKFLOW_START>
<WORKFLOW_MONITOR>You can monitor the workflow execution using DECO_RESOURCE_WORKFLOW_RUN_READ.</WORKFLOW_MONITOR>
<WORKFLOW_UPDATE>You can update the whole workflow using DECO_RESOURCE_WORKFLOW_UPDATE. Avoid using this if you are just updating a step in the workflow, or creating a new one.</WORKFLOW_UPDATE>
`;

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
      "DECO_RESOURCE_WORKFLOW_UPDATE",
      "DECO_WORKFLOW_START",
      "DECO_WORKFLOW_RUN_STEP",
      "DECO_WORKFLOW_CREATE_STEP",
      "DECO_WORKFLOW_EDIT_STEP",
      "DECO_RESOURCE_WORKFLOW_RUN_READ",
    ],
    prompt: WORKFLOW_DETAIL_PROMPT,
    handler: (input, _c) => {
      const url = createDetailViewUrl(
        "workflow",
        integrationId,
        input.resource,
      );
      return Promise.resolve({ url });
    },
  });

  // Workflow Run Detail renderer (Resources V2: resourceName = workflow_run)
  const workflowRunDetailRenderer = createViewRenderer({
    name: "workflow_run",
    title: "Workflow Run Detail",
    description: "Inspect a specific workflow run details and status",
    icon: "https://example.com/icons/workflow-run-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: ["DECO_RESOURCE_WORKFLOW_RUN_READ"],
    prompt:
      "You are viewing a workflow run. Use DECO_RESOURCE_WORKFLOW_RUN_READ to show current status, step results, logs, and timing information. Help the user understand the run outcome and any errors. The workflow_run resource automatically refreshes with the latest execution state.",
    handler: (input, _c) => {
      // Reuse the same React view component used for workflows
      // It reads the resource URI and fetches details accordingly
      const url = createDetailViewUrl(
        "workflow_run",
        integrationId,
        input.resource,
      );
      return Promise.resolve({ url });
    },
  });

  // Create Views 2.0 implementation
  const viewsV2Implementation = createViewImplementation({
    renderers: [workflowDetailRenderer, workflowRunDetailRenderer],
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
              prompt:
                "You are a specialist for crud operations on resources. Use the resource tools to read, search, create, update, or delete items; do not fabricate data.",
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
                "DECO_WORKFLOW_RUN_STEP",
                "DECO_WORKFLOW_CREATE_STEP",
                "DECO_WORKFLOW_EDIT_STEP",
                "DECO_RESOURCE_WORKFLOW_RUN_READ",
                "DECO_RESOURCE_WORKFLOW_UPDATE",
              ],
              prompt:
                "You are a workflow editing specialist. Use DECO_WORKFLOW_START to execute workflows, which returns a workflow_run URI. Then use DECO_RESOURCE_WORKFLOW_RUN_READ to monitor execution and retrieve results. A good strategy is to test each step one at a time in isolation and check how they affect the overall workflow.",
            },
          ],
        };
      },
    },
  ],
  createWorkflowTool,
);

function isCFInstance(value: unknown): value is CFInstanceListResponse {
  return (
    typeof value === "object" &&
    value != null &&
    // deno-lint-ignore no-explicit-any
    typeof (value as any).id === "string" &&
    // deno-lint-ignore no-explicit-any
    (typeof (value as any).created_on === "string" ||
      // deno-lint-ignore no-explicit-any
      typeof (value as any).modified_on === "string")
  );
}

/**
 * Workflow Runs Resource V2 (dynamic)
 *
 * Exposes workflow runs as a Resources 2.0 collection using the standard
 * DECO_RESOURCE_WORKFLOW_RUN_* tool naming. Backed by the existing
 * HOSTING_APP_WORKFLOWS_LIST_RUNS tool for search, and DECO_WORKFLOW_GET_STATUS
 * for read, so we can render a list with status using the generic Resources V2 UI.
 */
export function createWorkflowRunsResourceV2Implementation(
  _deconfig: DeconfigClient,
  _integrationId: string,
) {
  const definition: ResourceDefinition<typeof WorkflowRunDataSchema> = {
    name: "workflow_run",
    dataSchema: WorkflowRunDataSchema,
    // List runs from Cloudflare Workflows instances API, map into Resource 2.0 items
    searchHandler: async ({ pageSize = 10 }, c) => {
      await assertWorkspaceResourceAccess(c);

      const accountId = c.envVars.CF_ACCOUNT_ID;
      const now = new Date();
      const yearAgo = new Date(now);
      yearAgo.setFullYear(now.getFullYear() - 1);

      const listResult = await c.cf.workflows.instances
        .list(
          "workflow-runner",
          {
            account_id: accountId,
            date_start: yearAgo.toISOString(),
            date_end: now.toISOString(),
            per_page: pageSize,
            // @ts-expect-error non-typed param, but it works
            direction: "desc",
          },
          { maxRetries: 0 },
        )
        .catch(() => ({ result: [] }) as const);

      const instances = listResult.result?.filter(isCFInstance) ?? [];

      // Get current workspace identifier for filtering
      const currentWorkspaceValue = c.workspace?.value;

      // Prefetch details using fetchWorkflowStatus to derive metadata
      const detailsById = new Map<string, CFInstanceGetResponse | null>();
      await Promise.all(
        instances.map(async (inst) => {
          const runId = String(inst.id);
          const detail = await fetchWorkflowStatus(c, runId).catch(() => null);
          detailsById.set(runId, detail);
        }),
      );

      const items = instances
        .map((inst) => {
          const runId = String(inst.id);
          const detail = detailsById.get(runId);
          const params = detail?.params as WorkflowInstanceParams | undefined;

          // Filter: only include runs from the current workspace
          const runWorkspaceValue = (
            params?.context?.workspace as { value?: string }
          )?.value;
          if (
            currentWorkspaceValue &&
            runWorkspaceValue !== currentWorkspaceValue
          ) {
            return null;
          }

          const workflowURI = params?.context?.workflowURI;
          const displayName = params?.name ?? "Untitled";

          // Normalize status using our helper
          const status = detail
            ? mapWorkflowStatus(detail.status)
            : String(inst.status ?? "unknown");

          // Extract timestamps from detailed status or fallback to instance list data
          let createdAt: string | undefined;
          let updatedAt: string | undefined;
          if (detail) {
            const { startTime, endTime } = extractWorkflowTiming(detail);
            createdAt = new Date(startTime).toISOString();
            updatedAt = endTime ? new Date(endTime).toISOString() : undefined;
          } else {
            createdAt = inst.started_on || inst.created_on;
            updatedAt = inst.ended_on || inst.modified_on;
          }

          const uri = `rsc://i:workflows-management/workflow_run/${encodeURIComponent(runId)}`;

          const createdBy = params?.context?.startedBy?.id
            ? String(params.context.startedBy.id)
            : undefined;

          return {
            uri,
            data: {
              name: displayName,
              description: status,
              status,
              runId,
              workflowURI,
            },
            created_at: createdAt
              ? new Date(createdAt).toISOString()
              : undefined,
            updated_at: updatedAt
              ? new Date(updatedAt).toISOString()
              : undefined,
            created_by: createdBy,
            updated_by: createdBy,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Fixed-size single page for UI simplicity
      return {
        items,
        totalCount: items.length,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    },
    // Read returns the latest status for the run (normalized with fallback)
    readHandler: async ({ uri }, c) => {
      await assertWorkspaceResourceAccess(c);

      // Parse resource id back into runId
      const segments = uri.split("/");
      const runId = decodeURIComponent(segments[segments.length - 1]);

      // Fetch detailed status with fallback (includes params when available)
      const workflowStatus = await fetchWorkflowStatus(c, runId).catch(
        () => null,
      );

      // Enrich with metadata from instance params (if present in detailed status)
      const params = workflowStatus?.params as
        | WorkflowInstanceParams
        | undefined;

      // Filter: verify the run belongs to the current workspace
      const currentWorkspaceValue = c.workspace?.value;
      const runWorkspaceValue = (
        params?.context?.workspace as { value?: string }
      )?.value;

      if (
        currentWorkspaceValue &&
        runWorkspaceValue &&
        runWorkspaceValue !== currentWorkspaceValue
      ) {
        throw new NotFoundError(
          `Workflow run '${runId}' not found or not accessible in this workspace`,
        );
      }

      // Normalize status string
      const status = workflowStatus
        ? mapWorkflowStatus(workflowStatus.status)
        : "pending";

      const workflowURI = params?.context?.workflowURI;
      const displayName = params?.name ?? "Untitled";
      const createdBy = params?.context?.startedBy?.id
        ? String(params.context.startedBy.id)
        : undefined;

      // Timestamps from the status payload
      let createdAtIso: string | undefined;
      let updatedAtIso: string | undefined;
      let startTime: number | undefined;
      let endTime: number | undefined;
      if (workflowStatus) {
        const timing = extractWorkflowTiming(workflowStatus);
        startTime = timing.startTime;
        endTime = timing.endTime;
        createdAtIso = new Date(startTime).toISOString();
        updatedAtIso = endTime ? new Date(endTime).toISOString() : undefined;
      }

      // Process workflow data to include all status fields
      const stepResults = workflowStatus
        ? processWorkflowSteps(workflowStatus)
        : undefined;
      const currentStep = workflowStatus
        ? findCurrentStep(workflowStatus.steps, status)
        : undefined;
      const logs = workflowStatus
        ? extractStepLogs(workflowStatus.steps)
        : undefined;
      const error = workflowStatus
        ? formatWorkflowError(workflowStatus)
        : undefined;

      // Calculate partial result for ongoing workflows
      const partialResult =
        stepResults &&
        Object.keys(stepResults).length > 0 &&
        status !== "completed"
          ? {
              completedSteps: Object.keys(stepResults),
              stepResults,
            }
          : undefined;

      return {
        uri,
        data: {
          name: displayName,
          description: status,
          status,
          runId,
          workflowURI,
          // Processed status fields from DECO_WORKFLOW_GET_STATUS
          currentStep,
          stepResults,
          finalResult: workflowStatus?.output,
          partialResult,
          error,
          logs: logs && logs.length > 0 ? logs : undefined,
          startTime,
          endTime,
          // Raw workflow status data - let frontend handle transformations
          workflowStatus: workflowStatus ?? undefined,
        },
        created_at: createdAtIso,
        updated_at: updatedAtIso,
        created_by: createdBy,
        updated_by: createdBy,
      };
    },
  };

  const implementation = createResourceImplementation(definition);

  // Apply enhanced description to the READ tool
  const readToolIndex = implementation.findIndex(
    (tool) => tool.name === "DECO_RESOURCE_WORKFLOW_RUN_READ",
  );
  if (readToolIndex >= 0) {
    implementation[readToolIndex].description = WORKFLOW_RUN_READ_PROMPT;
  }

  return implementation;
}
