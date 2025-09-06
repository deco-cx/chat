import type { TriggerOutput } from "@deco/sdk";
import { useAgents, useIntegrations, useListTriggers } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { Suspense, useCallback, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import {
  AgentInfo,
  DateTimeCell,
  IntegrationInfo,
  UserInfo,
} from "../common/table/table-cells.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import { TriggerActions } from "./trigger-actions.tsx";
import { TriggerCard } from "./trigger-card.tsx";
import { TriggerModal } from "./trigger-dialog.tsx";
import { TriggerToggle } from "./trigger-toggle.tsx";
import { TriggerType } from "./trigger-type.tsx";

const SORTABLE_KEYS = ["title", "type", "target", "author"] as const;

type SortKey = (typeof SORTABLE_KEYS)[number];
type SortDirection = "asc" | "desc";

function ListTriggersSkeleton() {
  return (
    <div className="mx-8 my-6">
      <div className="mb-4 flex items-center justify-between">
        <Skeleton className="w-80 h-10 rounded-full" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-36 h-10 rounded-full" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <div>
          <div className="flex flex-col divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <Skeleton className="w-64 h-6 rounded" />
                <Skeleton className="w-44 h-6 rounded" />
                <Skeleton className="w-32 h-6 rounded" />
                <Skeleton className="w-64 h-6 rounded" />
                <Skeleton className="w-40 h-6 rounded" />
                <Skeleton className="w-8 h-6 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = {
  list: {
    Component: ListTriggers,
    title: "Triggers",
    initialOpen: true,
  },
};

export default function ListTriggersLayout() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  return (
    <PageLayout
      hideViewsButton
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Triggers", link: "/triggers" }]} />
      }
      actionButtons={
        <>
          <Button
            variant="special"
            title="Add Trigger"
            onClick={() => setIsCreateModalOpen(true)}
          >
            <Icon name="add" />
            <span className="hidden md:inline">New Trigger</span>
          </Button>
          {isCreateModalOpen && (
            <TriggerModal
              isOpen={isCreateModalOpen}
              onOpenChange={setIsCreateModalOpen}
            />
          )}
        </>
      }
    />
  );
}

export function ListTriggers() {
  return (
    <Suspense fallback={<ListTriggersSkeleton />}>
      <ListTriggersSuspended />
    </Suspense>
  );
}

function ListTriggersSuspended() {
  const { data, isLoading } = useListTriggers();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useViewMode("triggers");

  const triggers = (data?.triggers || []) as TriggerOutput[];

  const filteredTriggers =
    search.trim().length > 0
      ? triggers.filter((t) =>
          t.data.title.toLowerCase().includes(search.toLowerCase()),
        )
      : triggers;

  if (isLoading) {
    return <ListTriggersSkeleton />;
  }

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      <ListPageHeader
        filter={{
          items: [],
          onClick: () => {},
        }}
        input={{
          placeholder: "Search trigger",
          value: search,
          onChange: (e) => setSearch(e.target.value),
        }}
        view={{
          viewMode,
          onChange: setViewMode,
        }}
      />

      <div className="flex-1 min-h-0 overflow-x-auto">
        {filteredTriggers.length === 0 ? (
          <EmptyState
            icon="cable"
            title={
              search.trim().length > 0 ? "No triggers found" : "No triggers yet"
            }
            description={
              search.trim().length > 0
                ? "Try adjusting your search terms to find what you're looking for."
                : "Create your first trigger to automate your agent workflows and respond to events automatically."
            }
            buttonProps={{
              children: "Create Trigger",
              onClick: () => {
                // This will trigger the modal to open
                const createButton = document.querySelector(
                  '[title="Add Trigger"]',
                ) as HTMLButtonElement;
                createButton?.click();
              },
            }}
          />
        ) : viewMode === "table" ? (
          <TableView triggers={filteredTriggers} />
        ) : (
          <CardsView triggers={filteredTriggers} />
        )}
      </div>
    </div>
  );
}

function TableView({ triggers }: { triggers: TriggerOutput[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const navigate = useNavigateWorkspace();
  const { data: agents } = useAgents();
  const { data: integrations = [] } = useIntegrations();

  function TargetInfo({ trigger }: { trigger: TriggerOutput }) {
    const data = trigger.data;

    // For agent triggers - use type assertion to handle the schema
    if ("agentId" in data && data.agentId) {
      return <AgentInfo agentId={data.agentId} />;
    }

    // For tool triggers - use type assertion to handle the complex union type
    if ("callTool" in data && data.callTool) {
      const integration = integrations.find(
        (i) => i.id === data.callTool.integrationId,
      );
      const toolName = data.callTool.toolName;

      return <IntegrationInfo integration={integration} toolName={toolName} />;
    }

    return <span className="text-muted-foreground">Unknown target</span>;
  }

  function handleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDirection("asc");
    }
  }

  function getSortValue(trigger: TriggerOutput, key: SortKey): string {
    if (key === "target") {
      const data = trigger.data;

      // For agent triggers - use type guard to handle the schema
      if ("agentId" in data && data.agentId) {
        const agent = agents?.find((a) => a.id === data.agentId);
        return agent?.name?.toLowerCase() || "";
      }

      // For tool triggers - use type guard to handle the complex union type
      if ("callTool" in data && data.callTool) {
        const integration = integrations.find(
          (i) => i.id === data.callTool.integrationId,
        );
        return (
          integration?.name?.toLowerCase() ||
          data.callTool.integrationId.toLowerCase()
        );
      }

      return "";
    }
    if (key === "author") {
      return trigger.user?.metadata?.full_name?.toLowerCase() || "";
    }
    if (key === "title" || key === "type") {
      return trigger.data?.[key]?.toLowerCase?.() || "";
    }
    return "";
  }

  const sortedTriggers = [...triggers].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const handleTriggerClick = useCallback(
    (trigger: TriggerOutput) => {
      if (!openModalId) {
        navigate(`/trigger/${trigger.id}`);
      }
    },
    [openModalId, navigate],
  );

  const columns: TableColumn<TriggerOutput>[] = [
    {
      id: "active",
      header: "Active",
      render: (t) => <TriggerToggle trigger={t} />,
    },
    {
      id: "title",
      header: "Name",
      accessor: (t) => t.data.title,
      sortable: true,
    },
    {
      id: "type",
      header: "Trigger",
      render: (t) => <TriggerType trigger={t} />,
      sortable: true,
    },
    {
      id: "target",
      header: "Target",
      render: (t) => <TargetInfo trigger={t} />,
      sortable: true,
    },
    {
      id: "author",
      header: "Created by",
      render: (t) => <UserInfo userId={t.user?.id} />,
      sortable: true,
    },
    {
      id: "createdAt",
      header: "Created at",
      render: (t) => <DateTimeCell value={t.createdAt} />,
    },
    {
      id: "actions",
      header: "",
      render: (t) => (
        <TriggerActions
          trigger={t}
          open={openModalId === t.id}
          onOpenChange={(val: boolean) => setOpenModalId(val ? t.id : null)}
        />
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={sortedTriggers}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={handleTriggerClick}
    />
  );
}

function CardsView({ triggers }: { triggers: TriggerOutput[] }) {
  const navigate = useNavigateWorkspace();
  const handleTriggerClick = useCallback(
    (trigger: TriggerOutput) => {
      navigate(`/trigger/${trigger.id}`);
    },
    [navigate],
  );
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {triggers.map((trigger, index) => (
        <TriggerCard
          key={`trigger-card-${trigger.id}-${index}`}
          trigger={trigger}
          onClick={handleTriggerClick}
        />
      ))}
    </div>
  );
}
