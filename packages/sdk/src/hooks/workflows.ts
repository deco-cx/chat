import { useSuspenseQuery } from "@tanstack/react-query";
import {
  getWorkflowStatus,
  listWorkflowNames,
  listWorkflowRuns,
} from "../crud/workflows.ts";
import { InternalServerError } from "../errors.ts";
import { useSDK } from "./store.tsx";

/**
 * Hook to get all unique workflow names in the workspace
 */
export const useWorkflowNames = () => {
  const { workspace } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-names", workspace],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowNames(workspace, signal);
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
  const { workspace } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["workflow-runs", workspace, workflowName, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowRuns(
        workspace,
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
export const useRecentWorkflowRuns = (
  page = 1,
  per_page = 25,
) => {
  const { workspace } = useSDK();

  const { data, refetch, isRefetching } = useSuspenseQuery({
    queryKey: ["recent-workflow-runs", workspace, page, per_page],
    queryFn: async ({ signal }) => {
      const result = await listWorkflowRuns(
        workspace,
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

export const useWorkflowStatus = (
  workflowName: string,
  instanceId: string,
) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: ["workflow-status", workspace, workflowName, instanceId],
    queryFn: ({ signal }) =>
      getWorkflowStatus(workspace, { workflowName, instanceId }, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
    refetchInterval: (query) => {
      const snapshot = query.state.data?.snapshot;
      const status = typeof snapshot === "string" ? snapshot : snapshot?.status;
      if (
        status === "success" ||
        status === "failed"
      ) {
        return false;
      }
      return 1000; // Poll every 1 second by default
    },
  });
};
