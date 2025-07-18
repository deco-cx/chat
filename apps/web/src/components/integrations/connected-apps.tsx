import { Badge } from "@deco/ui/components/badge.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { IntegrationInfo } from "../common/table/table-cells.tsx";
import { type GroupedApp, useGroupedApps } from "./apps.ts";
import { Header } from "./breadcrumb.tsx";
import { SelectConnectionDialog } from "./select-connection-dialog.tsx";

function AppCard({
  app,
  onClick,
}: {
  app: GroupedApp;
  onClick: (app: GroupedApp) => void;
}) {
  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
      onClick={() => onClick(app)}
    >
      <CardContent className="p-0">
        <div className="grid grid-cols-[min-content_1fr_min-content] gap-4 items-start p-4">
          <IntegrationAvatar
            url={app.icon}
            fallback={app.name}
            size="base"
            className="flex-shrink-0"
          />

          <div className="flex flex-col gap-0 min-w-0">
            <div className="text-sm font-semibold truncate">{app.name}</div>
            <div className="text-sm text-muted-foreground line-clamp-1">
              {app.description}
            </div>
          </div>
        </div>
        <div className="px-4 py-3 border-t border-border">
          <Badge variant="secondary" className="text-xs">
            {app.instances} Instance{app.instances > 1 ? "s" : ""}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function CardsView({
  apps,
  onClick,
}: {
  apps: GroupedApp[];
  onClick: (app: GroupedApp) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 peer">
      {apps.map((app) => (
        <AppCard key={app.id} app={app} onClick={onClick} />
      ))}
    </div>
  );
}

function TableView({
  apps,
  onClick,
}: {
  apps: GroupedApp[];
  onClick: (app: GroupedApp) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: GroupedApp, key: string): string {
    if (key === "description") return row.description?.toLowerCase() || "";
    return row.name?.toLowerCase() || "";
  }

  const sortedApps = [...apps].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns: TableColumn<GroupedApp>[] = [
    {
      id: "name",
      header: "Name",
      render: (app) => <IntegrationInfo integration={app} />,
      sortable: true,
    },
    {
      id: "instance-count",
      header: "Instances",
      render: (app) => (
        <Badge variant="secondary" className="text-xs">
          {app.instances} Instance{app.instances > 1 ? "s" : ""}
        </Badge>
      ),
    },
    {
      id: "used-by",
      header: "Agents",
      render: (app) => (
        <div className="flex items-center gap-2">
          {app.usedBy.map((agent) => (
            <AgentAvatar
              key={agent.avatarUrl}
              url={agent.avatarUrl}
              fallback={agent.avatarUrl}
              size="sm"
            />
          ))}
        </div>
      ),
    },
    {
      id: "people-with-access",
      header: "People with access",
      render: () => (
        <div className="flex items-center gap-2">
          <Icon name="group" size={16} />
          <span className="text-sm">Team</span>
        </div>
      ),
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
      data={sortedApps}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onClick}
    />
  );
}

export function ConnectedAppsList() {
  const [viewMode, setViewMode] = useViewMode("integrations");
  const [filter, setFilter] = useState<string>("");
  const navigateWorkspace = useNavigateWorkspace();
  const apps = useGroupedApps({
    filter,
  });

  const navigateToApp = (app: GroupedApp) => {
    navigateWorkspace(`/connection/${app.id}`);
  };

  return (
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4 overflow-x-auto">
        <Header
          query={filter}
          setQuery={setFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>

      <div className="flex-1 min-h-0 px-4 overflow-x-auto">
        {!apps ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : apps.length === 0 ? (
          <EmptyState
            icon="linked_services"
            title="No connected integrations yet"
            description="Connect services to expand what your agents can do."
            buttonComponent={
              <SelectConnectionDialog forceTab="new-connection" />
            }
          />
        ) : viewMode === "cards" ? (
          <CardsView apps={apps} onClick={navigateToApp} />
        ) : (
          <TableView apps={apps} onClick={navigateToApp} />
        )}
      </div>
    </div>
  );
}
