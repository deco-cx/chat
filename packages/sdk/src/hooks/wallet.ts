import {
  getAgentsUsage,
  getThreadsUsage,
  getToolsUsage,
  getWalletAccount,
  getWorkspacePlan,
} from "../crud/wallet.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export function useWorkspaceWalletBalance() {
  const { workspace } = useSDK();
  const queryClient = useQueryClient();
  const { data: account, isRefetching } = useSuspenseQuery({
    queryKey: KEYS.WALLET(workspace),
    queryFn: () => getWalletAccount(workspace),
  });

  return {
    ...account,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: KEYS.WALLET(workspace) }),
    isRefetching,
  };
}

export function useUsagePerAgent({
  range,
}: {
  range: "day" | "week" | "month";
}) {
  const { workspace } = useSDK();

  const { data: usage } = useSuspenseQuery({
    queryKey: KEYS.WALLET_USAGE_AGENTS(workspace, range),
    queryFn: () => getAgentsUsage(workspace, range),
  });

  return usage;
}

export function useUsagePerTool({
  range,
}: {
  range: "day" | "week" | "month";
}) {
  const { workspace } = useSDK();

  const { data: usage } = useSuspenseQuery({
    queryKey: KEYS.WALLET_USAGE_TOOLS(workspace, range),
    queryFn: () => getToolsUsage(workspace, range),
  });

  return usage;
}

export function useUsagePerThread({
  range,
}: {
  range: "day" | "week" | "month";
}) {
  const { workspace } = useSDK();
  const { data: usage } = useSuspenseQuery({
    queryKey: KEYS.WALLET_USAGE_THREADS(workspace, range),
    queryFn: () => getThreadsUsage(workspace, range),
  });

  return usage;
}

export function usePlan() {
  const { workspace } = useSDK();
  const { data: plan } = useSuspenseQuery({
    queryKey: KEYS.WORKSPACE_PLAN(workspace),
    queryFn: () => getWorkspacePlan(workspace),
  });

  return plan;
}
