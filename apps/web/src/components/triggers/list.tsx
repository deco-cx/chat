import { useListTriggers } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useState, useEffect } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import {
  AgentInfo,
  DateTimeCell,
  UserInfo,
} from "../common/table/table-cells.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { TriggerModal } from "./trigger-dialog.tsx";
import { TriggerActions } from "./trigger-actions.tsx";
import { TriggerCard } from "./trigger-card.tsx";
import { TriggerType } from "./trigger-type.tsx";
import type { TriggerOutputSchema } from "@deco/sdk";
import type { z } from "zod";
import { TriggerToggle } from "./trigger-toggle.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useAgents } from "@deco/sdk";

const SORTABLE_KEYS = ["title", "type", "agent", "author"] as const;

type SortKey = typeof SORTABLE_KEYS[number];
type SortDirection = "asc" | "desc";
type ViewMode = "table" | "cards";

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
        <TriggerModal
          isOpen={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          triggerAction={
            <Button
              variant="special"
              title="Add Trigger"
              onClick={(e) => e.stopPropagation()}
            >
              <Icon name="add" />
              <span className="hidden md:inline">New Trigger</span>
            </Button>
          }
        />
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
  
  // Default to cards on mobile, table on desktop
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth < 768 ? "cards" : "table";
    }
    return "cards";
  });

  // Update view mode based on screen size changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768 && viewMode === "table") {
        setViewMode("cards");
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [viewMode]);

  const triggers = (data?.triggers || []) as z.infer<
    typeof TriggerOutputSchema
  >[];

  const filteredTriggers = search.trim().length > 0
    ? triggers.filter((t) =>
      t.data.title.toLowerCase().includes(search.toLowerCase())
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
        {viewMode === "table"
          ? <TableView triggers={filteredTriggers} />
          : <CardsView triggers={filteredTriggers} />}
      </div>
    </div>
  );
}

function TableView(
  { triggers }: { triggers: z.infer<typeof TriggerOutputSchema>[] },
) {
  const [sortKey, setSortKey] = useState<SortKey>("title");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const navigate = useNavigateWorkspace();
  const { data: agents } = useAgents();

  function handleSort(key: string) {
    const k = key as SortKey;
    if (sortKey === k) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDirection("asc");
    }
  }

  function getSortValue(
    trigger: z.infer<typeof TriggerOutputSchema>,
    key: SortKey,
  ): string {
    if (key === "agent") {
      const agent = agents?.find((a) => a.id === trigger.agent?.id);
      return agent?.name?.toLowerCase() || "";
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

  function handleTriggerClick(trigger: z.infer<typeof TriggerOutputSchema>) {
    if (!openModalId) {
      navigate(`/trigger/${trigger.agent.id}/${trigger.id}`);
    }
  }

  const columns: TableColumn<z.infer<typeof TriggerOutputSchema>>[] = [
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
      id: "agent",
      header: "Agent",
      render: (t) => <AgentInfo agentId={t.agent?.id} />,
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

function CardsView(
  { triggers }: { triggers: z.infer<typeof TriggerOutputSchema>[] },
) {
  const navigate = useNavigateWorkspace();
  function handleTriggerClick(trigger: z.infer<typeof TriggerOutputSchema>) {
    if (trigger.agent?.id && trigger.id) {
      navigate(`/trigger/${trigger.agent.id}/${trigger.id}`);
    }
  }
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
