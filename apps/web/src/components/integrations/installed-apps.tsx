import { Badge } from "@deco/ui/components/badge.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { useMemo, useState } from "react";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { IntegrationInfo } from "../common/table/table-cells.tsx";
import {
  type GroupedApp,
  useGroupedApps,
  NATIVE_APP_NAME_MAP,
} from "./apps.ts";
import { Header } from "./breadcrumb.tsx";
import { SelectConnectionDialog } from "./select-connection-dialog.tsx";
import { Link, useParams } from "react-router";
import { useSetThreadContextEffect } from "../decopilot/thread-context-provider.tsx";
import { useUnpinnedNativeViews, View } from "@deco/sdk";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { AddCustomAppDialog } from "./add-custom-app-dialog.tsx";

function AppCard({
  app,
  onClick,
  nativeView,
  onFilesClick,
}: {
  app: GroupedApp;
  onClick: (app: GroupedApp) => void;
  nativeView?: View;
  onFilesClick?: () => void;
}) {
  const { org, project } = useParams();
  const projectKey = org && project ? `${org}/${project}` : undefined;
  const { pinView, unpinView, isViewUnpinned } =
    useUnpinnedNativeViews(projectKey);
  const workspaceLink = useWorkspaceLink();

  // Use actual view ID for checking pinned status
  // For Files (and other coming-soon features), use the app.id since they don't have real views
  const actualViewId = nativeView?.id || app.id;
  const isNativePinned = app.isNative && !isViewUnpinned(actualViewId);

  const handlePinClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (app.isNative) {
      if (isNativePinned) {
        unpinView(actualViewId);
        trackEvent("apps_page_unpin_native", {
          app: app.name,
        });
      } else {
        pinView(actualViewId);
        trackEvent("apps_page_pin_native", {
          app: app.name,
        });
      }
    }
  };

  const navigateWorkspace = useNavigateWorkspace();

  const handleCardClick = () => {
    // Open modal for coming soon features (like Files)
    if (app.name === "Files") {
      if (onFilesClick) {
        onFilesClick();
      }
      return;
    }

    if (app.isNative && nativeView) {
      // Client-side navigate to the native view
      const path = nativeView?.metadata?.path as string | undefined;
      navigateWorkspace(path ?? "/");
      trackEvent("apps_page_navigate_native", {
        app: app.name,
      });
    } else if (!app.isNative) {
      onClick(app);
    }
  };

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow rounded-xl relative border-border"
      onClick={handleCardClick}
    >
      <CardContent className="p-0">
        <div className="relative grid grid-cols-[min-content_1fr_min-content] gap-4 items-start p-4">
          <IntegrationAvatar
            url={app.icon}
            fallback={app.name}
            size="base"
            className="shrink-0"
          />

          <div className="flex flex-col gap-0 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold truncate">{app.name}</div>
              {app.isNative && (
                <Badge variant="outline" className="text-xs">
                  Native
                </Badge>
              )}
              {app.name === "Files" && (
                <Badge variant="secondary" className="text-xs">
                  Soon
                </Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-1">
              {app.description}
            </div>
          </div>

          {/* Pin icon for native apps */}
          {app.isNative && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handlePinClick}
                    className="p-2 rounded-md hover:bg-accent/80 transition-all border border-border hover:border-primary/30 cursor-pointer"
                  >
                    <Icon
                      name={isNativePinned ? "check" : "push_pin"}
                      size={18}
                      className={
                        isNativePinned ? "text-primary" : "text-foreground/70"
                      }
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {isNativePinned
                      ? "Pinned - click to unpin"
                      : "Pin to sidebar"}
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Footer section - instances badge for non-native, empty space for native to maintain consistent height */}
        <div className="px-4 py-3 border-t border-border min-h-[52px] flex items-center">
          {!app.isNative ? (
            <Badge variant="secondary" className="text-xs">
              {app.instances} Instance{app.instances > 1 ? "s" : ""}
            </Badge>
          ) : (
            <div className="h-5" />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CardsView({
  apps,
  onClick,
  nativeViewsMap,
  onFilesClick,
}: {
  apps: GroupedApp[];
  onClick: (app: GroupedApp) => void;
  nativeViewsMap: Map<string, View>;
  onFilesClick?: () => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 peer">
      {apps.map((app) => (
        <AppCard
          key={app.id}
          app={app}
          onClick={onClick}
          nativeView={app.isNative ? nativeViewsMap.get(app.id) : undefined}
          onFilesClick={onFilesClick}
        />
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

export default function InstalledAppsList() {
  const [viewMode, setViewMode] = useViewMode("integrations");
  const [filter, setFilter] = useState<string>("");
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [addCustomAppOpen, setAddCustomAppOpen] = useState(false);
  const workspaceLink = useWorkspaceLink();
  const navigateWorkspace = useNavigateWorkspace();
  const team = useCurrentTeam();
  const apps = useGroupedApps({
    filter,
  });

  const navigateToApp = (app: GroupedApp) => {
    navigateWorkspace(`/apps/${app.id}`);
  };

  // Build a map of native app IDs to their actual views
  const nativeViewsMap = useMemo(() => {
    const map = new Map<string, View>();
    const views = (team?.views ?? []) as View[];

    // Legacy title mapping
    const legacyTitleMap: Record<string, string> = {
      Prompts: "Documents",
    };
    const canonicalTitle = (title: string) => legacyTitleMap[title] ?? title;

    for (const [nativeAppId, expectedTitle] of Object.entries(
      NATIVE_APP_NAME_MAP,
    )) {
      const view = views.find((v) => canonicalTitle(v.title) === expectedTitle);
      if (view) {
        map.set(nativeAppId, view);
      }
    }

    return map;
  }, [team?.views]);

  // Set integration management tools into thread context
  const threadContextItems = useMemo(() => {
    const integrationId = "i:integration-management";

    return [
      {
        id: crypto.randomUUID(),
        type: "rule" as const,
        text: `The user is managing their installed integrations and MCP apps. Help them explore, configure, and manage their installed apps by actively using integration management tools. When the user asks about their integrations or wants to manage them, prefer to demonstrate the available tools in action.`,
      },
      {
        id: crypto.randomUUID(),
        type: "toolset" as const,
        integrationId,
        enabledTools: [
          "INTEGRATIONS_LIST",
          "INTEGRATIONS_GET",
          "INTEGRATIONS_CREATE",
          "INTEGRATIONS_UPDATE",
          "INTEGRATIONS_DELETE",
        ],
      },
    ];
  }, []);

  useSetThreadContextEffect(threadContextItems);

  return (
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4 overflow-x-auto">
        <Header
          query={filter}
          setQuery={setFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
          actionsRight={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAddCustomAppOpen(true)}
              >
                Add custom
              </Button>
              <Button asChild variant="special">
                <Link to={workspaceLink(`/store`)}>Store</Link>
              </Button>
            </div>
          }
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
          <CardsView
            apps={apps}
            onClick={navigateToApp}
            nativeViewsMap={nativeViewsMap}
            onFilesClick={() => setFilesModalOpen(true)}
          />
        ) : (
          <TableView apps={apps} onClick={navigateToApp} />
        )}
      </div>

      {/* Files Modal */}
      <Dialog open={filesModalOpen} onOpenChange={setFilesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File System Access</DialogTitle>
            <DialogDescription>Coming soon to deco.cx</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-linear-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
                <Icon name="folder_open" size={32} className="text-primary" />
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Direct file system access is coming soon. You'll be able to
                browse, edit, and manage your project files directly from the
                dashboard.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Browse project files</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Edit files in-browser</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Manage file structure</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Custom App Dialog */}
      <AddCustomAppDialog
        open={addCustomAppOpen}
        onOpenChange={setAddCustomAppOpen}
      />
    </div>
  );
}
