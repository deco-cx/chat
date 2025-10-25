import {
  findPinnedView,
  Integration,
  Resource,
  useConnectionViews,
  useIntegrations,
  usePinnedResources,
  useRecentResources,
  useRemoveResource,
  useRemoveView,
  useUnpinnedNativeViews,
  useUpsertDocument,
  View,
  AI_APP_PRD_TEMPLATE,
} from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  type ReactNode,
  Suspense,
  useMemo,
  useState,
  type DragEvent,
  useEffect,
  useRef,
} from "react";
import {
  Link,
  useLocation,
  useMatch,
  useNavigate,
  useParams,
} from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { TogglePin } from "../views/list.tsx";
import { SidebarFooter } from "./footer.tsx";
import { useCurrentTeam } from "./team-selector.tsx";
import { useFocusTeamAgent } from "../agents/list.tsx";
import { SearchComingSoonModal } from "../modals/search-coming-soon-modal.tsx";
import {
  CommandPalette,
  useCommandPalette,
} from "../search/command-palette.tsx";

const WithActive = ({
  children,
  ...props
}: {
  to: string;
  children: (props: { isActive: boolean }) => ReactNode;
}) => {
  const match = useMatch(props.to);

  return <div {...props}>{children({ isActive: !!match })}</div>;
};

function AddViewsDialog({
  integration,
  open,
  onOpenChange,
}: {
  integration: Integration;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currentTeam = useCurrentTeam();
  const { data: viewsData, isLoading: isLoadingViews } = useConnectionViews(
    integration,
    false,
  );
  const views = viewsData?.views || [];

  // Check which views are already added to the team
  const viewsWithStatus = useMemo(() => {
    if (!views || views.length === 0 || !currentTeam.views) return [];

    return views.map((view) => {
      const existingView = findPinnedView(currentTeam.views, integration.id, {
        name: view.name,
        url: view.url,
      });

      return {
        ...view,
        integration: integration,
        isAdded: !!existingView,
        teamViewId: existingView?.id,
      } as typeof view & {
        isAdded: boolean;
        teamViewId?: string;
        integration: Integration;
      };
    });
  }, [views, currentTeam.views, integration.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Views from {integration.name}</DialogTitle>
          <DialogDescription>
            Select views to add to your sidebar from this integration.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 overflow-y-auto">
          {isLoadingViews ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : viewsWithStatus.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-8">
              {views.length === 0
                ? "No views available from this integration"
                : "All available views have already been added"}
            </div>
          ) : (
            <div className="space-y-2">
              {viewsWithStatus.map((view) => (
                <div
                  key={view.name ?? view.url ?? view.title}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-background hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {view.icon && (
                      <Icon
                        name={view.icon}
                        size={20}
                        className="flex-shrink-0 text-muted-foreground"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium truncate">
                        {view.title}
                      </h4>
                      {view.url && (
                        <p className="text-xs text-muted-foreground truncate">
                          {view.url}
                        </p>
                      )}
                    </div>
                  </div>
                  <TogglePin view={view} />
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceViews() {
  const { org, project } = useParams();
  const workspaceLink = useWorkspaceLink();
  const { isMobile, toggleSidebar } = useSidebar();
  const { data: integrations } = useIntegrations();
  const team = useCurrentTeam();
  const removeViewMutation = useRemoveView();
  const navigateWorkspace = useNavigateWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [addViewsDialogState, setAddViewsDialogState] = useState<{
    open: boolean;
    integration?: Integration;
  }>({ open: false });
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [filesModalOpen, setFilesModalOpen] = useState(false);
  const [databaseModalOpen, setDatabaseModalOpen] = useState(false);
  const [_searchModalOpen, _setSearchModalOpen] = useState(false);
  const [_showAllRecents, _setShowAllRecents] = useState(false);

  // Recent and pinned resources
  // Use team locator if params aren't available - fallback to just undefined if no params
  const projectKey = org && project ? `${org}/${project}` : undefined;

  const { recents: _recents, removeRecent: _removeRecent } =
    useRecentResources(projectKey);
  const {
    pinnedResources: _pinnedResources,
    togglePin: _togglePin,
    isPinned: _isPinned,
    reorderPinnedResources: _reorderPinnedResources,
  } = usePinnedResources(projectKey);

  const {
    unpinView: _unpinNativeView,
    pinView: _pinNativeView,
    isViewUnpinned: _isNativeViewUnpinned,
  } = useUnpinnedNativeViews(projectKey);

  // Drag and drop state for pinned items
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [isDragMode, setIsDragMode] = useState(false);
  const draggedItemIdRef = useRef<string | null>(null);

  // Unified pinned items order stored in localStorage
  const [pinnedOrder, setPinnedOrder] = useState<string[]>(() => {
    if (typeof window === "undefined" || !org || !project) return [];
    try {
      const stored = localStorage.getItem(`pinned-order-${org}-${project}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation();

    const itemId = allPinnedItems[index]?.id;
    setDraggedItem(index);
    // Store the item ID to track it as it moves
    draggedItemIdRef.current = itemId || null;

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", itemId || "");

    // Use the current element as drag image with better offset
    // Position it so the cursor is at the left edge, vertically centered
    if (e.currentTarget instanceof HTMLElement) {
      const offsetX = 20; // Small offset from left edge (where drag handle is)
      const offsetY = e.currentTarget.offsetHeight / 2; // Vertically centered
      e.dataTransfer.setDragImage(e.currentTarget, offsetX, offsetY);
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    if (draggedItemIdRef.current === null) return;

    // Find current position of the dragged item
    const currentDraggedIndex = allPinnedItems.findIndex(
      (item) => item.id === draggedItemIdRef.current,
    );

    if (currentDraggedIndex === -1) return;
    if (currentDraggedIndex === index) return;

    // Live swap: reorder items as we drag over them
    setPinnedOrder((prev) => {
      const newOrder = [...prev];
      const [removed] = newOrder.splice(currentDraggedIndex, 1);
      newOrder.splice(index, 0, removed);
      return newOrder;
    });
  };

  const handleDragLeave = () => {
    // Not needed for swap behavior
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Just save to localStorage (order already updated during dragOver)
    if (org && project) {
      try {
        localStorage.setItem(
          `pinned-order-${org}-${project}`,
          JSON.stringify(pinnedOrder),
        );
      } catch (error) {
        console.error("Failed to save pinned order:", error);
      }
    }

    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
    draggedItemIdRef.current = null;
  };

  // Command palette
  const commandPalette = useCommandPalette();

  // Hook for creating documents
  const upsertDocument = useUpsertDocument();

  const handleCreateAgent = useFocusTeamAgent();

  const handleOpenSearch = () => {
    commandPalette.setOpen(true);
  };

  const handleRemoveView = async (view: View) => {
    const isUserInView = globalThis.location.pathname.includes(
      `/views/${view.id}`,
    );
    if (isUserInView) {
      navigateWorkspace("/");
      await removeViewMutation.mutateAsync({
        viewId: view.id,
      });
      return;
    }
    await removeViewMutation.mutateAsync({
      viewId: view.id,
    });
  };

  const removeResourceMutation = useRemoveResource();

  const handleRemoveResource = async (resource: { resourceId: string }) => {
    const isUserInResource = globalThis.location.pathname.includes(
      `/rsc/${resource.resourceId}`,
    );
    if (isUserInResource) {
      navigateWorkspace("/");
      await removeResourceMutation.mutateAsync({
        resourceId: resource.resourceId,
      });
      return;
    }
    await removeResourceMutation.mutateAsync({
      resourceId: resource.resourceId,
    });
  };

  const integrationMap = new Map(
    integrations?.map((integration) => [integration.id, integration]),
  );

  const { fromIntegration, firstLevelViews, fromIntegrationResources } =
    useMemo(() => {
      const result: {
        fromIntegration: Record<string, View[]>;
        firstLevelViews: View[];
        fromIntegrationResources: Record<string, Resource[]>;
      } = {
        fromIntegration: {},
        firstLevelViews: [],
        fromIntegrationResources: {},
      };

      const views = (team?.views ?? []) as View[];
      for (const view of views) {
        const integrationId = view.integrationId as string | undefined;
        if (integrationId) {
          const isInstalled = integrations?.some(
            (integration) => integration.id === integrationId,
          );

          if (!isInstalled) {
            continue;
          }

          if (!result.fromIntegration[integrationId]) {
            result.fromIntegration[integrationId] = [];
          }
          result.fromIntegration[integrationId].push(view);
          continue;
        }

        if (view.type === "custom") {
          if (!result.fromIntegration["custom"]) {
            result.fromIntegration["custom"] = [];
          }
          result.fromIntegration["custom"].push(view);
          continue;
        }

        result.firstLevelViews.push(view);
      }
      // Process resources (stored as views with type="resource")
      const resources = team?.resources ?? [];
      for (const resource of resources) {
        const integrationId = resource.integration_id as string | undefined;
        if (integrationId) {
          const isInstalled = integrations?.some(
            (integration) => integration.id === integrationId,
          );

          if (!isInstalled) {
            continue;
          }

          if (!result.fromIntegrationResources[integrationId]) {
            result.fromIntegrationResources[integrationId] = [];
          }
          result.fromIntegrationResources[integrationId].push(resource);
        }
      }

      return result;
    }, [team?.views, team?.resources, integrations]);

  function buildViewHrefFromView(view: View): string {
    if (view.type === "custom") {
      if (view?.name) {
        return workspaceLink(`/views/${view.integrationId}/${view.name}`);
      }
      const rawUrl = view?.metadata?.url as string | undefined;
      const qs = rawUrl ? `?viewUrl=${encodeURIComponent(rawUrl)}` : "";
      return workspaceLink(`/views/${view.integrationId}/index${qs}`);
    }
    const path = view?.metadata?.path as string | undefined;
    return workspaceLink(path ?? "/");
  }

  const wellKnownItems = [
    "Tools",
    "Views",
    "Workflows",
    "Documents",
    "Agents",
    "Theme",
  ];
  const legacyTitleMap: Record<string, string> = {
    Prompts: "Documents",
  };
  const canonicalTitle = (title: string) => legacyTitleMap[title] ?? title;

  function buildResourceHrefFromResource(resource: {
    integration_id: string;
    name: string;
  }): string {
    return workspaceLink(`/rsc/${resource.integration_id}/${resource.name}`);
  }

  // Separate items for organization
  const mcpItems = firstLevelViews
    .filter((item) => wellKnownItems.includes(canonicalTitle(item.title)))
    .sort((a, b) => {
      const predefinedOrder = wellKnownItems;
      return (
        predefinedOrder.indexOf(canonicalTitle(a.title)) -
        predefinedOrder.indexOf(canonicalTitle(b.title))
      );
    });

  // Building blocks are now handled by resourceItems below

  // Resource type order for main resources section
  const resourceTypeOrder = [
    "Documents",
    "Agents",
    "Workflows",
    "Tools",
    "Views",
    "Files",
    "Theme",
  ];
  const resourceItems = resourceTypeOrder
    .map((title) => {
      if (title === "Files") {
        return {
          id: "native:::files",
          title: "Files",
          icon: "folder",
          onClick: () => setFilesModalOpen(true),
          comingSoon: true,
        };
      }
      const item = mcpItems.find(
        (item) => canonicalTitle(item.title) === title,
      );
      return item ? { ...item, comingSoon: false } : null;
    })
    .filter(
      (
        item,
      ): item is
        | (View & { comingSoon: boolean })
        | {
            id: string;
            title: string;
            icon: string;
            onClick: () => void;
            comingSoon: boolean;
          } => item !== null,
    )
    // Filter out unpinned native views
    .filter((item) => {
      if ("onClick" in item && item.id) {
        return !_isNativeViewUnpinned(item.id);
      }
      if ("id" in item && item.id) {
        return !_isNativeViewUnpinned(item.id);
      }
      return true;
    });

  // Create unified list of all pinned items for drag-and-drop
  const allPinnedItems = useMemo(() => {
    const items: Array<{
      id: string;
      type: "native" | "integration" | "resource";
      data: any;
    }> = [];

    // Add native views (Documents, Agents, etc.)
    resourceItems.forEach((item) => {
      if ("onClick" in item && item.comingSoon) {
        items.push({
          id: `native:::${item.title}`,
          type: "native",
          data: item,
        });
      } else {
        items.push({ id: (item as View).id, type: "native", data: item });
      }
    });

    // Add integration views (Site, Database)
    Object.entries(fromIntegration).forEach(([integrationId, views]) => {
      items.push({
        id: `integration:::${integrationId}`,
        type: "integration",
        data: { integrationId, views },
      });
    });

    // Add resources from integrations
    Object.entries(fromIntegrationResources).forEach(
      ([integrationId, resources]) => {
        items.push({
          id: `integration-resource:::${integrationId}`,
          type: "integration",
          data: { integrationId, resources, isResource: true },
        });
      },
    );

    // Add pinned resources
    _pinnedResources.forEach((resource) => {
      items.push({
        id: `pinned:::${resource.id}`,
        type: "resource",
        data: resource,
      });
    });

    // Apply custom order if it exists
    if (pinnedOrder.length > 0) {
      const ordered = [];
      const itemsMap = new Map(items.map((item) => [item.id, item]));

      // Add items in stored order
      for (const id of pinnedOrder) {
        if (itemsMap.has(id)) {
          ordered.push(itemsMap.get(id)!);
          itemsMap.delete(id);
        }
      }

      // Add any new items that aren't in the order yet
      ordered.push(...Array.from(itemsMap.values()));

      return ordered;
    }

    return items;
  }, [
    resourceItems,
    fromIntegration,
    fromIntegrationResources,
    _pinnedResources,
    pinnedOrder,
  ]);

  // Helper to get common drag props
  const getDragProps = (index: number, itemId: string) => ({
    draggable: isDragMode,
    onDragStart: isDragMode
      ? (e: React.DragEvent) => handleDragStart(e, index)
      : undefined,
    onDragOver: isDragMode
      ? (e: React.DragEvent) => handleDragOver(e, index)
      : undefined,
    onDragLeave: isDragMode ? handleDragLeave : undefined,
    onDrop: isDragMode
      ? (e: React.DragEvent) => handleDrop(e, index)
      : undefined,
    onDragEnd: isDragMode ? handleDragEnd : undefined,
    className: isDragMode
      ? `cursor-grab active:cursor-grabbing transition-all duration-150 ${
          draggedItem !== null && draggedItemIdRef.current === itemId
            ? "opacity-50"
            : ""
        }`
      : "",
  });

  // Helper to handle pinning from recents
  const handlePinFromRecents = (resource: (typeof _recents)[0]) => {
    const isNativeView =
      resource.type === "view" &&
      mcpItems.some((item) => item.id === resource.id);

    if (isNativeView) {
      _pinNativeView(resource.id);
      trackEvent("sidebar_pin_native_view_from_recents", {
        view: resource.name,
      });
    } else {
      _togglePin({
        id: resource.id,
        name: resource.name,
        type: resource.type,
        integration_id: resource.integration_id,
        icon: resource.icon,
        path: resource.path,
      });
    }
  };

  // Update pinnedOrder when items change
  useEffect(() => {
    const currentIds = allPinnedItems.map((item) => item.id);
    const currentIdsSet = new Set(currentIds);
    const storedIdsSet = new Set(pinnedOrder);

    // Check if items were added or removed
    const hasChanges =
      currentIds.length !== pinnedOrder.length ||
      currentIds.some((id) => !storedIdsSet.has(id)) ||
      pinnedOrder.some((id) => !currentIdsSet.has(id));

    if (hasChanges) {
      // Merge: keep existing order, add new items at the end
      const newOrder = [...pinnedOrder.filter((id) => currentIdsSet.has(id))];
      currentIds.forEach((id) => {
        if (!storedIdsSet.has(id)) {
          newOrder.push(id);
        }
      });

      setPinnedOrder(newOrder);
      if (org && project) {
        try {
          localStorage.setItem(
            `pinned-order-${org}-${project}`,
            JSON.stringify(newOrder),
          );
        } catch (error) {
          console.error("Failed to save pinned order:", error);
        }
      }
    }
  }, [allPinnedItems, org, project]);

  // Render native items (Documents, Agents, Workflows, Tools, Views, Files)
  const renderNativeItem = (
    item: (typeof allPinnedItems)[0],
    index: number,
  ) => {
    const nativeItem = item.data;
    if ("onClick" in nativeItem && nativeItem.comingSoon) {
      // Files button
      const filesViewId = "native:::files";
      return (
        <SidebarMenuItem key={item.id} {...getDragProps(index, item.id)}>
          <SidebarMenuButton
            className="cursor-pointer group/item relative w-full pr-2"
            onClick={isDragMode ? undefined : nativeItem.onClick}
          >
            {isDragMode && (
              <Icon
                name="drag_indicator"
                size={16}
                className="text-muted-foreground shrink-0"
              />
            )}
            <Icon
              name={nativeItem.icon}
              size={20}
              className="text-muted-foreground/75 shrink-0"
            />
            <span className="truncate flex-1 min-w-0 group-hover/item:pr-8">
              {nativeItem.title}
            </span>
            <Badge
              variant="secondary"
              className="text-xs group-hover/item:opacity-0 transition-opacity"
            >
              Soon
            </Badge>
            <Icon
              name="unpin"
              size={18}
              className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                _unpinNativeView(filesViewId);
                trackEvent("sidebar_unpin_native_view", {
                  view: nativeItem.title,
                });
              }}
            />
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }
    // Regular native view (Documents, Agents, etc.)
    const view = nativeItem as View;
    const href = buildViewHrefFromView(view);
    const displayTitle = canonicalTitle(view.title);
    return (
      <SidebarMenuItem key={item.id} {...getDragProps(index, item.id)}>
        <WithActive to={href}>
          {({ isActive }) => (
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className="w-full pr-2"
            >
              <Link
                to={href}
                className="group/item relative"
                onClick={(e) => {
                  if (isDragMode) {
                    e.preventDefault();
                    return;
                  }
                  trackEvent("sidebar_navigation_click", {
                    item: displayTitle,
                  });
                  isMobile && toggleSidebar();
                }}
              >
                {isDragMode && (
                  <Icon
                    name="drag_indicator"
                    size={16}
                    className="text-muted-foreground shrink-0"
                  />
                )}
                <Icon
                  name={view.icon}
                  size={20}
                  className="text-muted-foreground/75 shrink-0"
                />
                <span className="truncate flex-1 min-w-0 group-hover/item:pr-8">
                  {displayTitle}
                </span>
                {view.badge && (
                  <Badge variant="secondary" className="text-xs">
                    {view.badge}
                  </Badge>
                )}
                <Icon
                  name="unpin"
                  size={18}
                  className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    _unpinNativeView(view.id);
                    trackEvent("sidebar_unpin_native_view", {
                      view: displayTitle,
                    });
                  }}
                />
              </Link>
            </SidebarMenuButton>
          )}
        </WithActive>
      </SidebarMenuItem>
    );
  };

  // Render integration items (Site, Database, and integration resources)
  const renderIntegrationItem = (
    item: (typeof allPinnedItems)[0],
    index: number,
  ) => {
    const { integrationId, views, isResource, resources } = item.data;
    const integration = integrationMap.get(integrationId);

    if (isResource) {
      // This is an integration resource section
      const isSingleResource = resources.length === 1;

      if (isSingleResource) {
        const [resource] = resources;
        const href = buildResourceHrefFromResource(resource);

        return (
          <SidebarMenuItem
            key={item.id}
            draggable={isDragMode}
            onDragStart={
              isDragMode ? (e) => handleDragStart(e, index) : undefined
            }
            onDragOver={
              isDragMode ? (e) => handleDragOver(e, index) : undefined
            }
            onDragLeave={isDragMode ? handleDragLeave : undefined}
            onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
            onDragEnd={isDragMode ? handleDragEnd : undefined}
            className={
              isDragMode
                ? `cursor-grab active:cursor-grabbing transition-all duration-150
                        ${draggedItemIdRef.current === item.id ? "opacity-50" : ""}`
                : ""
            }
          >
            <WithActive to={href}>
              {({ isActive }) => (
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  className="w-full pr-8"
                >
                  <Link
                    to={href}
                    className="group/item relative"
                    onClick={(e) => {
                      if (isDragMode) {
                        e.preventDefault();
                        return;
                      }
                      if (location.pathname === href) {
                        e.preventDefault();
                        navigate(0);
                        return;
                      }
                      trackEvent("sidebar_navigation_click", {
                        item: resource.title,
                      });
                      isMobile && toggleSidebar();
                    }}
                  >
                    {isDragMode && (
                      <Icon
                        name="drag_indicator"
                        size={16}
                        className="text-muted-foreground shrink-0"
                      />
                    )}
                    <div className="relative">
                      <IntegrationAvatar
                        size="xs"
                        url={integration?.icon}
                        fallback={integration?.name}
                        className="!w-[18px] !h-[18px] !rounded-md"
                      />
                    </div>
                    <span className="truncate group-hover/item:pr-8">
                      {resource.title ?? integration?.name ?? "Resource"}
                    </span>
                    <Icon
                      name="remove"
                      size={18}
                      className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemoveResource({ resourceId: resource.id });
                      }}
                    />
                  </Link>
                </SidebarMenuButton>
              )}
            </WithActive>
          </SidebarMenuItem>
        );
      }
      // Multiple resources - render collapsible
      return (
        <SidebarMenuItem
          key={item.id}
          draggable={isDragMode}
          onDragStart={
            isDragMode ? (e) => handleDragStart(e, index) : undefined
          }
          onDragOver={isDragMode ? (e) => handleDragOver(e, index) : undefined}
          onDragLeave={isDragMode ? handleDragLeave : undefined}
          onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
          onDragEnd={isDragMode ? handleDragEnd : undefined}
          className={
            isDragMode
              ? `cursor-grab active:cursor-grabbing transition-all duration-150
                        ${draggedItemIdRef.current === item.id ? "opacity-50" : ""}`
              : ""
          }
        >
          <Collapsible
            asChild
            defaultOpen={false}
            className="group/collapsible"
          >
            <div className="group/integration-header relative">
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className="w-full pr-8"
                  onClick={(e) => {
                    if (isDragMode) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {isDragMode && (
                    <Icon
                      name="drag_indicator"
                      size={16}
                      className="text-muted-foreground shrink-0"
                    />
                  )}
                  <div className="relative">
                    <IntegrationAvatar
                      size="xs"
                      url={integration?.icon}
                      fallback={integration?.name}
                      className="!w-[18px] !h-[18px] !rounded-md"
                    />
                  </div>
                  <span className="truncate">
                    {integration?.name ?? "Resources"}
                  </span>
                  <Icon
                    name="chevron_right"
                    size={18}
                    className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {resources.map((resource: any) => {
                    const href = buildResourceHrefFromResource(resource);

                    return (
                      <SidebarMenuSubItem key={resource.id}>
                        <SidebarMenuSubButton asChild>
                          <Link
                            to={href}
                            className="group/item relative"
                            onClick={() => {
                              if (isDragMode) {
                                return;
                              }
                              trackEvent("sidebar_navigation_click", {
                                item: resource.title,
                              });
                              isMobile && toggleSidebar();
                            }}
                          >
                            <Icon
                              name="folder"
                              size={18}
                              className="text-muted-foreground/75"
                            />
                            <span className="truncate group-hover/item:pr-8">
                              {resource.title}
                            </span>
                            {!isDragMode && (
                              <Icon
                                name="remove"
                                size={18}
                                className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRemoveResource({
                                    resourceId: resource.id,
                                  });
                                }}
                              />
                            )}
                          </Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    );
                  })}
                </SidebarMenuSub>
              </CollapsibleContent>
            </div>
          </Collapsible>
        </SidebarMenuItem>
      );
    }

    // Integration view section (Site, Database)
    const isSingleView = views.length === 1;

    if (isSingleView) {
      const [view] = views;
      const href = buildViewHrefFromView(view as View);

      return (
        <SidebarMenuItem
          key={item.id}
          draggable={isDragMode}
          onDragStart={
            isDragMode ? (e) => handleDragStart(e, index) : undefined
          }
          onDragOver={isDragMode ? (e) => handleDragOver(e, index) : undefined}
          onDragLeave={isDragMode ? handleDragLeave : undefined}
          onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
          onDragEnd={isDragMode ? handleDragEnd : undefined}
          className={
            isDragMode
              ? `cursor-grab active:cursor-grabbing transition-all duration-150
                        ${draggedItemIdRef.current === item.id ? "opacity-50" : ""}`
              : ""
          }
        >
          <WithActive to={href}>
            {({ isActive }) => (
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className="w-full pr-2"
              >
                <Link
                  to={href}
                  className="group/item relative"
                  onClick={(e) => {
                    if (isDragMode) {
                      e.preventDefault();
                      return;
                    }
                    trackEvent("sidebar_navigation_click", {
                      item: view.title,
                    });
                    isMobile && toggleSidebar();
                  }}
                >
                  {isDragMode && (
                    <Icon
                      name="drag_indicator"
                      size={16}
                      className="text-muted-foreground shrink-0"
                    />
                  )}
                  <div className="relative">
                    <IntegrationAvatar
                      size="xs"
                      url={integration?.icon}
                      fallback={integration?.name}
                      className="!w-[22px] !h-[22px] !rounded-md"
                    />
                  </div>
                  <span
                    className={
                      view.type === "custom"
                        ? "truncate group-hover/item:pr-8"
                        : "truncate"
                    }
                  >
                    {view.title ?? integration?.name ?? "Custom"}
                  </span>
                  {view.type === "custom" && (
                    <Icon
                      name="push_pin"
                      size={18}
                      className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        handleRemoveView(view);
                      }}
                    />
                  )}
                </Link>
              </SidebarMenuButton>
            )}
          </WithActive>
        </SidebarMenuItem>
      );
    }

    // Multiple views - render collapsible (Site with Pages/Assets)
    return (
      <SidebarMenuItem
        key={item.id}
        draggable={isDragMode}
        onDragStart={isDragMode ? (e) => handleDragStart(e, index) : undefined}
        onDragOver={isDragMode ? (e) => handleDragOver(e, index) : undefined}
        onDragLeave={isDragMode ? handleDragLeave : undefined}
        onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
        onDragEnd={isDragMode ? handleDragEnd : undefined}
        className={
          isDragMode
            ? `cursor-grab active:cursor-grabbing transition-all duration-150
                        ${draggedItemIdRef.current === item.id ? "opacity-50" : ""}`
            : ""
        }
      >
        <Collapsible asChild defaultOpen={false} className="group/collapsible">
          <div className="group/integration-header relative">
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                className="w-full pr-2"
                onClick={(e) => {
                  if (isDragMode) {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                }}
              >
                {isDragMode && (
                  <Icon
                    name="drag_indicator"
                    size={16}
                    className="text-muted-foreground shrink-0"
                  />
                )}
                <div className="relative">
                  <IntegrationAvatar
                    size="xs"
                    url={integration?.icon}
                    fallback={integration?.name}
                    className="!w-[22px] !h-[22px] !rounded-md"
                  />
                  {integration && integrationId !== "custom" && !isDragMode && (
                    <SidebarMenuAction
                      asChild
                      className="absolute inset-0 hidden items-center justify-center rounded-md border border-border/80 bg-background/95 shadow-sm transition-opacity group-hover/integration-header:flex"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setAddViewsDialogState({
                          open: true,
                          integration,
                        });
                      }}
                      aria-label={`Add view to ${
                        integration?.name ?? "integration"
                      }`}
                      showOnHover
                    >
                      <span
                        role="button"
                        tabIndex={0}
                        className="flex h-full w-full items-center justify-center"
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            setAddViewsDialogState({
                              open: true,
                              integration,
                            });
                          }
                        }}
                      >
                        <Icon
                          name="add"
                          size={14}
                          className="text-muted-foreground"
                        />
                      </span>
                    </SidebarMenuAction>
                  )}
                </div>
                <span className="truncate">
                  {integration?.name ?? "Custom"}
                </span>
                <Icon
                  name="chevron_right"
                  size={18}
                  className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {views.map((view: View) => {
                  const href = buildViewHrefFromView(view as View);

                  return (
                    <SidebarMenuSubItem key={view.id}>
                      <SidebarMenuSubButton asChild>
                        <Link
                          to={href}
                          className="group/item relative"
                          onClick={(e) => {
                            if (isDragMode) {
                              e.preventDefault();
                              return;
                            }
                            trackEvent("sidebar_navigation_click", {
                              item: view.title,
                            });
                            isMobile && toggleSidebar();
                          }}
                        >
                          <Icon
                            name={view.icon}
                            size={18}
                            className="text-muted-foreground/75"
                          />
                          <span
                            className={
                              view.type === "custom"
                                ? "truncate group-hover/item:pr-8"
                                : "truncate"
                            }
                          >
                            {view.title}
                          </span>
                          {view.type === "custom" && !isDragMode && (
                            <Icon
                              name="push_pin"
                              size={18}
                              className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                handleRemoveView(view);
                              }}
                            />
                          )}
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </div>
        </Collapsible>
      </SidebarMenuItem>
    );
  };

  // Render pinned resources (individual documents, agents, workflows, etc.)
  const renderResourceItem = (
    item: (typeof allPinnedItems)[0],
    index: number,
  ) => {
    const resource = item.data;
    return (
      <SidebarMenuItem
        key={item.id}
        draggable={isDragMode}
        onDragStart={isDragMode ? (e) => handleDragStart(e, index) : undefined}
        onDragOver={isDragMode ? (e) => handleDragOver(e, index) : undefined}
        onDragLeave={isDragMode ? handleDragLeave : undefined}
        onDrop={isDragMode ? (e) => handleDrop(e, index) : undefined}
        onDragEnd={isDragMode ? handleDragEnd : undefined}
        className={
          isDragMode
            ? `cursor-grab active:cursor-grabbing transition-all duration-150
                        ${draggedItemIdRef.current === item.id ? "opacity-50" : ""}`
            : ""
        }
      >
        <WithActive to={resource.path}>
          {({ isActive }) => (
            <SidebarMenuButton
              asChild={!isDragMode}
              isActive={isActive}
              className="w-full pr-2"
            >
              {isDragMode ? (
                <div className="group/item relative flex items-center gap-2">
                  <Icon
                    name="drag_indicator"
                    size={16}
                    className="text-muted-foreground shrink-0"
                  />
                  {resource.type === "agent" ? (
                    <AgentAvatar
                      size="xs"
                      url={resource.icon}
                      fallback={resource.name}
                      className="!w-[20px] !h-[20px] shrink-0"
                    />
                  ) : resource.icon ? (
                    <Icon
                      name={resource.icon}
                      size={20}
                      className="text-muted-foreground/75 shrink-0"
                    />
                  ) : null}
                  <span className="truncate flex-1 min-w-0">
                    {resource.name}
                  </span>
                </div>
              ) : (
                <Link
                  to={resource.path}
                  className="group/item relative"
                  onClick={(e) => {
                    trackEvent("sidebar_navigation_click", {
                      item: resource.name,
                      type: "pinned-resource",
                    });
                    isMobile && toggleSidebar();
                  }}
                >
                  {resource.type === "agent" ? (
                    <AgentAvatar
                      size="xs"
                      url={resource.icon}
                      fallback={resource.name}
                      className="!w-[20px] !h-[20px] shrink-0"
                    />
                  ) : resource.icon ? (
                    <Icon
                      name={resource.icon}
                      size={20}
                      className="text-muted-foreground/75 shrink-0"
                    />
                  ) : null}
                  <span className="truncate flex-1 min-w-0 group-hover/item:pr-8">
                    {resource.name}
                  </span>
                  <Icon
                    name="push_pin"
                    size={18}
                    className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2 -rotate-45"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      _togglePin(resource);
                    }}
                  />
                </Link>
              )}
            </SidebarMenuButton>
          )}
        </WithActive>
      </SidebarMenuItem>
    );
  };

  // Main dispatcher function
  const renderPinnedItem = (
    item: (typeof allPinnedItems)[0],
    index: number,
  ) => {
    switch (item.type) {
      case "native":
        return renderNativeItem(item, index);
      case "integration":
        return renderIntegrationItem(item, index);
      case "resource":
        return renderResourceItem(item, index);
      default:
        return null;
    }
  };

  // Filter out pinned items from recents and limit to 5 initially
  const _filteredRecents = _recents.filter((recent) => {
    // Filter out pinned resource instances
    if (_isPinned(recent.id)) return false;

    // Filter out native views that are currently pinned (not unpinned)
    if (recent.type === "view" && !_isNativeViewUnpinned(recent.id))
      return false;

    return true;
  });
  const _displayedRecents = _showAllRecents
    ? _filteredRecents
    : _filteredRecents.slice(0, 5);
  const _hasMoreRecents = _filteredRecents.length > 5;

  return (
    <>
      {/* SECTION 1: SEARCH + RESOURCE INSTANCES */}

      {/* Search button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer justify-between"
          onClick={() => handleOpenSearch()}
        >
          <div className="flex items-center gap-2">
            <Icon
              name="search"
              size={20}
              className="text-muted-foreground/75"
            />
            <span className="truncate">Search</span>
          </div>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            <span className="text-xs">⌘</span>K
          </kbd>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* Generate button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => setGenerateModalOpen(true)}
        >
          <Icon name="add" size={20} className="text-muted-foreground/75" />
          <span className="truncate">Generate</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      {/* Manage Apps button */}
      <SidebarMenuItem>
        <SidebarMenuButton
          className="cursor-pointer"
          onClick={() => {
            navigateWorkspace("/apps");
            trackEvent("sidebar_navigation_click", {
              item: "Apps",
            });
            isMobile && toggleSidebar();
          }}
        >
          <Icon
            name="grid_view"
            size={20}
            className="text-muted-foreground/75"
          />
          <span className="truncate">Apps</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <SidebarSeparator className="my-2 -ml-1" />

      {/* SECTION 2: PINNED */}
      <SidebarMenuItem>
        <div className="px-2 py-0 text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>Pinned</span>
          <button
            onClick={() => setIsDragMode(!isDragMode)}
            className="p-1 hover:bg-accent rounded transition-colors"
            title={
              isDragMode
                ? "Click to exit drag mode"
                : "Click to reorder pinned items"
            }
          >
            <Icon
              name={isDragMode ? "lock_open" : "lock"}
              size={14}
              className={
                isDragMode
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }
            />
          </button>
        </div>
      </SidebarMenuItem>

      {/* Render all pinned items in custom order */}
      {allPinnedItems.map((item, index) => renderPinnedItem(item, index))}

      {/* OLD CODE - Keep for reference but commented out */}
      {false &&
        resourceItems.map((item) => {
          if ("onClick" in item && item.comingSoon) {
            // Files button (coming soon) - we need a fake view ID for unpinning
            const filesViewId = "native:::files";

            return (
              <SidebarMenuItem
                key={item.title}
                draggable={isDragMode}
                onDragStart={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) => i.id === `native:::${item.title}`,
                        );
                        handleDragStart(e, itemIndex);
                      }
                    : undefined
                }
                onDragOver={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) => i.id === `native:::${item.title}`,
                        );
                        handleDragOver(e, itemIndex);
                      }
                    : undefined
                }
                onDragLeave={isDragMode ? handleDragLeave : undefined}
                onDrop={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) => i.id === `native:::${item.title}`,
                        );
                        handleDrop(e, itemIndex);
                      }
                    : undefined
                }
                onDragEnd={isDragMode ? handleDragEnd : undefined}
                className={
                  isDragMode
                    ? `cursor-grab active:cursor-grabbing transition-all duration-150
                     ${draggedItem !== null && draggedItemIdRef.current === `native:::${item.title}` ? "opacity-50" : ""}
`
                    : ""
                }
              >
                <SidebarMenuButton
                  className="cursor-pointer group/item relative w-full pr-2"
                  onClick={isDragMode ? undefined : item.onClick}
                >
                  {isDragMode && (
                    <Icon
                      name="drag_indicator"
                      size={16}
                      className="text-muted-foreground shrink-0"
                    />
                  )}
                  <Icon
                    name={item.icon}
                    size={20}
                    className="text-muted-foreground/75 shrink-0"
                  />
                  <span className="truncate flex-1 min-w-0 group-hover/item:pr-8">
                    {item.title}
                  </span>
                  <Badge
                    variant="secondary"
                    className="text-xs group-hover/item:opacity-0 transition-opacity"
                  >
                    Soon
                  </Badge>
                  <Icon
                    name="unpin"
                    size={18}
                    className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      _unpinNativeView(filesViewId);
                      trackEvent("sidebar_unpin_native_view", {
                        view: item.title,
                      });
                    }}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          // Regular resource type buttons - now with unpin capability
          const view = item as View;
          const href = buildViewHrefFromView(view);
          const displayTitle = canonicalTitle(view.title);

          return (
            <SidebarMenuItem
              key={view.title}
              draggable={isDragMode}
              onDragStart={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === view.id,
                      );
                      handleDragStart(e, itemIndex);
                    }
                  : undefined
              }
              onDragOver={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === view.id,
                      );
                      handleDragOver(e, itemIndex);
                    }
                  : undefined
              }
              onDragLeave={isDragMode ? handleDragLeave : undefined}
              onDrop={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === view.id,
                      );
                      handleDrop(e, itemIndex);
                    }
                  : undefined
              }
              onDragEnd={isDragMode ? handleDragEnd : undefined}
              className={
                isDragMode
                  ? `cursor-grab active:cursor-grabbing transition-all duration-150
                    ${draggedItem !== null && draggedItemIdRef.current === view.id ? "opacity-50" : ""}
`
                  : ""
              }
            >
              <WithActive to={href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full pr-2"
                  >
                    <Link
                      to={href}
                      className="group/item relative"
                      onClick={(e) => {
                        if (isDragMode) {
                          e.preventDefault();
                          return;
                        }
                        trackEvent("sidebar_navigation_click", {
                          item: displayTitle,
                        });
                        isMobile && toggleSidebar();
                      }}
                    >
                      {isDragMode && (
                        <Icon
                          name="drag_indicator"
                          size={16}
                          className="text-muted-foreground/50 shrink-0"
                        />
                      )}
                      <Icon
                        name={view.icon}
                        size={20}
                        className="text-muted-foreground/75 shrink-0"
                      />
                      <span className="truncate flex-1 min-w-0 group-hover/item:pr-8">
                        {displayTitle}
                      </span>
                      {view.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {view.badge}
                        </Badge>
                      )}
                      <Icon
                        name="push_pin"
                        size={18}
                        className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          _unpinNativeView(view.id);
                          trackEvent("sidebar_unpin_native_view", {
                            view: displayTitle,
                          });
                        }}
                      />
                    </Link>
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          );
        })}

      {/* OLD: Views from integrations - now handled by unified rendering above */}
      {false &&
        Object.entries(fromIntegration).map(([integrationId, views]) => {
          const integration = integrationMap.get(integrationId);
          const isSingleView = views.length === 1;

          if (isSingleView) {
            const [view] = views;
            const href = buildViewHrefFromView(view as View);

            return (
              <SidebarMenuItem
                key={integrationId}
                draggable={isDragMode}
                onDragStart={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) => i.id === `integration:::${integrationId}`,
                        );
                        handleDragStart(e, itemIndex);
                      }
                    : undefined
                }
                onDragOver={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) => i.id === `integration:::${integrationId}`,
                        );
                        handleDragOver(e, itemIndex);
                      }
                    : undefined
                }
                onDragLeave={isDragMode ? handleDragLeave : undefined}
                onDrop={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) => i.id === `integration:::${integrationId}`,
                        );
                        handleDrop(e, itemIndex);
                      }
                    : undefined
                }
                onDragEnd={isDragMode ? handleDragEnd : undefined}
                className={
                  isDragMode
                    ? `cursor-grab active:cursor-grabbing transition-all duration-150
                      ${draggedItem !== null && draggedItemIdRef.current === `integration:::${integrationId}` ? "opacity-50" : ""}
`
                    : ""
                }
              >
                <WithActive to={href}>
                  {({ isActive }) => (
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="w-full pr-2"
                    >
                      <Link
                        to={href}
                        className="group/item relative"
                        onClick={(e) => {
                          if (isDragMode) {
                            e.preventDefault();
                            return;
                          }
                          trackEvent("sidebar_navigation_click", {
                            item: view.title,
                          });
                          isMobile && toggleSidebar();
                        }}
                      >
                        {isDragMode && (
                          <Icon
                            name="drag_indicator"
                            size={16}
                            className="text-muted-foreground shrink-0"
                          />
                        )}
                        <div className="relative">
                          <IntegrationAvatar
                            size="xs"
                            url={integration?.icon}
                            fallback={integration?.name}
                            className="!w-[22px] !h-[22px] !rounded-md"
                          />
                          {integration && integrationId !== "custom" && (
                            <SidebarMenuAction
                              asChild
                              className="absolute inset-0 hidden items-center justify-center rounded-md border border-border/80 bg-background/95 shadow-sm transition-opacity group-hover/item:flex"
                              onClick={(event) => {
                                event.preventDefault();
                                event.stopPropagation();
                                setAddViewsDialogState({
                                  open: true,
                                  integration,
                                });
                              }}
                              aria-label={`Add view to ${
                                integration?.name ?? "integration"
                              }`}
                              showOnHover
                            >
                              <span
                                role="button"
                                tabIndex={0}
                                className="flex h-full w-full items-center justify-center"
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "Enter" ||
                                    event.key === " "
                                  ) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setAddViewsDialogState({
                                      open: true,
                                      integration,
                                    });
                                  }
                                }}
                              >
                                <Icon
                                  name="add"
                                  size={14}
                                  className="text-muted-foreground"
                                />
                              </span>
                            </SidebarMenuAction>
                          )}
                        </div>
                        <span
                          className={
                            view.type === "custom"
                              ? "truncate group-hover/item:pr-8"
                              : "truncate"
                          }
                        >
                          {view.title ?? integration?.name ?? "Custom"}
                        </span>
                        {view.type === "custom" && (
                          <Icon
                            name="push_pin"
                            size={18}
                            className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              handleRemoveView(view);
                            }}
                          />
                        )}
                      </Link>
                    </SidebarMenuButton>
                  )}
                </WithActive>
              </SidebarMenuItem>
            );
          }

          return (
            <SidebarMenuItem
              key={integrationId}
              draggable={isDragMode}
              onDragStart={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === `integration:::${integrationId}`,
                      );
                      handleDragStart(e, itemIndex);
                    }
                  : undefined
              }
              onDragOver={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === `integration:::${integrationId}`,
                      );
                      handleDragOver(e, itemIndex);
                    }
                  : undefined
              }
              onDragLeave={isDragMode ? handleDragLeave : undefined}
              onDrop={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === `integration:::${integrationId}`,
                      );
                      handleDrop(e, itemIndex);
                    }
                  : undefined
              }
              onDragEnd={isDragMode ? handleDragEnd : undefined}
              className={
                isDragMode
                  ? `cursor-grab active:cursor-grabbing transition-all duration-150
                   ${draggedItem !== null && draggedItemIdRef.current === `integration:::${integrationId}` ? "opacity-50" : ""}`
                  : ""
              }
            >
              <Collapsible
                asChild
                defaultOpen={false}
                className="group/collapsible"
              >
                <div className="group/integration-header relative">
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton className="w-full pr-2">
                      {isDragMode && (
                        <Icon
                          name="drag_indicator"
                          size={16}
                          className="text-muted-foreground/50 shrink-0"
                        />
                      )}
                      <div className="relative">
                        <IntegrationAvatar
                          size="xs"
                          url={integration?.icon}
                          fallback={integration?.name}
                          className="!w-[22px] !h-[22px] !rounded-md"
                        />
                        {integration && integrationId !== "custom" && (
                          <SidebarMenuAction
                            asChild
                            className="absolute inset-0 hidden items-center justify-center rounded-md border border-border/80 bg-background/95 shadow-sm transition-opacity group-hover/integration-header:flex"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              setAddViewsDialogState({
                                open: true,
                                integration,
                              });
                            }}
                            aria-label={`Add view to ${
                              integration?.name ?? "integration"
                            }`}
                            showOnHover
                          >
                            <span
                              role="button"
                              tabIndex={0}
                              className="flex h-full w-full items-center justify-center"
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  setAddViewsDialogState({
                                    open: true,
                                    integration,
                                  });
                                }
                              }}
                            >
                              <Icon
                                name="add"
                                size={14}
                                className="text-muted-foreground"
                              />
                            </span>
                          </SidebarMenuAction>
                        )}
                      </div>
                      <span className="truncate">
                        {integration?.name ?? "Custom"}
                      </span>
                      <Icon
                        name="chevron_right"
                        size={18}
                        className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                      />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {views.map((view: View) => {
                        const href = buildViewHrefFromView(view as View);

                        return (
                          <SidebarMenuSubItem key={view.id}>
                            <SidebarMenuSubButton asChild>
                              <Link
                                to={href}
                                className="group/item relative"
                                onClick={(e) => {
                                  trackEvent("sidebar_navigation_click", {
                                    item: view.title,
                                  });
                                  isMobile && toggleSidebar();
                                }}
                              >
                                <Icon
                                  name={view.icon}
                                  size={18}
                                  className="text-muted-foreground/75"
                                />
                                <span
                                  className={
                                    view.type === "custom"
                                      ? "truncate group-hover/item:pr-8"
                                      : "truncate"
                                  }
                                >
                                  {view.title}
                                </span>
                                {view.type === "custom" && (
                                  <Icon
                                    name="push_pin"
                                    size={18}
                                    className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleRemoveView(view);
                                    }}
                                  />
                                )}
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </SidebarMenuItem>
          );
        })}

      {/* OLD: Resources from integrations - now handled by unified rendering above */}
      {false &&
        Object.entries(fromIntegrationResources).map(
          ([integrationId, resources]) => {
            const integration = integrationMap.get(integrationId);
            const isSingleResource = resources.length === 1;

            if (isSingleResource) {
              const [resource] = resources;
              const href = buildResourceHrefFromResource(resource);

              return (
                <SidebarMenuItem
                  key={`resource-${integrationId}`}
                  draggable={isDragMode}
                  onDragStart={
                    isDragMode
                      ? (e) => {
                          const itemIndex = allPinnedItems.findIndex(
                            (i) =>
                              i.id ===
                              `integration-resource:::${integrationId}`,
                          );
                          handleDragStart(e, itemIndex);
                        }
                      : undefined
                  }
                  onDragOver={
                    isDragMode
                      ? (e) => {
                          const itemIndex = allPinnedItems.findIndex(
                            (i) =>
                              i.id ===
                              `integration-resource:::${integrationId}`,
                          );
                          handleDragOver(e, itemIndex);
                        }
                      : undefined
                  }
                  onDragLeave={isDragMode ? handleDragLeave : undefined}
                  onDrop={
                    isDragMode
                      ? (e) => {
                          const itemIndex = allPinnedItems.findIndex(
                            (i) =>
                              i.id ===
                              `integration-resource:::${integrationId}`,
                          );
                          handleDrop(e, itemIndex);
                        }
                      : undefined
                  }
                  onDragEnd={isDragMode ? handleDragEnd : undefined}
                  className={
                    isDragMode
                      ? `cursor-grab active:cursor-grabbing transition-all duration-150
                        ${draggedItem !== null && draggedItemIdRef.current === `integration-resource:::${integrationId}` ? "opacity-50" : ""}
`
                      : ""
                  }
                >
                  <WithActive to={href}>
                    {({ isActive }) => (
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className="w-full pr-8"
                      >
                        <Link
                          to={href}
                          className="group/item relative"
                          onClick={(e) => {
                            if (isDragMode) {
                              e.preventDefault();
                              return;
                            }
                            // Reload if already on current page (client-side)
                            if (location.pathname === href) {
                              e.preventDefault();
                              navigate(0);
                              return;
                            }

                            trackEvent("sidebar_navigation_click", {
                              item: resource.title,
                            });
                            isMobile && toggleSidebar();
                          }}
                        >
                          {isDragMode && (
                            <Icon
                              name="drag_indicator"
                              size={16}
                              className="text-muted-foreground/50 shrink-0"
                            />
                          )}
                          <div className="relative">
                            <IntegrationAvatar
                              size="xs"
                              url={integration?.icon}
                              fallback={integration?.name}
                              className="!w-[18px] !h-[18px] !rounded-md"
                            />
                          </div>
                          <span className="truncate group-hover/item:pr-8">
                            {resource.title ?? integration?.name ?? "Resource"}
                          </span>
                          <Icon
                            name="remove"
                            size={18}
                            className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleRemoveResource({ resourceId: resource.id });
                            }}
                          />
                        </Link>
                      </SidebarMenuButton>
                    )}
                  </WithActive>
                </SidebarMenuItem>
              );
            }

            return (
              <SidebarMenuItem
                key={`resource-${integrationId}`}
                draggable={isDragMode}
                onDragStart={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) =>
                            i.id === `integration-resource:::${integrationId}`,
                        );
                        handleDragStart(e, itemIndex);
                      }
                    : undefined
                }
                onDragOver={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) =>
                            i.id === `integration-resource:::${integrationId}`,
                        );
                        handleDragOver(e, itemIndex);
                      }
                    : undefined
                }
                onDragLeave={isDragMode ? handleDragLeave : undefined}
                onDrop={
                  isDragMode
                    ? (e) => {
                        const itemIndex = allPinnedItems.findIndex(
                          (i) =>
                            i.id === `integration-resource:::${integrationId}`,
                        );
                        handleDrop(e, itemIndex);
                      }
                    : undefined
                }
                onDragEnd={isDragMode ? handleDragEnd : undefined}
                className={
                  isDragMode
                    ? `cursor-grab active:cursor-grabbing transition-all duration-150
                     ${draggedItem !== null && draggedItemIdRef.current === `integration-resource:::${integrationId}` ? "opacity-50" : ""}`
                    : ""
                }
              >
                <Collapsible
                  asChild
                  defaultOpen={false}
                  className="group/collapsible"
                >
                  <div className="group/integration-header relative">
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        className="w-full pr-8"
                        onClick={(e) => {
                          if (isDragMode) {
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        }}
                      >
                        {isDragMode && (
                          <Icon
                            name="drag_indicator"
                            size={16}
                            className="text-muted-foreground shrink-0"
                          />
                        )}
                        <div className="relative">
                          <IntegrationAvatar
                            size="xs"
                            url={integration?.icon}
                            fallback={integration?.name}
                            className="!w-[18px] !h-[18px] !rounded-md"
                          />
                        </div>
                        <span className="truncate">
                          {integration?.name ?? "Resources"}
                        </span>
                        <Icon
                          name="chevron_right"
                          size={18}
                          className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                        />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {resources.map((resource) => {
                          const href = buildResourceHrefFromResource(resource);

                          return (
                            <SidebarMenuSubItem key={resource.id}>
                              <SidebarMenuSubButton asChild>
                                <Link
                                  to={href}
                                  className="group/item relative"
                                  onClick={() => {
                                    trackEvent("sidebar_navigation_click", {
                                      item: resource.title,
                                    });
                                    isMobile && toggleSidebar();
                                  }}
                                >
                                  <Icon
                                    name="folder"
                                    size={18}
                                    className="text-muted-foreground/75"
                                  />
                                  <span className="truncate group-hover/item:pr-8">
                                    {resource.title}
                                  </span>
                                  <Icon
                                    name="remove"
                                    size={18}
                                    className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleRemoveResource({
                                        resourceId: resource.id,
                                      });
                                    }}
                                  />
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              </SidebarMenuItem>
            );
          },
        )}

      {/* OLD: Pinned Resource Instances - now handled by unified rendering above */}
      {false && _pinnedResources.length > 0 && (
        <>
          {_pinnedResources.map((resource, _index) => (
            <SidebarMenuItem
              key={`pinned-${resource.id}`}
              draggable={isDragMode}
              onDragStart={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === `pinned:::${resource.id}`,
                      );
                      handleDragStart(e, itemIndex);
                    }
                  : undefined
              }
              onDragOver={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === `pinned:::${resource.id}`,
                      );
                      handleDragOver(e, itemIndex);
                    }
                  : undefined
              }
              onDragLeave={isDragMode ? handleDragLeave : undefined}
              onDrop={
                isDragMode
                  ? (e) => {
                      const itemIndex = allPinnedItems.findIndex(
                        (i) => i.id === `pinned:::${resource.id}`,
                      );
                      handleDrop(e, itemIndex);
                    }
                  : undefined
              }
              onDragEnd={isDragMode ? handleDragEnd : undefined}
              className={
                isDragMode
                  ? `cursor-grab active:cursor-grabbing transition-all duration-150
                      ${draggedItem !== null && draggedItemIdRef.current === `pinned:::${resource.id}` ? "opacity-50" : ""}
`
                  : ""
              }
            >
              <WithActive to={resource.path}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild={!isDragMode}
                    isActive={isActive}
                    className="w-full pr-2"
                  >
                    {isDragMode ? (
                      <div className="group/item relative flex items-center gap-2">
                        <Icon
                          name="drag_indicator"
                          size={16}
                          className="text-muted-foreground shrink-0"
                        />
                        {resource.type === "agent" ? (
                          <AgentAvatar
                            size="xs"
                            url={resource.icon}
                            fallback={resource.name}
                            className="!w-[20px] !h-[20px] shrink-0"
                          />
                        ) : resource.icon ? (
                          <Icon
                            name={resource.icon}
                            size={20}
                            className="text-muted-foreground/75 shrink-0"
                          />
                        ) : null}
                        <span className="truncate flex-1 min-w-0">
                          {resource.name}
                        </span>
                      </div>
                    ) : (
                      <Link
                        to={resource.path}
                        className="group/item relative"
                        onClick={(e) => {
                          trackEvent("sidebar_navigation_click", {
                            item: resource.name,
                            type: "pinned-resource",
                          });
                          isMobile && toggleSidebar();
                        }}
                      >
                        {resource.type === "agent" ? (
                          <AgentAvatar
                            size="xs"
                            url={resource.icon}
                            fallback={resource.name}
                            className="!w-[20px] !h-[20px] shrink-0"
                          />
                        ) : resource.icon ? (
                          <Icon
                            name={resource.icon}
                            size={20}
                            className="text-muted-foreground/75 shrink-0"
                          />
                        ) : null}
                        <span className="truncate flex-1 min-w-0 group-hover/item:pr-8">
                          {resource.name}
                        </span>
                        <Icon
                          name="push_pin"
                          size={18}
                          className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            _togglePin(resource);
                          }}
                        />
                      </Link>
                    )}
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          ))}
        </>
      )}

      <SidebarSeparator className="my-2 -ml-1" />

      <SidebarMenuItem>
        <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
          Recents
        </div>
      </SidebarMenuItem>

      {/* Recent Resource Instances */}
      {_displayedRecents.length > 0 && (
        <>
          {_displayedRecents.map((resource) => (
            <SidebarMenuItem key={`recent-${resource.id}`}>
              <WithActive to={resource.path}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full pr-2"
                  >
                    <Link
                      to={resource.path}
                      className="group/item relative"
                      onClick={(e) => {
                        trackEvent("sidebar_navigation_click", {
                          item: resource.name,
                          type: "recent-resource",
                        });
                        isMobile && toggleSidebar();
                      }}
                    >
                      {resource.type === "agent" ? (
                        <AgentAvatar
                          size="xs"
                          url={resource.icon}
                          fallback={resource.name}
                          className="!w-[20px] !h-[20px] shrink-0"
                        />
                      ) : resource.icon ? (
                        <Icon
                          name={resource.icon}
                          size={20}
                          className="text-muted-foreground/75 shrink-0"
                        />
                      ) : null}
                      <span className="truncate flex-1 min-w-0 group-hover/item:pr-10">
                        {resource.name}
                      </span>
                      <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <Icon
                          name="close"
                          size={18}
                          className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            _removeRecent(resource.id);
                          }}
                        />
                        <Icon
                          name="push_pin"
                          size={18}
                          className="text-muted-foreground opacity-0 group-hover/item:opacity-50 hover:opacity-100 cursor-pointer"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePinFromRecents(resource);
                          }}
                        />
                      </div>
                    </Link>
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          ))}

          {/* Show All / Show Less toggle */}
          {_hasMoreRecents && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                onClick={() => _setShowAllRecents(!_showAllRecents)}
              >
                <Icon
                  name={_showAllRecents ? "expand_less" : "expand_more"}
                  size={16}
                  className="text-muted-foreground/75"
                />
                <span>{_showAllRecents ? "Show less" : "Show all"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </>
      )}

      {/* Generate Modal */}
      <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create via AI</DialogTitle>
            <DialogDescription>Generate content with AI</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Document Creation - Split Button with Dropdown */}
            <div className="w-full flex items-stretch h-auto border border-border rounded-lg overflow-hidden hover:bg-accent/50 transition-colors">
              <Button
                variant="ghost"
                className="flex-1 justify-start h-auto py-4 rounded-none border-0 hover:bg-transparent"
                onClick={async () => {
                  setGenerateModalOpen(false);
                  isMobile && toggleSidebar();
                  const timestamp = new Date()
                    .toISOString()
                    .replace(/[:.]/g, "-");

                  const result = await upsertDocument.mutateAsync({
                    params: {
                      name: `Untitled-${timestamp}`,
                      content: "",
                      description: "",
                    },
                  });

                  const documentResource = {
                    integration_id: "i:documents-management",
                    name: "document",
                  };
                  const href = buildResourceHrefFromResource(documentResource);
                  navigate(`${href}/${encodeURIComponent(result.uri)}`);
                }}
              >
                <div className="flex items-center gap-3 text-left">
                  <Icon
                    name="docs"
                    size={24}
                    className="text-muted-foreground/75 mt-0.5"
                  />
                  <div className="flex-1">
                    <div className="font-semibold">Document</div>
                    <div className="text-sm text-muted-foreground">
                      Create a new document with AI assistance
                    </div>
                  </div>
                </div>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto rounded-none border-l border-border hover:bg-transparent w-12 flex-shrink-0"
                  >
                    <Icon name="expand_more" size={20} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={async () => {
                      setGenerateModalOpen(false);
                      isMobile && toggleSidebar();
                      const timestamp = new Date()
                        .toISOString()
                        .replace(/[:.]/g, "-");

                      const result = await upsertDocument.mutateAsync({
                        params: {
                          name: `Untitled-${timestamp}`,
                          content: "",
                          description: "",
                        },
                      });

                      const documentResource = {
                        integration_id: "i:documents-management",
                        name: "document",
                      };
                      const href =
                        buildResourceHrefFromResource(documentResource);
                      navigate(`${href}/${encodeURIComponent(result.uri)}`);
                    }}
                  >
                    <Icon name="docs" size={18} className="mr-2" />
                    <div className="flex-1">
                      <div className="font-medium">Blank Document</div>
                      <div className="text-xs text-muted-foreground">
                        Start from scratch
                      </div>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer"
                    onSelect={async () => {
                      setGenerateModalOpen(false);
                      isMobile && toggleSidebar();
                      const timestamp = new Date()
                        .toISOString()
                        .replace(/[:.]/g, "-");

                      const result = await upsertDocument.mutateAsync({
                        params: {
                          name: `AI App PRD - ${timestamp}`,
                          content: AI_APP_PRD_TEMPLATE,
                          description:
                            "Product Requirements Document for an AI-native application on decocms.com platform. This document helps plan tools, agents, workflows, views, and databases.",
                        },
                      });

                      const documentResource = {
                        integration_id: "i:documents-management",
                        name: "document",
                      };
                      const href =
                        buildResourceHrefFromResource(documentResource);
                      navigate(`${href}/${encodeURIComponent(result.uri)}`);
                    }}
                  >
                    <Icon name="rocket_launch" size={18} className="mr-2" />
                    <div className="flex-1">
                      <div className="font-medium">AI App PRD</div>
                      <div className="text-xs text-muted-foreground">
                        Plan tools, agents & workflows
                      </div>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setGenerateModalOpen(false);
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon
                  name="flowchart"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Workflow</div>
                  <div className="text-sm text-muted-foreground">
                    Create a new workflow
                  </div>
                </div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={() => {
                setGenerateModalOpen(false);
                isMobile && toggleSidebar();

                handleCreateAgent();
              }}
            >
              <div className="flex items-center gap-3 text-left">
                <Icon
                  name="robot_2"
                  size={24}
                  className="text-muted-foreground/75 mt-0.5"
                />
                <div className="flex-1">
                  <div className="font-semibold">Agent</div>
                  <div className="text-sm text-muted-foreground">
                    Create an AI agent with specialized capabilities
                  </div>
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search Modal */}
      <SearchComingSoonModal
        open={_searchModalOpen}
        onOpenChange={_setSearchModalOpen}
      />

      {/* Files Modal */}
      <Dialog open={filesModalOpen} onOpenChange={setFilesModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>File System Access</DialogTitle>
            <DialogDescription>Coming soon to deco.cx</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
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

      {/* Database Modal */}
      <Dialog open={databaseModalOpen} onOpenChange={setDatabaseModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Database Management</DialogTitle>
            <DialogDescription>Coming soon to deco.cx</DialogDescription>
          </DialogHeader>
          <div className="py-6">
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center border border-primary/30">
                <Icon name="storage" size={32} className="text-primary" />
              </div>
            </div>
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Database management tools are coming soon. Manage your data with
                a powerful interface.
              </p>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Browse tables and collections</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Run queries and scripts</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Icon name="check_circle" size={16} className="text-primary" />
                <span>Manage data relationships</span>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {addViewsDialogState.integration && (
        <AddViewsDialog
          integration={addViewsDialogState.integration}
          open={addViewsDialogState.open}
          onOpenChange={(open) =>
            setAddViewsDialogState({
              open,
              integration: open ? addViewsDialogState.integration : undefined,
            })
          }
        />
      )}
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={commandPalette.onOpenChange}
      />
    </>
  );
}

WorkspaceViews.Skeleton = () => (
  <div className="flex flex-col gap-0.5">
    {Array.from({ length: 20 }).map((_, index) => (
      <div key={index} className="w-full h-8">
        <Skeleton className="h-full bg-sidebar-accent rounded-md" />
      </div>
    ))}
  </div>
);

// Coming Soon menu items are now inline in the new sidebar structure

export function ProjectSidebar() {
  return (
    <Sidebar variant="sidebar">
      <SidebarContent className="flex-1 overflow-x-hidden">
        <SidebarGroup className="font-medium">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              <Suspense fallback={<WorkspaceViews.Skeleton />}>
                <WorkspaceViews />
              </Suspense>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
