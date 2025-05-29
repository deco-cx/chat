import {
  Agent,
  Thread,
  useAgents,
  useDeleteThread,
  useIntegrations,
  useMarketplaceIntegrations,
  useThreads,
  useUpdateThreadTitle,
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
  SidebarSeparator,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { ReactNode, Suspense, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useMatch } from "react-router";
import { z } from "zod";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import { useWorkspaceLink } from "../../hooks/useNavigateWorkspace.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { AgentAvatar } from "../common/Avatar.tsx";
import { groupThreadsByDate } from "../threads/index.tsx";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";

const STATIC_ITEMS = [
  {
    url: "/agents",
    title: "Agents",
    icon: "robot_2",
  },
  {
    url: "/integrations",
    title: "Integrations",
    icon: "widgets",
  },
  {
    url: "/triggers",
    title: "Triggers",
    icon: "conversion_path",
  },
  {
    url: "/audits",
    title: "Activity",
    icon: "forum",
  },
];

const editTitleSchema = z.object({
  title: z.string().min(1, "Title is required"),
});

type EditTitleForm = z.infer<typeof editTitleSchema>;

const WithActive = (
  { children, ...props }: {
    to: string;
    children: (props: { isActive: boolean }) => ReactNode;
  },
) => {
  const match = useMatch(props.to);

  return (
    <div {...props}>
      {children({ isActive: !!match })}
    </div>
  );
};

function buildThreadUrl(thread: Thread): string {
  return `agent/${thread.metadata?.agentId ?? ""}/${thread.id}`;
}

function DeleteThreadModal(
  { thread, open, onOpenChange }: {
    thread: Thread;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  },
) {
  const user = useUser();
  const deleteThread = useDeleteThread(thread.id, user?.id ?? "");

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
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
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

function ThreadActions({ thread, onEdit, className }: {
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
            <Icon name="more_vert" size={16} className="text-muted-foreground" />
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
            <Icon name="edit" className="mr-2" size={16} />
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
              className="text-red-500 focus:text-red-500"
            >
              <Icon name="delete" className="mr-2" size={16} />
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

function SidebarThreadItem(
  { thread, userId, onThreadClick, agent }: {
    thread: Thread;
    userId: string;
    agent?: Agent;
    onThreadClick: (thread: Thread) => void;
  },
) {
  const [isEditing, setIsEditing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const updateTitle: ReturnType<typeof useUpdateThreadTitle> =
    useUpdateThreadTitle(thread.id, userId);

  const methods = useForm<EditTitleForm>({
    resolver: zodResolver(editTitleSchema),
    defaultValues: {
      title: thread.title,
    },
  });

  // Focus the input when the thread is being edited
  useEffect(() => {
    if (isEditing) {
      const input = formRef.current?.querySelector("input");
      input?.focus();
    }
  }, [isEditing]);

  // Close the input when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isEditing && formRef.current &&
        !formRef.current.contains(event.target as Node)
      ) {
        setIsEditing(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEditing]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = methods.getValues();

    if (data.title === thread.title) {
      setIsEditing(false);
      return;
    }

    try {
      updateTitle.mutateAsync(data.title);
      setIsEditing(false);
    } catch (_) {
      methods.setValue("title", thread.title);
      setIsEditing(false);
    }
  };

  return (
    <SidebarMenuItem
      key={thread.id}
      className="relative group/item"
    >
      <div className="w-full">
        <WithActive to={buildThreadUrl(thread)}>
          {({ isActive }) => (
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={thread.title}
              className="h-9 w-full pr-8"
            >
              {isEditing
                ? (
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
                        onBlur={handleSubmit}
                      />
                    </form>
                  </Form>
                )
                : (
                  <Link
                    to={buildThreadUrl(thread)}
                    onClick={() => onThreadClick(thread)}
                  >
                    {agent
                      ? (
                        <AgentAvatar
                          name={agent.name}
                          avatar={agent.avatar}
                          className="h-4 w-4 rounded-sm"
                        />
                      )
                      : (
                        <div className="h-4 w-4 min-w-4 rounded-sm bg-[#2A9D90] flex items-center justify-center">
                          <Icon
                            name="edit_square"
                            className="text-white"
                            size={12}
                          />
                        </div>
                      )}
                    <span className="truncate">
                      {agent ? agent.name : thread.title}
                    </span>
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
          }}
        />
      )}
    </SidebarMenuItem>
  );
}

function SidebarThreadList(
  { threads, userId, agents }: {
    threads: Thread[];
    userId: string;
    agents: Agent[];
  },
) {
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
      userId={userId}
      onThreadClick={handleThreadClick}
    />
  ));
}

function SidebarThreadsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 20 }).map((_, index) => (
        <div key={index} className="w-full h-10 px-2">
          <Skeleton className="h-full bg-sidebar-accent rounded-sm" />
        </div>
      ))}
    </div>
  );
}

function SidebarThreads() {
  const user = useUser();
  const { data: agents } = useAgents();
  const { data } = useThreads({
    resourceId: user?.id ?? "",
    uniqueByAgentId: true,
  });
  const groupedThreads = groupThreadsByDate(data?.threads ?? []);

  return (
    <>
      {groupedThreads.today.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Today</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              <SidebarThreadList
                threads={groupedThreads.today}
                agents={agents}
                userId={user?.id ?? ""}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {groupedThreads.yesterday.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Yesterday</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              <SidebarThreadList
                threads={groupedThreads.yesterday}
                agents={agents}
                userId={user?.id ?? ""}
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
                <SidebarMenu className="gap-0.5">
                  <SidebarThreadList
                    threads={threads}
                    agents={agents}
                    userId={user?.id ?? ""}
                  />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })
        : null}
    </>
  );
}

function PrefetchIntegrations() {
  useIntegrations();
  useMarketplaceIntegrations();
  return null;
}

function PrefetchAgents() {
  useAgents();
  return null;
}

export function AppSidebar() {
  const { state, toggleSidebar, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const workspaceLink = useWorkspaceLink();
  const focusChat = useFocusChat();

  return (
    <Sidebar variant="sidebar">
      <SidebarHeader />

      <Suspense fallback={null}>
        <PrefetchIntegrations />
        <PrefetchAgents />
      </Suspense>

      <SidebarContent className="flex flex-col h-full overflow-x-hidden">
        <div className="flex flex-col h-full">
          <div className="flex-none">
            <SidebarGroup className="font-medium">
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
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
                      <Icon name="edit_square" size={16} className="text-muted-foreground" />
                      <span className="truncate">New chat</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {STATIC_ITEMS.map((item) => {
                    const href = workspaceLink(item.url);

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
                                  className="text-muted-foreground"
                                />
                                <span className="truncate">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          )}
                        </WithActive>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>

          {!isCollapsed && (
            <>
              <SidebarSeparator className="!w-[224px]" />
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <Suspense fallback={<SidebarThreadsSkeleton />}>
                  <SidebarThreads />
                </Suspense>
              </div>
            </>
          )}

          <SidebarFooter />
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
