import {
  getAgentsUsage,
  getBillingHistory,
  getContractsPreAuthorizations,
  getContractsCommits,
  getThreadsUsage,
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

export type AgentUsage = Awaited<ReturnType<typeof useUsagePerAgent>>;
export type AgentUsageItem = AgentUsage["items"][number];

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

export type ThreadUsage = Awaited<ReturnType<typeof useUsagePerThread>>;
export type ThreadUsageItem = ThreadUsage["items"][number];

export function useBillingHistory({
  range,
}: {
  range: "day" | "week" | "month" | "year";
}) {
  const { workspace } = useSDK();
  const { data: billingHistory } = useSuspenseQuery({
    queryKey: KEYS.WALLET_BILLING_HISTORY(workspace, range),
    queryFn: () => getBillingHistory(workspace, range),
  });

  return billingHistory;
}

export type BillingHistoryItem = Awaited<
  ReturnType<typeof useBillingHistory>
>["items"][number];

export function useContractsPreAuthorizations({
  range,
}: {
  range: "day" | "week" | "month" | "year";
}) {
  const { workspace } = useSDK();
  const { data: contractsPreAuthorizations } = useSuspenseQuery({
    queryKey: KEYS.WALLET_CONTRACTS_PRE_AUTHORIZATIONS(workspace, range),
    queryFn: () => getContractsPreAuthorizations(workspace, range),
  });

  console.log({ contractsPreAuthorizations });

  return contractsPreAuthorizations;
}

export type ContractsPreAuthorizationsItem = Awaited<
  ReturnType<typeof useContractsPreAuthorizations>
>["items"][number];

export function useContractsCommits({
  range,
}: {
  range: "day" | "week" | "month" | "year";
}) {
  const { workspace } = useSDK();
  const { data: contractsCommits } = useSuspenseQuery({
    queryKey: KEYS.WALLET_CONTRACTS_COMMITS(workspace, range),
    queryFn: () => getContractsCommits(workspace, range),
  });

  return contractsCommits;
}

export type ContractsCommitsItem = Awaited<
  ReturnType<typeof useContractsCommits>
>["items"][number];

export function usePlan() {
  const { workspace } = useSDK();
  const { data: plan } = useSuspenseQuery({
    queryKey: KEYS.WORKSPACE_PLAN(workspace),
    queryFn: () => getWorkspacePlan(workspace),
  });

  return plan;
}
