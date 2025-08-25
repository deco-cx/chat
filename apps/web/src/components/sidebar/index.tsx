import {
  type Agent,
  parseViewMetadata,
  type Thread,
  useAgents,
  useDeleteThread,
  useIntegrations,
  useRemoveView,
  useThreads,
  useUpdateThreadTitle,
  View,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
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
  SidebarSeparator,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, Suspense, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useMatch } from "react-router";
import { z } from "zod";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/use-user.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { groupThreadsByDate } from "../threads/index.tsx";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";
import { useCurrentTeam } from "./team-selector.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

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

function WorkspaceViews() {
  const workspaceLink = useWorkspaceLink();
  const { isMobile, toggleSidebar } = useSidebar();
  const { data: integrations } = useIntegrations();
  const team = useCurrentTeam();
  const removeViewMutation = useRemoveView();
  const handleRemoveView = async (view: View) => {
    await removeViewMutation.mutateAsync({
      viewId: view.id,
    });
  };

  const integrationMap = new Map(
    integrations?.map((integration) => [integration.id, integration]),
  );

  const fromIntegration: Record<string, View[]> = {};
  const firstLevelViews: View[] = [];

  // Group views by integration ID
  team.views.forEach((view) => {
    const metadata = view.metadata as { integration?: { id: string } };
    const integrationId = metadata?.integration?.id;

    if (integrationId) {
      if (!fromIntegration[integrationId]) {
        fromIntegration[integrationId] = [];
      }
      fromIntegration[integrationId].push(view);
    } else {
      if (view.type === "custom") {
        if (!fromIntegration["custom"]) {
          fromIntegration["custom"] = [];
        }
        fromIntegration["custom"].push(view);
        return;
      }
      firstLevelViews.push(view);
    }
  });

  // Separate items for organization
  const mcpItems = firstLevelViews.filter((item) =>
    ["Agents", "Integrations", "Prompts", "Views", "Workflows"].includes(
      item.title,
    ),
  );
  const otherItems = firstLevelViews.filter(
    (item) =>
      ![
        "Agents",
        "Integrations",
        "Prompts",
        "Views",
        "Workflows",
        "Triggers",
      ].includes(item.title),
  );

  return (
    <>
      {/* Regular items */}
      {otherItems.map((item) => {
        const meta = parseViewMetadata(item);
        if (!meta) {
          return null;
        }
        const href = workspaceLink(
          meta.type === "custom" ? `/views/${item.id}` : meta.path,
        );

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

                    {meta.type === "custom" && (
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

      {/* MCPs section */}
      {mcpItems.length > 0 && (
        <SidebarMenuItem>
          <Collapsible asChild defaultOpen className="group/collapsible">
            <div>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton className="w-full">
                  <Icon
                    name="apps"
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
                    const meta = parseViewMetadata(item);
                    if (!meta) return null;

                    // Special handling for Integrations -> Tools
                    const displayTitle =
                      item.title === "Integrations" ? "Tools" : item.title;
                    const href =
                      item.title === "Integrations"
                        ? workspaceLink("/connections")
                        : workspaceLink(
                            meta.type === "custom"
                              ? `/views/${item.id}`
                              : meta.path,
                          );

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
      {Object.entries(fromIntegration).map(([integrationId, views]) => {
        const integration = integrationMap.get(integrationId);
        return (
          <SidebarMenuItem key={integrationId}>
            <Collapsible asChild defaultOpen className="group/collapsible">
              <div>
                <CollapsibleTrigger asChild>
                  <SidebarMenuButton className="w-full">
                    <IntegrationAvatar
                      size="xs"
                      url={integration?.icon}
                      fallback={integration?.name}
                      className="!w-[18px] !h-[18px] !rounded-md"
                    />
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
                    {views.map((view) => {
                      const meta = parseViewMetadata(view);
                      if (!meta) return null;

                      const href = workspaceLink(
                        meta.type === "custom"
                          ? `/views/${view.id}`
                          : meta.path,
                      );

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
                              {meta.type === "custom" && (
                                <Icon
                                  name="unpin"
                                  size={18}
                                  className="text-muted-foreground/75 opacity-0 group-hover/item:opacity-50 hover:opacity-100 transition-opacity cursor-pointer ml-auto"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
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

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader />

      <SidebarContent className="flex flex-col h-full overflow-x-hidden">
        <div className="flex flex-col flex-1 min-h-0">
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

                  <Suspense fallback={<WorkspaceViews.Skeleton />}>
                    <WorkspaceViews />
                  </Suspense>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>

          {!isCollapsed && (
            <>
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <Suspense fallback={<SidebarThreads.Skeleton />}>
                  <SidebarThreads />
                </Suspense>
              </div>
            </>
          )}
        </div>

        <SidebarFooter />
      </SidebarContent>
    </Sidebar>
  );
}
