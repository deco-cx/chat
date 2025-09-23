import { useMutation, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { WellKnownMcpGroups } from "../crud/groups.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { ProjectLocator } from "../locator.ts";
import { WellKnownBindings } from "../mcp/index.ts";
import { WorkflowDefinitionSchema } from "../mcp/workflows/schemas.ts";
import { useSDK } from "./store.tsx";

// Types and interfaces
export type ResourceBinding = (typeof WellKnownBindings)["Resources"];

export interface SandboxWorkflowDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  steps: Array<{
    type: "tool_call" | "code";
    def: Record<string, unknown>;
  }>;
}

export interface SandboxWorkflowUpsertParams {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  steps: Array<{
    type: "tool_call" | "code";
    def: Record<string, unknown>;
  }>;
}

export interface SandboxWorkflowStartParams {
  name: string;
  input: Record<string, unknown>;
}

export interface SandboxWorkflowStatusParams {
  runId: string;
}

// Constants
const RESOURCE_NAME = "workflow";

// Helper functions
const workspaceResourceClient = (locator: ProjectLocator) =>
  MCPClient.forLocator<ResourceBinding>(
    locator,
    `/${WellKnownMcpGroups.Workflows}/mcp`,
  );

// Type for client with workflow methods
type ClientWithWorkflows = ReturnType<typeof workspaceResourceClient> & {
  WORKFLOWS_START: (
    params: SandboxWorkflowStartParams,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
  WORKFLOWS_GET_STATUS: (
    params: SandboxWorkflowStatusParams,
    options?: { signal?: AbortSignal },
  ) => Promise<unknown>;
};

// Helper function to build workflow URI
function buildWorkflowUri(name: string): string {
  return `workflow://${name}`;
}

// CRUD Functions
export function getSandboxWorkflow(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);
  return client
    .DECO_CHAT_RESOURCES_READ(
      {
        name: RESOURCE_NAME,
        uri: buildWorkflowUri(name),
      },
      { signal },
    )
    .then((result) => WorkflowDefinitionSchema.parse(JSON.parse(result.data)));
}

export function upsertSandboxWorkflow(
  locator: ProjectLocator,
  params: SandboxWorkflowUpsertParams,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);

  // Check if workflow exists to determine CREATE vs UPDATE
  return getSandboxWorkflow(locator, params.name, signal)
    .then(() => {
      // Workflow exists, update it
      return client.DECO_CHAT_RESOURCES_UPDATE(
        {
          name: RESOURCE_NAME,
          uri: buildWorkflowUri(params.name),
          title: params.name,
          description: params.description,
          content: {
            type: "text" as const,
            data: JSON.stringify({
              name: params.name,
              description: params.description,
              inputSchema: params.inputSchema,
              outputSchema: params.outputSchema,
              steps: params.steps,
            }),
            mimeType: "application/json",
          },
        },
        { signal },
      );
    })
    .catch(() => {
      // Workflow doesn't exist, create it
      return client.DECO_CHAT_RESOURCES_CREATE(
        {
          name: RESOURCE_NAME,
          resourceName: params.name,
          title: params.name,
          description: params.description,
          content: {
            type: "text" as const,
            data: JSON.stringify({
              name: params.name,
              description: params.description,
              inputSchema: params.inputSchema,
              outputSchema: params.outputSchema,
              steps: params.steps,
            }),
            mimeType: "application/json",
          },
        },
        { signal },
      );
    });
}

export function startSandboxWorkflow(
  locator: ProjectLocator,
  params: SandboxWorkflowStartParams,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);
  return (client as ClientWithWorkflows).WORKFLOWS_START(params, { signal });
}

export function getSandboxWorkflowStatus(
  locator: ProjectLocator,
  params: SandboxWorkflowStatusParams,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);
  return (client as ClientWithWorkflows).WORKFLOWS_GET_STATUS(params, {
    signal,
  });
}

export function deleteSandboxWorkflow(
  locator: ProjectLocator,
  name: string,
  signal?: AbortSignal,
) {
  const client = workspaceResourceClient(locator);
  return client.DECO_CHAT_RESOURCES_DELETE(
    {
      name: RESOURCE_NAME,
      uri: buildWorkflowUri(name),
    },
    { signal },
  );
}

// Hooks
/**
 * Hook to get a sandbox workflow by name
 */
export const useSandboxWorkflow = (workflowName: string) => {
  const { locator } = useSDK();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sandbox-workflow", locator, workflowName],
    queryFn: async ({ signal }) => {
      const result = await getSandboxWorkflow(locator, workflowName, signal);
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook to get a sandbox workflow by URI
 */
export const useSandboxWorkflowByUri = (workflowUri: string) => {
  const { locator } = useSDK();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["sandbox-workflow-by-uri", locator, workflowUri],
    queryFn: async ({ signal }) => {
      const client = workspaceResourceClient(locator);
      const result = await client.DECO_CHAT_RESOURCES_READ(
        {
          name: "workflow",
          uri: workflowUri,
        },
        { signal },
      );
      return WorkflowDefinitionSchema.parse(JSON.parse(result.data));
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return {
    data,
    isLoading,
    error,
    refetch,
  };
};

/**
 * Hook to upsert (create or update) a sandbox workflow
 */
export const useUpsertSandboxWorkflow = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (params: SandboxWorkflowUpsertParams) => {
      const result = await upsertSandboxWorkflow(locator, params);
      return result;
    },
  });
};

/**
 * Hook to start a sandbox workflow execution
 */
export const useStartSandboxWorkflow = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (params: SandboxWorkflowStartParams) => {
      const result = (await startSandboxWorkflow(locator, params)) as {
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

/**
 * Hook to get the status of a sandbox workflow run
 */
export const useSandboxWorkflowStatus = (runId: string) => {
  const { locator } = useSDK();

  return useSuspenseQuery({
    queryKey: ["sandbox-workflow-status", locator, runId],
    queryFn: ({ signal }) =>
      getSandboxWorkflowStatus(locator, { runId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    refetchInterval: (query) => {
      const data = query.state.data as { status?: string } | undefined;
      const status = data?.status;
      if (status === "completed" || status === "failed") {
        return false;
      }
      return 1000; // Poll every 1 second by default
    },
  });
};

/**
 * Hook to delete a sandbox workflow
 */
export const useDeleteSandboxWorkflow = () => {
  const { locator } = useSDK();

  return useMutation({
    mutationFn: async (workflowName: string) => {
      const result = await deleteSandboxWorkflow(locator, workflowName);
      return result;
    },
  });
};
