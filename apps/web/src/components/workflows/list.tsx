import { useWorkflows } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@deco/ui/components/pagination.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
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
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";

// Define the Workflow type to match the API response
interface Workflow {
  workflowName: string;
  runId: string;
  createdAt: number;
  updatedAt: number;
  resourceId: string | null;
  status: string;
}

function WorkflowsCardView(
  { workflows, onClick }: {
    workflows: Workflow[];
    onClick: (workflow: Workflow) => void;
  },
) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 peer">
      {workflows.map((workflow) => (
        <Card
          key={workflow.runId}
          className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
          onClick={() => onClick(workflow)}
        >
          <CardContent className="p-0">
            <div className="grid grid-cols-[1fr_min-content] gap-4 items-start p-4">
              <div className="flex flex-col gap-0 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {workflow.workflowName}
                </div>
                <div className="text-sm text-muted-foreground line-clamp-1">
                  Created: {new Date(workflow.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Modified: {new Date(workflow.updatedAt).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function WorkflowsTableView(
  { workflows, onClick }: {
    workflows: Workflow[];
    onClick: (workflow: Workflow) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("workflowName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: Workflow, key: string): string {
    if (key === "createdAt") return row.createdAt.toString() || "";
    if (key === "updatedAt") return row.updatedAt.toString() || "";
    if (key === "status") return row.status || "";
    return row.workflowName?.toLowerCase() || "";
  }

  const sortedWorkflows = [...workflows].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<Workflow>[] = [
    {
      id: "workflowName",
      header: "Name",
      render: (workflow) => (
        <span className="font-semibold">{workflow.workflowName}</span>
      ),
      sortable: true,
    },
    {
      id: "status",
      header: "Status",
      render: (workflow) => <span className="text-xs">{workflow.status}</span>,
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created",
      render: (workflow) => (
        <span className="text-xs">
          {new Date(workflow.createdAt).toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Modified",
      render: (workflow) => (
        <span className="text-xs">
          {new Date(workflow.updatedAt).toLocaleString()}
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
      data={sortedWorkflows}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onClick}
    />
  );
}

function WorkflowsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewMode, setViewMode] = useViewMode("workflows-list");
  const [filter, setFilter] = useState("");
  const page = Number(searchParams.get("page") || 1);
  const per_page = Number(searchParams.get("per_page") || 10);
  const { data, refetch, isRefetching } = useWorkflows(page, per_page);
  const navigateWorkspace = useNavigateWorkspace();

  const workflows: Workflow[] = data.workflows as unknown as Workflow[];
  const filteredWorkflows = useMemo(() => {
    if (!filter) return workflows;
    return workflows.filter((w) =>
      w.workflowName.toLowerCase().includes(filter.toLowerCase())
    );
  }, [workflows, filter]);

  function handlePageChange(newPage: number) {
    setSearchParams({ page: String(newPage), per_page: String(per_page) });
  }

  function handleWorkflowClick(workflow: Workflow) {
    navigateWorkspace(
      `/workflows/${
        encodeURIComponent(workflow.workflowName)
      }/instances/${workflow.runId}`,
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 h-full py-4">
        <div className="px-4 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <ListPageHeader
              input={{
                placeholder: "Search workflow",
                value: filter,
                onChange: (e) => setFilter(e.target.value),
              }}
              view={{ viewMode, onChange: setViewMode }}
            />
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
              <TooltipContent>
                Refresh
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 min-h-0 px-4 overflow-x-auto">
          {filteredWorkflows.length === 0
            ? (
              <div className="flex flex-1 min-h-[700px] items-center justify-center">
                <EmptyState
                  icon="conversion_path"
                  title="No workflows yet"
                  description="Create and deploy a workflow to see it here."
                />
              </div>
            )
            : viewMode === "cards"
            ? (
              <WorkflowsCardView
                workflows={filteredWorkflows}
                onClick={handleWorkflowClick}
              />
            )
            : (
              <WorkflowsTableView
                workflows={filteredWorkflows}
                onClick={handleWorkflowClick}
              />
            )}
        </div>
        {filteredWorkflows.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (page > 1) handlePageChange(page - 1);
                    }}
                    aria-disabled={page <= 1}
                    tabIndex={page <= 1 ? -1 : 0}
                    className={page <= 1
                      ? "opacity-50 pointer-events-none"
                      : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm">Page {page}</span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      if (filteredWorkflows.length >= per_page) {
                        handlePageChange(
                          page + 1,
                        );
                      }
                    }}
                    aria-disabled={filteredWorkflows.length < per_page}
                    tabIndex={filteredWorkflows.length < per_page ? -1 : 0}
                    className={filteredWorkflows.length < per_page
                      ? "opacity-50 pointer-events-none"
                      : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

const tabs: Record<string, Tab> = {
  workflows: {
    Component: WorkflowsTab,
    title: "Workflows",
    active: true,
    initialOpen: true,
  },
};

function WorkflowListPage() {
  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Workflows", link: "/workflows" },
          ]}
        />
      }
    />
  );
}

export default WorkflowListPage;
