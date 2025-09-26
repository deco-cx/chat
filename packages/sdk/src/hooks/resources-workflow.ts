import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { WellKnownMcpGroups, formatIntegrationId } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import type { ReadOutput } from "../mcp/resources-v2/schemas.ts";
import { WorkflowDefinitionSchema } from "../mcp/workflows/schemas.ts";
import { useSDK } from "./store.tsx";

// Resources V2 tool names for workflow
const RESOURCE_WORKFLOW = {
  SEARCH: "DECO_RESOURCE_WORKFLOW_SEARCH" as const,
  READ: "DECO_RESOURCE_WORKFLOW_READ" as const,
  CREATE: "DECO_RESOURCE_WORKFLOW_CREATE" as const,
  UPDATE: "DECO_RESOURCE_WORKFLOW_UPDATE" as const,
  DELETE: "DECO_RESOURCE_WORKFLOW_DELETE" as const,
};

// Workflow execution tools
const WORKFLOW_TOOLS = {
  START: "DECO_WORKFLOW_START" as const,
  GET_STATUS: "DECO_WORKFLOW_GET_STATUS" as const,
};

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator, `/${WellKnownMcpGroups.Workflows}/mcp`);

const integrationId = formatIntegrationId(WellKnownMcpGroups.Workflows);

export function buildWorkflowUri(name: string): string {
  // rsc://i:workflows-management/workflow/<id>
  return `rsc://${integrationId}/workflow/${name}`;
}

// CRUD Functions (Resources V2)
export type WorkflowReadResult = ReadOutput<typeof WorkflowDefinitionSchema>;

export function getWorkflowByName(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
): Promise<WorkflowReadResult> {
  // Deprecated: prefer getWorkflowByUri with rsc:// URI
  return getWorkflowByUri(locator, buildWorkflowUri(name), signal);
}

export function getWorkflowByUri(
  locator: ProjectLocator,
  uri: string,
  signal?: AbortSignal,
): Promise<WorkflowReadResult> {
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_WORKFLOW.READ](
    { uri },
    { signal },
  ) as Promise<WorkflowReadResult>;
}

export interface WorkflowUpsertParamsV2 {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  steps: Array<{
    type: "tool_call" | "code";
    def: Record<string, unknown>;
  }>;
}

export function upsertWorkflow(
  locator: ProjectLocator,
  params: WorkflowUpsertParamsV2,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);

  // Try update by URI first, fallback to create on not found
  return (client as any)
    [RESOURCE_WORKFLOW.UPDATE](
      {
        uri: buildWorkflowUri(params.name),
        data: {
          name: params.name,
          description: params.description,
          inputSchema: params.inputSchema,
          outputSchema: params.outputSchema,
          steps: params.steps,
        },
      },
      { signal },
    )
    .catch(() =>
      (client as any)[RESOURCE_WORKFLOW.CREATE](
        {
          data: {
            name: params.name,
            description: params.description,
            inputSchema: params.inputSchema,
            outputSchema: params.outputSchema,
            steps: params.steps,
          },
        },
        { signal },
      ),
    );
}

export function deleteWorkflow(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator) as any;
  return client[RESOURCE_WORKFLOW.DELETE](
    {
      uri: buildWorkflowUri(name),
    },
    { signal },
  );
}

// Workflow execution
export interface WorkflowStartParamsV2 {
  uri: string;
  input: Record<string, unknown>;
  stopAfter?: string;
  state?: Record<string, unknown>;
}

export interface WorkflowStatusParamsV2 {
  runId: string;
}

export function startWorkflow(
  locator: ProjectLocator,
  params: WorkflowStartParamsV2,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator) as any;
  return client[WORKFLOW_TOOLS.START](params as any, { signal });
}

export function getWorkflowStatus(
  locator: ProjectLocator,
  params: WorkflowStatusParamsV2,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator) as any;
  return client[WORKFLOW_TOOLS.GET_STATUS](params as any, { signal });
}

export const useWorkflow = (workflowUri: string) => {
  const { locator } = useSDK();

  return useQuery({
    queryKey: ["workflow-by-uri-v2", locator, workflowUri],
    queryFn: async ({ signal }) =>
      getWorkflowByUri(locator, workflowUri, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUpsertWorkflow = () => {
  const { locator } = useSDK();
  return useMutation({
    mutationFn: async (params: WorkflowUpsertParamsV2) => {
      const result = await upsertWorkflow(locator, params);
      return result;
    },
  });
};

export const useStartWorkflow = () => {
  const { locator } = useSDK();
  return useMutation({
    mutationFn: async (params: WorkflowStartParamsV2) => {
      const result = (await startWorkflow(locator, params)) as {
        error?: string;
        runId?: string;
      };
      if (result.error) {
        throw new Error(result.error);
      }
      return result;
    },
  });
};

export const useWorkflowStatus = (runId: string) => {
  const { locator } = useSDK();

  return useSuspenseQuery({
    queryKey: ["workflow-status-v2", locator, runId],
    queryFn: ({ signal }) => getWorkflowStatus(locator, { runId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string } | undefined;
      const status = data?.status;
      if (status === "completed" || status === "failed") {
        return false;
      }
      return 1000;
    },
  });
};
