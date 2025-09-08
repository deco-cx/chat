import {
  useAgents,
  useAuditEvents,
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
  createThreadChartData,
  createUserChartData,
  UsageChartData,
} from "./usage-stacked-bar-chart.tsx";
import { StackedBarChart } from "./stacked-bar-chart.tsx";

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

export type UsageType = "agent" | "thread" | "user";
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
} as const;

export function Usage() {
  const [usageType, setUsageType] = useState<UsageType>("agent");
  const [timeRange, setTimeRange] = useState<TimeRange>("week");

  const agents = useAgentsMergedWithWellKnown();
  const agentUsage = useUsagePerAgent({
    range: timeRange,
  });
  const threadUsage = useUsagePerThread({
    range: timeRange,
  });

  const teamMembers = useMembersWithUnknownUsers({
    userIdsToEnsureExist: threadUsage.items.map((thread) => thread.generatedBy),
  });
  const threads = useAuditEvents({
    orderBy: "updatedAt_desc",
    limit: 100,
  });

  const chartData = useMemo((): UsageChartData => {
    switch (usageType) {
      case "agent":
        return createAgentChartData(agents.data || [], agentUsage, timeRange);
      case "user":
        return createUserChartData(threadUsage, teamMembers || [], timeRange);
      case "thread":
        return createThreadChartData(threadUsage, timeRange);
      default:
        return {
          chartData: [],
          totalCost: 0,
          itemCount: 0,
        };
    }
  }, [usageType, agents.data, agentUsage, threadUsage, teamMembers, timeRange]);

  const totals = {
    count: chartData.itemCount,
    cost: chartData.totalCost.toFixed(2),
  };

  const labels = useMemo(() => labelsByUsageType[usageType], [usageType]);

  return (
    <div className="h-full text-foreground px-6 py-6 overflow-x-auto w-full">
      <div className="flex flex-col gap-6 overflow-x-auto w-full">
        <UsageFilters
          usageType={usageType}
          setUsageType={setUsageType}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
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
              <div className="text-4xl font-semibold">${totals.cost}</div>
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
      </div>
    </div>
  );
}
