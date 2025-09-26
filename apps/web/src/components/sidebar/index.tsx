import {
  type Agent,
  findPinnedView,
  Integration,
  type Thread,
  useAgents,
  useConnectionViews,
  useDeleteThread,
  useIntegrations,
  useRemoveView,
  useRemoveResource,
  useThreads,
  useUpdateThreadTitle,
  View,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
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
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Form } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarMenuAction,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, Suspense, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useMatch } from "react-router";
import { z } from "zod";
import { trackEvent } from "../../hooks/analytics.ts";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { useUser } from "../../hooks/use-user.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { groupThreadsByDate } from "../threads/index.tsx";
import { TogglePin } from "../views/list.tsx";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";
import { useCurrentTeam } from "./team-selector.tsx";

const editTitleSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

type EditTitleForm = z.infer<typeof editTitleSchema>;

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

function buildThreadUrl(thread: Thread): string {
  return `agent/${thread.metadata?.agentId ?? ""}/${thread.id}`;
}

function DeleteThreadModal({
  thread,
  open,
  onOpenChange,
}: {
  thread: Thread;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deleteThread = useDeleteThread(thread.id);

  const handleDelete = async () => {
    try {
      await deleteThread.mutateAsync();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Thread</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete "{thread.title}"? This action cannot
            be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteThread.isPending}
          >
            {deleteThread.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ThreadActions({
  thread,
  onEdit,
  className,
}: {
  thread: Thread;
  onEdit: () => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const match = useMatch(buildThreadUrl(thread));
  const isCurrentThread = !!match;

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", className)}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <Icon
              name="more_vert"
              size={18}
              className="text-muted-foreground"
            />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              onEdit();
            }}
          >
            <Icon name="edit" className="mr-2" size={18} />
            Rename
          </DropdownMenuItem>
          {!isCurrentThread && (
            <DropdownMenuItem
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                setShowDeleteModal(true);
              }}
              className="text-destructive focus:text-destructive"
            >
              <Icon name="delete" className="mr-2" size={18} />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteThreadModal
        thread={thread}
        open={showDeleteModal}
        onOpenChange={setShowDeleteModal}
      />
    </>
  );
}

function SidebarThreadItem({
  thread,
  onThreadClick,
  agent,
}: {
  thread: Thread;
  agent?: Agent;
  onThreadClick: (thread: Thread) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const updateTitle = useUpdateThreadTitle();

  const methods = useForm<EditTitleForm>({
    resolver: zodResolver(editTitleSchema),
    defaultValues: {
      title: thread.title,
    },
  });

  function focusInput() {
    const input = formRef.current?.querySelector("input");
    input?.focus();
  }

  function handleBlur() {
    setIsEditing(false);
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = methods.getValues();

    if (data.title === thread.title) {
      setIsEditing(false);
      return;
    }

    try {
      updateTitle.mutateAsync({ threadId: thread.id, title: data.title });
      setIsEditing(false);
    } catch (_) {
      methods.setValue("title", thread.title);
      setIsEditing(false);
    }
  };

  return (
    <SidebarMenuItem key={thread.id} className="relative group/item">
      <div className="w-full">
        <WithActive to={buildThreadUrl(thread)}>
          {({ isActive }) => (
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={thread.title}
              className="h-9 w-full -ml-1 pr-8 gap-3"
            >
              {isEditing ? (
                <Form {...methods}>
                  <form
                    ref={formRef}
                    onSubmit={handleSubmit}
                    className="flex-1"
                  >
                    <Input
                      {...methods.register("title")}
                      className="h-8 text-sm w-5/6"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSubmit(e);
                        }
                      }}
                      onBlur={handleBlur}
                    />
                  </form>
                </Form>
              ) : (
                <Link
                  to={buildThreadUrl(thread)}
                  onClick={() => onThreadClick(thread)}
                >
                  <AgentAvatar
                    url={agent?.avatar}
                    fallback={agent?.name ?? WELL_KNOWN_AGENT_IDS.teamAgent}
                    size="xs"
                  />

                  <span className="truncate">{thread.title}</span>
                </Link>
              )}
            </SidebarMenuButton>
          )}
        </WithActive>
      </div>

      {!isEditing && (
        <ThreadActions
          thread={thread}
          className="absolute right-2 top-1/2 -translate-y-1/2 transition-all opacity-0 group-hover/item:opacity-100"
          onEdit={() => {
            setIsEditing(true);
            methods.setValue("title", thread.title);
            focusInput();
          }}
        />
      )}
    </SidebarMenuItem>
  );
}

function SidebarThreadList({
  threads,
  agents,
}: {
  threads: Thread[];
  agents: Agent[];
}) {
  const { isMobile, toggleSidebar } = useSidebar();

  const handleThreadClick = (thread: Thread) => {
    trackEvent("sidebar_thread_click", {
      threadId: thread.id,
      threadTitle: thread.title,
      agentId: thread.metadata?.agentId ?? "",
    });
    isMobile && toggleSidebar();
  };

  return threads.map((thread) => (
    <SidebarThreadItem
      key={thread.id}
      thread={thread}
      agent={agents.find((agent) => agent.id === thread.metadata?.agentId)}
      onThreadClick={handleThreadClick}
    />
  ));
}

function SidebarThreads() {
  const user = useUser();
  const { data: agents } = useAgents();
  const { data } = useThreads({
    resourceId: user?.id ?? "",
  });

  const groupedThreads = groupThreadsByDate(data?.threads ?? []);

  return (
    <>
      {groupedThreads.today.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Today</SidebarGroupLabel>
            <SidebarMenu className="gap-0">
              <SidebarThreadList
                threads={groupedThreads.today}
                agents={agents}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {groupedThreads.yesterday.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Yesterday</SidebarGroupLabel>
            <SidebarMenu className="gap-0">
              <SidebarThreadList
                threads={groupedThreads.yesterday}
                agents={agents}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {Object.entries(groupedThreads.older).length > 0
        ? Object.entries(groupedThreads.older).map(([date, threads]) => {
            return (
              <SidebarGroup key={date}>
                <SidebarGroupContent>
                  <SidebarGroupLabel>{date}</SidebarGroupLabel>
                  <SidebarMenu className="gap-0">
                    <SidebarThreadList threads={threads} agents={agents} />
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })
        : null}
    </>
  );
}

SidebarThreads.Skeleton = () => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: 20 }).map((_, index) => (
      <div key={index} className="w-full h-10 px-2">
        <Skeleton className="h-full bg-sidebar-accent rounded-sm" />
      </div>
    ))}
  </div>
);

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
  const workspaceLink = useWorkspaceLink();
  const { isMobile, toggleSidebar } = useSidebar();
  const { data: integrations } = useIntegrations();
  const team = useCurrentTeam();
  const removeViewMutation = useRemoveView();
  const navigateWorkspace = useNavigateWorkspace();
  const [addViewsDialogState, setAddViewsDialogState] = useState<{
    open: boolean;
    integration?: Integration;
  }>({ open: false });

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

  const { fromIntegration, firstLevelViews, fromIntegrationResources } = useMemo(() => {
    const result: {
      fromIntegration: Record<string, View[]>;
      firstLevelViews: View[];
      fromIntegrationResources: Record<string, any[]>;
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
    const resources = (team as any)?.resources ?? [];
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
  }, [team?.views, (team as any)?.resources, integrations]);

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

  function buildResourceHrefFromResource(resource: any): string {
    return workspaceLink(`/rsc/${resource.integration_id}/${resource.name}`);
  }

  // Separate items for organization
  const mcpItems = firstLevelViews.filter((item) =>
    ["Agents", "My Apps", "Prompts", "Views", "Workflows", "Triggers"].includes(
      item.title,
    ),
  );
  const otherItems = firstLevelViews.filter((item) =>
    ["Monitor"].includes(item.title),
  );

  return (
    <>
      {/* MCPs section */}
      {mcpItems.length > 0 && (
        <SidebarMenuItem>
          <Collapsible asChild defaultOpen className="group/collapsible">
            <div>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Icon
                    name="grid_view"
                    size={18}
                    className="text-muted-foreground/75"
                  />
                  <span className="truncate">MCPs</span>
                  <Icon
                    name="chevron_right"
                    size={18}
                    className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 text-muted-foreground/75"
                  />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {mcpItems.map((item) => {
                    const displayTitle = item.title;
                    const href = buildViewHrefFromView(item as View);

                    return (
                      <SidebarMenuSubItem key={item.title}>
                        <SidebarMenuSubButton asChild>
                          <Link
                            to={href}
                            onClick={() => {
                              trackEvent("sidebar_navigation_click", {
                                item: displayTitle,
                              });
                              isMobile && toggleSidebar();
                            }}
                          >
                            <Icon
                              name={item.icon}
                              size={18}
                              className="text-muted-foreground/75"
                            />
                            <span className="truncate">{displayTitle}</span>
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
      )}
      {/* Regular items */}
      {otherItems.map((item) => {
        const href = buildViewHrefFromView(item as View);

        return (
          <SidebarMenuItem key={item.title}>
            <WithActive to={href}>
              {({ isActive }) => (
                <SidebarMenuButton
                  asChild
                  isActive={isActive}
                  tooltip={item.title}
                >
                  <Link
                    to={href}
                    className="group/item"
                    onClick={() => {
                      trackEvent("sidebar_navigation_click", {
                        item: item.title,
                      });
                      isMobile && toggleSidebar();
                    }}
                  >
                    <Icon
                      name={item.icon}
                      filled={isActive}
                      size={18}
                      className="text-muted-foreground/75"
                    />
                    <span className="truncate">{item.title}</span>

                    {item.type === "custom" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-auto group-hover/item:block! hidden! p-0.5 h-6"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveView(item);
                        }}
                      >
                        <Icon
                          name="remove"
                          size={18}
                          className="text-muted-foreground ml-auto group-hover/item:block! hidden!"
                        />
                      </Button>
                    )}
                  </Link>
                </SidebarMenuButton>
              )}
            </WithActive>
          </SidebarMenuItem>
        );
      })}
      {Object.entries(fromIntegration).map(([integrationId, views]) => {
        const integration = integrationMap.get(integrationId);
        const isSingleView = views.length === 1;

        if (isSingleView) {
          const [view] = views;
          const href = buildViewHrefFromView(view as View);

          return (
            <SidebarMenuItem key={integrationId}>
              <WithActive to={href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full pr-8"
                  >
                    <Link
                      to={href}
                      className="group/item"
                      onClick={() => {
                        trackEvent("sidebar_navigation_click", {
                          item: view.title,
                        });
                        isMobile && toggleSidebar();
                      }}
                    >
                      <div className="relative">
                        <IntegrationAvatar
                          size="xs"
                          url={integration?.icon}
                          fallback={integration?.name}
                          className="!w-[18px] !h-[18px] !rounded-md"
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
                            aria-label={`Add view to ${integration?.name ?? "integration"}`}
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
                        {view.title ?? integration?.name ?? "Custom"}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          );
        }

        return (
          <SidebarMenuItem key={integrationId}>
            <Collapsible asChild defaultOpen className="group/collapsible">
              <div className="group/integration-header relative">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full pr-8">
                    <div className="relative">
                      <IntegrationAvatar
                        size="xs"
                        url={integration?.icon}
                        fallback={integration?.name}
                        className="!w-[18px] !h-[18px] !rounded-md"
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
                          aria-label={`Add view to ${integration?.name ?? "integration"}`}
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
                              className="group/item"
                              onClick={() => {
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
                              <span className="truncate">{view.title}</span>
                              {view.type === "custom" && (
                                <Icon
                                  name="unpin"
                                  size={18}
                                  className="text-muted-foreground/75 opacity-0 group-hover/item:opacity-50 hover:opacity-100 transition-opacity cursor-pointer ml-auto"
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

      {/* Resources section */}
      {Object.entries(fromIntegrationResources).map(([integrationId, resources]) => {
        const integration = integrationMap.get(integrationId);
        const isSingleResource = resources.length === 1;

        if (isSingleResource) {
          const [resource] = resources;
          const href = buildResourceHrefFromResource(resource);

          return (
            <SidebarMenuItem key={`resource-${integrationId}`}>
              <WithActive to={href}>
                {({ isActive }) => (
                  <SidebarMenuButton
                    asChild
                    isActive={isActive}
                    className="w-full pr-8"
                  >
                    <Link
                      to={href}
                      className="group/item"
                      onClick={() => {
                        trackEvent("sidebar_navigation_click", {
                          item: resource.title,
                        });
                        isMobile && toggleSidebar();
                      }}
                    >
                      <div className="relative">
                        <IntegrationAvatar
                          size="xs"
                          url={integration?.icon}
                          fallback={integration?.name}
                          className="!w-[18px] !h-[18px] !rounded-md"
                        />
                      </div>
                      <span className="truncate">
                        {resource.title ?? integration?.name ?? "Resource"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive ml-auto group-hover/item:block! hidden! p-0.5 h-6"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleRemoveResource({ resourceId: resource.id });
                        }}
                      >
                        <Icon
                          name="remove"
                          size={18}
                          className="text-muted-foreground ml-auto group-hover/item:block! hidden!"
                        />
                      </Button>
                    </Link>
                  </SidebarMenuButton>
                )}
              </WithActive>
            </SidebarMenuItem>
          );
        }

        return (
          <SidebarMenuItem key={`resource-${integrationId}`}>
            <Collapsible asChild defaultOpen className="group/collapsible">
              <div className="group/integration-header relative">
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full pr-8">
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
                              className="group/item"
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
                              <span className="truncate">{resource.title}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive ml-auto group-hover/item:block! hidden! p-0.5 h-6"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleRemoveResource({ resourceId: resource.id });
                                }}
                              >
                                <Icon
                                  name="remove"
                                  size={18}
                                  className="text-muted-foreground ml-auto group-hover/item:block! hidden!"
                                />
                              </Button>
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
    </>
  );
}

WorkspaceViews.Skeleton = () => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: 20 }).map((_, index) => (
      <div key={index} className="w-full h-10 px-2">
        <Skeleton className="h-full bg-sidebar-accent rounded-sm" />
      </div>
    ))}
  </div>
);

export function AppSidebar() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const focusChat = useFocusChat();
  const navigateWorkspace = useNavigateWorkspace();

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader />

      <SidebarContent className="flex h-full flex-col overflow-hidden">
        <div className="flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden">
          <div className="flex-none">
            <SidebarGroup className="font-medium">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      onClick={() => {
                        focusChat(
                          WELL_KNOWN_AGENT_IDS.teamAgent,
                          crypto.randomUUID(),
                          { history: false },
                        );
                        isMobile && toggleSidebar();
                      }}
                    >
                      <Icon
                        name="edit_square"
                        size={18}
                        className="text-muted-foreground/75"
                      />
                      <span className="truncate">New chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      className="cursor-pointer"
                      onClick={() => {
                        navigateWorkspace("/discover");
                      }}
                    >
                      <Icon
                        name="storefront"
                        size={18}
                        className="text-muted-foreground/75"
                      />
                      <span className="truncate">Discover</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  <Suspense fallback={<WorkspaceViews.Skeleton />}>
                    <WorkspaceViews />
                  </Suspense>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>

          {!isCollapsed && (
            <div className="mt-4 flex-none">
              <Suspense fallback={<SidebarThreads.Skeleton />}>
                <SidebarThreads />
              </Suspense>
            </div>
          )}
        </div>

        <SidebarFooter />
      </SidebarContent>
    </Sidebar>
  );
}
