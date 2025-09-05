import {
  useRecentWorkflowRuns,
  useWorkflowNames,
  useWorkflowRuns,
} from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import type { WorkflowRun } from "./types.ts";
import {
  formatStatus,
  getStatusBadgeVariant,
  sortWorkflowRuns,
} from "./utils.ts";
import { formatToolName } from "../chat/utils/format-tool-name.ts";

function WorkflowRunsCardView({
  runs,
  onClick,
}: {
  runs: WorkflowRun[];
  onClick: (run: WorkflowRun) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 peer">
      {runs.map((run) => (
        <Card
          key={run.runId}
          className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
          onClick={() => onClick(run)}
        >
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_min-content] gap-4 items-start p-4">
              <div className="flex flex-col gap-2 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {formatToolName(run.workflowName)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="schedule" size={12} />
                  <span>{run.runId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getStatusBadgeVariant(run.status)}
                    className="text-xs"
                  >
                    {formatStatus(run.status)}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Started: {new Date(run.createdAt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WorkflowRunsTableView({
  runs,
  onClick,
}: {
  runs: WorkflowRun[];
  onClick: (run: WorkflowRun) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const sortedRuns = useMemo(() => {
    return sortWorkflowRuns(runs, sortKey, sortDirection);
  }, [runs, sortKey, sortDirection]);

  const columns: TableColumn<WorkflowRun>[] = [
    {
      id: "workflowName",
      header: "Workflow Name",
      render: (run) => (
        <span className="font-semibold">
          {formatToolName(run.workflowName)}
        </span>
      ),
      sortable: true,
    },
    {
      id: "runId",
      header: "Run ID",
      render: (run) => (
        <div className="flex items-center gap-2">
          <Icon name="schedule" size={14} className="text-muted-foreground" />
          <span className="text-sm font-mono text-xs">{run.runId}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      render: (run) => (
        <Badge variant={getStatusBadgeVariant(run.status)}>
          {formatStatus(run.status)}
        </Badge>
      ),
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Started",
      render: (run) => (
        <span className="text-xs">
          {new Date(run.createdAt).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Updated",
      render: (run) => (
        <span className="text-xs">
          {run.updatedAt ? new Date(run.updatedAt).toLocaleString() : "-"}
        </span>
      ),
      sortable: true,
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") =>
        prev === "asc" ? "desc" : "asc",
      );
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
      onRowClick={onClick}
    />
  );
}

function WorkflowRunsTab() {
  const [_searchParams, _setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useViewMode("workflows-list");
  const [filter, setFilter] = useState("");
  const [selectedWorkflow, setSelectedWorkflow] = useState<string>("all");
  const navigateWorkspace = useNavigateWorkspace();

  // Get all workflow names for the select dropdown
  const { data: workflowNamesData } = useWorkflowNames();
  const workflowNames = workflowNamesData?.workflowNames || [];

  // Get workflow runs - either filtered by workflow name or all recent runs
  const { data, refetch, isRefetching } =
    selectedWorkflow !== "all"
      ? useWorkflowRuns(selectedWorkflow, 1, 25)
      : useRecentWorkflowRuns(1, 25);

  const runs = data?.runs || [];

  const filteredRuns = useMemo(() => {
    if (!filter) return runs;
    return runs.filter(
      (run) =>
        run.workflowName.toLowerCase().includes(filter.toLowerCase()) ||
        run.runId.toLowerCase().includes(filter.toLowerCase()),
    );
  }, [runs, filter]);

  // Sort runs by default (Created At, newest first) for card view consistency
  const sortedAndFilteredRuns = useMemo(() => {
    return sortWorkflowRuns(filteredRuns, "createdAt", "desc");
  }, [filteredRuns]);

  function handleRunClick(run: WorkflowRun) {
    navigateWorkspace(
      `/workflows/${encodeURIComponent(run.workflowName)}/instances/${encodeURIComponent(
        run.runId,
      )}`,
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 h-full py-4">
        <div className="px-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <ListPageHeader
              input={{
                placeholder: "Search workflow runs",
                value: filter,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilter(e.target.value),
              }}
              view={{ viewMode, onChange: setViewMode }}
            />
            <Select
              value={selectedWorkflow}
              onValueChange={setSelectedWorkflow}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All workflows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All workflows</SelectItem>
                {workflowNames.map((name) => (
                  <SelectItem key={name} value={name}>
                    {formatToolName(name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refetch()}
                  disabled={isRefetching}
                  className="h-10 w-10"
                >
                  <Icon
                    name="refresh"
                    size={16}
                    className={isRefetching ? "animate-spin" : ""}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 min-h-0 px-4 overflow-x-auto">
          {sortedAndFilteredRuns.length === 0 ? (
            <div className="flex flex-1 min-h-[700px] items-center justify-center">
              <WorkflowEmptyState />
            </div>
          ) : viewMode === "cards" ? (
            <WorkflowRunsCardView
              runs={sortedAndFilteredRuns}
              onClick={handleRunClick}
            />
          ) : (
            <WorkflowRunsTableView
              runs={sortedAndFilteredRuns}
              onClick={handleRunClick}
            />
          )}
        </div>
      </div>
    </ScrollArea>
  );
}

function WorkflowEmptyState() {
  const [copied, setCopied] = useState(false);
  const cliCommand = "npm create deco@latest";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };

  return (
    <EmptyState
      icon="flowchart"
      title="No workflows found"
      description={
        <div className="flex flex-col gap-4">
          <div className="text-sm text-muted-foreground text-center flex flex-col gap-1">
            <p>No workflows have been created yet.</p>
            <p>
              Install the CLI to create workflows.{" "}
              <a
                href="https://docs.decocms.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Learn more in our docs
              </a>
              .
            </p>
          </div>
          <div className="relative w-full max-w-md">
            <Input
              value={cliCommand}
              readOnly
              className="pr-12 bg-secondary/50 text-muted-foreground font-mono"
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute right-1 top-1 h-8 w-8"
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy to clipboard"}
            >
              <Icon name={copied ? "check" : "content_copy"} size={16} />
            </Button>
          </div>
        </div>
      }
    />
  );
}

const tabs: Record<string, Tab> = {
  workflows: {
    Component: WorkflowRunsTab,
    title: "Workflow Runs",
    active: true,
    initialOpen: true,
  },
};

function WorkflowRunsListPage() {
  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={<DefaultBreadcrumb items={[{ label: "Workflow Runs" }]} />}
    />
  );
}

export default WorkflowRunsListPage;
