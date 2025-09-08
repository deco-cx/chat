import {
  getAgentsUsage,
  getBillingHistory,
  getThreadsUsage,
  getWalletAccount,
  getWorkspacePlan,
} from "../crud/wallet.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

export function useWorkspaceWalletBalance() {
  const { locator } = useSDK();
  const queryClient = useQueryClient();
  const { data: account, isRefetching } = useSuspenseQuery({
    queryKey: KEYS.WALLET(locator),
    queryFn: () => getWalletAccount(locator),
  });

  return {
    ...account,
    refetch: () =>
      queryClient.invalidateQueries({ queryKey: KEYS.WALLET(locator) }),
    isRefetching,
  };
}

export function useUsagePerAgent({
  range,
}: {
  range: "day" | "week" | "month";
}) {
  const { locator } = useSDK();

  const { data: usage } = useSuspenseQuery({
    queryKey: KEYS.WALLET_USAGE_AGENTS(locator, range),
    queryFn: () => getAgentsUsage(locator, range),
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
  const { locator } = useSDK();
  const { data: usage } = useSuspenseQuery({
    queryKey: KEYS.WALLET_USAGE_THREADS(locator, range),
    queryFn: () => getThreadsUsage(locator, range),
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
  const { locator } = useSDK();
  const { data: billingHistory } = useSuspenseQuery({
    queryKey: KEYS.WALLET_BILLING_HISTORY(locator, range),
    queryFn: () => getBillingHistory(locator, range),
  });

  return billingHistory;
}

export type BillingHistoryItem = Awaited<
  ReturnType<typeof useBillingHistory>
>["items"][number];

export function usePlan() {
  const { locator } = useSDK();
  const { data: plan } = useSuspenseQuery({
    queryKey: KEYS.WORKSPACE_PLAN(locator),
    queryFn: () => getWorkspacePlan(locator),
  });

  return plan;
}
