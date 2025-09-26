import { useSuspenseQuery } from "@tanstack/react-query";
import {
  getWorkflowStatus,
  listWorkflowNames,
  listWorkflowRuns,
} from "../crud/workflows.ts";
import { InternalServerError } from "../errors.ts";
import { useSDK } from "./store.tsx";
import { useWorkflow as useWorkflowV2 } from "./resources-workflow.ts";
import type { WorkflowDefinition } from "../mcp/workflows/schemas.ts";

/**
 * Hook to get all unique workflow names in the workspace
 */
export const useWorkflowNames = () => {
  const { locator } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-names", locator],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowNames(locator, signal);
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    // Cache for 5 minutes since workflow names don't change often
    staleTime: 5 * 60 * 1000,
  });

  return {
    data,
    refetch,
    isRefetching,
  };
};

/**
 * Hook to get paginated runs for a specific workflow with statistics
 */
export const useWorkflowRuns = (
  workflowName: string,
  page = 1,
  per_page = 25,
) => {
  const { locator } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-runs", locator, workflowName, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowRuns(
        locator,
        page,
        per_page,
        workflowName,
        signal,
      );
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return {
    data,
    refetch,
    isRefetching,
  };
};

/**
 * Hook to get recent workflow runs from any workflow
 */
export const useRecentWorkflowRuns = (page = 1, per_page = 25) => {
  const { locator } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["recent-workflow-runs", locator, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowRuns(
        locator,
        page,
        per_page,
        undefined,
        signal,
      );
      return result;
    },
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    // Cache for 2 minutes since this shows recent activity
    staleTime: 2 * 60 * 1000,
  });

  return {
    data,
    refetch,
    isRefetching,
  };
};

export const useWorkflowStatus = (workflowName: string, instanceId: string) => {
  const { locator } = useSDK();
  return useSuspenseQuery({
    queryKey: ["workflow-status", locator, workflowName, instanceId],
    queryFn: ({ signal }) =>
      getWorkflowStatus(locator, { workflowName, instanceId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    refetchInterval: (query) => {
      const snapshot = query.state.data?.snapshot;
      const status = typeof snapshot === "string" ? snapshot : snapshot?.status;
      if (status === "success" || status === "failed") {
        return false;
      }
      return 1000; // Poll every 1 second by default
    },
  });
};

/**
 * Hook to get a workflow definition with fallback to empty workflow
 * Returns the new Workflow format
 */
export function useWorkflow(workflowUri: string) {
  const { data, isLoading, error } = useWorkflowV2(workflowUri);

  // If workflow doesn't exist, create a new one
  const workflow = data?.data || createEmptyWorkflow(workflowUri);

  return {
    workflow,
    isLoading,
    error: error?.message || null,
  };
}

/**
 * Hook to get a workflow definition by URI with fallback to empty workflow
 */
export function useWorkflowByUri(workflowUri: string) {
  const { data, isLoading, error } = useWorkflowV2(workflowUri);

  // If workflow doesn't exist, create a new one
  const workflow = data?.data || createEmptyWorkflow(workflowUri);

  return {
    workflow,
    isLoading,
    error: error?.message || null,
  };
}

function createEmptyWorkflow(name: string): WorkflowDefinition {
  return {
    name,
    description: `Workflow: ${name}`,
    inputSchema: {},
    outputSchema: {},
    steps: [],
  };
}
