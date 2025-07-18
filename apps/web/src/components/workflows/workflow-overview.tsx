import { useAllWorkflowRuns, useWorkflowInstances } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";

import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { Table, type TableColumn } from "../common/table/index.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import type { WorkflowRun, WorkflowStats } from "./types.ts";
import {
  calculateWorkflowStats,
  formatStatus,
  getStatusBadgeVariant,
} from "./utils.ts";

const DONUT_COLORS = ["#22c55e", "#ef4444", "#fbbf24", "#a3a3a3"];

function WorkflowStatsChart({ stats }: { stats: WorkflowStats }) {
  const data = [
    { name: "Success", value: stats.successCount },
    { name: "Error", value: stats.errorCount },
    { name: "Running", value: stats.runningCount },
    { name: "Other", value: stats.pendingCount },
  ].filter((item) => item.value > 0);

  return (
    <div className="relative w-[120px] h-[120px]">
      <ResponsiveContainer width={120} height={120}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={35}
            outerRadius={55}
            stroke="none"
          >
            {data.map((_entry, idx) => (
              <Cell key={`cell-${idx}`} fill={DONUT_COLORS[idx]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
        <span className="text-lg font-bold text-foreground leading-none">
          {stats.totalRuns}
        </span>
        <span className="text-xs text-muted-foreground leading-none">runs</span>
      </div>
    </div>
  );
}

function WorkflowStatsCard({ stats }: { stats: WorkflowStats }) {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="analytics" size={20} />
        Workflow Statistics
      </div>

      {/* Main stats layout with chart and counters */}
      <div className="flex items-center gap-12">
        {/* Chart on the left with padding */}
        <div className="flex-shrink-0 pl-4">
          <WorkflowStatsChart stats={stats} />
        </div>

        {/* Stats grid on the right with padding */}
        <div className="flex-1 grid grid-cols-2 gap-6 pr-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-success-foreground dark:bg-success/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-success"></div>
                <span className="text-sm font-medium">Success</span>
              </div>
              <span className="text-xl font-bold text-success">
                {stats.successCount}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive-foreground dark:bg-destructive/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-destructive"></div>
                <span className="text-sm font-medium">Error</span>
              </div>
              <span className="text-xl font-bold text-destructive">
                {stats.errorCount}
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-warning/10 dark:bg-warning/20">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-warning"></div>
                <span className="text-sm font-medium">Running</span>
              </div>
              <span className="text-xl font-bold text-warning">
                {stats.runningCount}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted dark:bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-muted-foreground"></div>
                <span className="text-sm font-medium">Pending</span>
              </div>
              <span className="text-xl font-bold text-muted-foreground">
                {stats.pendingCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom summary stats */}
      <div className="pt-6 border-t border-border">
        <div className="grid grid-cols-3 gap-8">
          <div className="text-center space-y-2">
            <div className="text-3xl font-bold text-success">
              {stats.successRate.toFixed(1)}%
            </div>
            <div className="text-sm text-muted-foreground">Success Rate</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-lg font-semibold">
              {stats.lastRun
                ? new Date(stats.lastRun.date).toLocaleDateString()
                : "Never"}
            </div>
            <div className="text-sm text-muted-foreground">Last Run</div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-lg font-semibold">
              {stats.firstRun
                ? new Date(stats.firstRun.date).toLocaleDateString()
                : "Never"}
            </div>
            <div className="text-sm text-muted-foreground">First Run</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowRunsTable({
  runs,
  onRunClick,
}: {
  runs: WorkflowRun[];
  onRunClick: (run: WorkflowRun) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortKey) {
        case "runId":
          aVal = a.runId;
          bVal = b.runId;
          break;
        case "status":
          aVal = a.status;
          bVal = b.status;
          break;
        case "createdAt":
          aVal = a.createdAt;
          bVal = b.createdAt;
          break;
        case "updatedAt":
          aVal = a.updatedAt;
          bVal = b.updatedAt;
          break;
        default:
          aVal = a.updatedAt;
          bVal = b.updatedAt;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [runs, sortKey, sortDirection]);

  const columns: TableColumn<WorkflowRun>[] = [
    {
      id: "runId",
      header: "Run ID",
      render: (run: WorkflowRun) => (
        <span className="font-mono text-sm truncate max-w-[120px] block">
          {run.runId}
        </span>
      ),
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      render: (run: WorkflowRun) => (
        <Badge variant={getStatusBadgeVariant(run.status)}>
          {formatStatus(run.status)}
        </Badge>
      ),
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created",
      render: (run: WorkflowRun) => (
        <span className="text-sm">
          {new Date(run.createdAt).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Updated",
      render: (run: WorkflowRun) => (
        <span className="text-sm">
          {new Date(run.updatedAt).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <Table
      columns={columns}
      data={sortedRuns}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onRunClick}
    />
  );
}

function WorkflowOverviewTab() {
  const { workflowName = "" } = useParams();
  const [searchParams] = useSearchParams();
  const page = Number(searchParams.get("page") || 1);
  const per_page = Number(searchParams.get("per_page") || 10);

  const {
    data: allRunsData,
    refetch: refetchAllRuns,
    isRefetching: isRefetchingAllRuns,
  } = useAllWorkflowRuns(workflowName);
  const {
    data: instancesData,
    refetch: refetchInstances,
    isRefetching: isRefetchingInstances,
  } = useWorkflowInstances(workflowName, page, per_page);

  const navigateWorkspace = useNavigateWorkspace();

  const allRuns = allRunsData.workflows as WorkflowRun[];
  const paginatedRuns = instancesData.workflows as WorkflowRun[];

  const stats = useMemo(() => calculateWorkflowStats(allRuns), [allRuns]);

  function handleRunClick(run: WorkflowRun) {
    navigateWorkspace(
      `/workflows/${encodeURIComponent(workflowName)}/instances/${run.runId}`,
    );
  }

  function handleRefresh() {
    refetchAllRuns();
    refetchInstances();
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-8 h-full py-6">
        {/* Header with refresh button */}
        <div className="flex items-center justify-between px-6">
          <h1 className="text-3xl font-bold truncate">{workflowName}</h1>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefetchingAllRuns || isRefetchingInstances}
                className="h-10 w-10 shrink-0"
              >
                <Icon
                  name="refresh"
                  size={16}
                  className={
                    isRefetchingAllRuns || isRefetchingInstances
                      ? "animate-spin"
                      : ""
                  }
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh</TooltipContent>
          </Tooltip>
        </div>

        {/* Statistics Card */}
        <div className="px-6">
          <WorkflowStatsCard stats={stats} />
        </div>

        {/* Recent Runs Section */}
        <div className="flex-1 min-h-0 px-6 flex flex-col space-y-6">
          {/* Header */}
          <div className="flex items-center gap-2 text-lg font-semibold">
            <Icon name="history" size={20} />
            Recent Runs
          </div>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {paginatedRuns.length === 0 ? (
              <div className="flex items-center justify-center h-full text-center text-muted-foreground">
                <div className="space-y-4">
                  <Icon name="work" size={48} className="mx-auto opacity-50" />
                  <div className="space-y-2">
                    <p className="text-lg font-medium">No runs found</p>
                    <p className="text-sm">
                      This workflow hasn't been executed yet.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full overflow-auto">
                <WorkflowRunsTable
                  runs={paginatedRuns}
                  onRunClick={handleRunClick}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

const tabs: Record<string, Tab> = {
  overview: {
    Component: WorkflowOverviewTab,
    title: "Overview",
    active: true,
    initialOpen: true,
  },
};

function WorkflowOverviewPage() {
  const { workflowName = "" } = useParams();

  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Workflows", link: "/workflows" },
            {
              label: String(workflowName ?? ""),
            },
          ]}
        />
      }
    />
  );
}

export default WorkflowOverviewPage;
