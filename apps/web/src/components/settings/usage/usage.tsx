import {
  useAgents,
  useAuditEvents,
  useContractsCommits,
  useIntegrations,
  useUsagePerAgent,
  useUsagePerThread,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { Suspense, useMemo, useState } from "react";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";

import { useMembersWithUnknownUsers } from "./members.ts";
import { UsageFilters } from "./filters.tsx";
import { UsageTable } from "./agents-table.tsx";
import { ThreadsTable } from "./threads-table.tsx";
import { UsersTable } from "./users-table.tsx";
import {
  createAgentChartData,
  createContractsCommitsChartData,
  createThreadChartData,
  createUserChartData,
  UsageChartData,
} from "./usage-stacked-bar-chart.tsx";
import { StackedBarChart } from "./stacked-bar-chart.tsx";
import { ContractsTable } from "./contracts-table.tsx";

const useAgentsMergedWithWellKnown = () => {
  const agents = useAgents();
  return {
    ...agents,
    data:
      agents.data?.concat([
        WELL_KNOWN_AGENTS.teamAgent,
        WELL_KNOWN_AGENTS.setupAgent,
      ]) || [],
  };
};

export type UsageType = "agent" | "thread" | "user" | "contract";
export type TimeRange = "day" | "week" | "month";

const labelsByUsageType = {
  agent: {
    title: "Agents used",
    plural: "agents",
  },
  thread: {
    title: "Threads created",
    plural: "threads",
  },
  user: {
    title: "Users active",
    plural: "users",
  },
  contract: {
    title: "Contracts",
    plural: "commits",
  },
} as const;

export function Usage() {
  const [usageType, setUsageType] = useState<UsageType>("agent");
  const [timeRange, setTimeRange] = useState<TimeRange>("week");
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null,
  );
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const agents = useAgentsMergedWithWellKnown();
  const { data: integrations } = useIntegrations();
  const agentUsage = useUsagePerAgent({
    range: timeRange,
  });
  const threadUsage = useUsagePerThread({
    range: timeRange,
  });
  const contractsCommits = useContractsCommits({
    range: timeRange,
  });
  const teamMembers = useMembersWithUnknownUsers({
    userIdsToEnsureExist: threadUsage.items.map((thread) => thread.generatedBy),
  });
  const threads = useAuditEvents({
    orderBy: "updatedAt_desc",
    limit: 100,
  });

  const availableContracts = useMemo(() => {
    const contractIds = new Set<string>();
    for (const item of contractsCommits.items || []) {
      if (item.contractId) contractIds.add(item.contractId);
    }
    return Array.from(contractIds).sort();
  }, [contractsCommits.items]);

  const availableClauses = useMemo(() => {
    const clauseIds = new Set<string>();
    for (const item of contractsCommits.items || []) {
      // If a contract filter is selected, only include clauses from that contract
      if (selectedContractId && item.contractId !== selectedContractId) {
        continue;
      }
      for (const clause of item.clauses || []) {
        if (clause.clauseId) clauseIds.add(clause.clauseId);
      }
    }
    return Array.from(clauseIds).sort();
  }, [contractsCommits.items, selectedContractId]);

  // Reset clause filter when contract filter changes
  const handleContractChange = (contractId: string | null) => {
    setSelectedContractId(contractId);
    setSelectedClauseId(null); // Reset clause filter when contract changes
  };

  const chartData = useMemo((): UsageChartData => {
    switch (usageType) {
      case "agent":
        return createAgentChartData(agents.data || [], agentUsage, timeRange);
      case "user":
        return createUserChartData(threadUsage, teamMembers || [], timeRange);
      case "thread":
        return createThreadChartData(threadUsage, timeRange);
      case "contract":
        return createContractsCommitsChartData(
          contractsCommits.items,
          timeRange,
          integrations || [],
          selectedClauseId || undefined,
          selectedContractId || undefined,
        );
      default:
        return {
          chartData: [],
          totalCost: 0,
          itemCount: 0,
        };
    }
  }, [
    usageType,
    agents.data,
    agentUsage,
    threadUsage,
    teamMembers,
    timeRange,
    contractsCommits.items,
    integrations,
    selectedClauseId,
    selectedContractId,
  ]);

  const totals = useMemo(() => {
    if (usageType === "contract") {
      // For contracts, calculate the actual total cost from the filtered data
      let totalCost = 0;
      const filteredContracts =
        contractsCommits.items?.filter((contract) => {
          // Filter by contract if specified
          if (
            selectedContractId &&
            contract.contractId !== selectedContractId
          ) {
            return false;
          }
          // If a clause filter is selected, only include contracts that have that clause
          if (selectedClauseId) {
            return (contract.clauses || []).some(
              (clause) => clause.clauseId === selectedClauseId,
            );
          }
          return true;
        }) || [];

      for (const contract of filteredContracts) {
        if (selectedClauseId) {
          // For specific clause, calculate based on clause usage and CONTRACT_GET prices would be ideal
          // For now, proportionally calculate from contract total based on clause usage
          const clause = (contract.clauses || []).find(
            (c) => c.clauseId === selectedClauseId,
          );
          if (clause) {
            const totalTokensInContract = (contract.clauses || []).reduce(
              (sum, c) => sum + c.amount,
              0,
            );
            if (totalTokensInContract > 0) {
              totalCost +=
                (clause.amount / totalTokensInContract) * contract.amount;
            }
          }
        } else {
          // For all clauses, use the total contract amount
          totalCost += contract.amount;
        }
      }

      return {
        count: filteredContracts.length,
        cost: totalCost,
      };
    } else {
      return {
        count: chartData.itemCount,
        cost: chartData.totalCost,
      };
    }
  }, [
    usageType,
    chartData.itemCount,
    chartData.totalCost,
    contractsCommits.items,
    selectedContractId,
    selectedClauseId,
  ]);

  const labels = useMemo(() => labelsByUsageType[usageType], [usageType]);

  return (
    <div className="h-full text-foreground px-6 py-6 overflow-x-auto w-full">
      <div className="flex flex-col gap-6 overflow-x-auto w-full">
        <UsageFilters
          usageType={usageType}
          setUsageType={setUsageType}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          contractId={selectedContractId}
          setContractId={handleContractChange}
          availableContracts={availableContracts}
          clauseId={selectedClauseId}
          setClauseId={setSelectedClauseId}
          availableClauses={availableClauses}
        />

        <div className="flex gap-4 w-full">
          <Card className="flex-1 p-6 rounded-xl border">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="robot_2" size={16} />
                <span className="text-sm font-medium text-muted-foreground">
                  {labels.title}
                </span>
              </div>
              <div className="text-4xl font-normal text-foreground">
                {totals.count} {labels.plural}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 p-6 rounded-xl bg-primary-dark text-primary-light">
            <CardContent className="p-0">
              <div className="text-sm font-medium mb-2">Total Cost</div>
              <div className="text-4xl font-semibold">
                $
                {totals.cost
                  .toFixed(6)
                  .toString()
                  .replace(/\.?0+$/, "")}
              </div>
            </CardContent>
          </Card>
        </div>

        <StackedBarChart chartData={chartData.chartData} />

        {usageType === "agent" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <UsageTable
              agents={agents.data || []}
              agentUsage={agentUsage}
              threadUsage={threadUsage}
            />
          </Suspense>
        )}

        {usageType === "thread" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <ThreadsTable
              agents={agents.data || []}
              threadUsage={threadUsage}
              members={teamMembers}
              threadHistory={threads.data?.threads || []}
            />
          </Suspense>
        )}

        {usageType === "user" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <UsersTable threadUsage={threadUsage} members={teamMembers} />
          </Suspense>
        )}

        {usageType === "contract" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <ContractsTable
              contractsUsage={contractsCommits.items || []}
              contractId={selectedContractId || undefined}
              clauseId={selectedClauseId || undefined}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
