import {
  Thread,
  useAgents,
  useIntegrations,
  useInvites,
  useThreads,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
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
import { ReactNode, Suspense } from "react";
import { Link, useMatch } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import { useWorkspaceLink } from "../../hooks/useNavigateWorkspace.ts";
import { groupThreadsByDate } from "../threads/index.tsx";
import { SidebarFooter } from "./footer.tsx";
import { Header as SidebarHeader } from "./header.tsx";

const STATIC_ITEMS = [
  {
    url: "/",
    title: "New chat",
    icon: "forum",
  },
  {
    url: "/integrations",
    title: "Integrations",
    icon: "widgets",
  },
  {
    url: "/agents",
    title: "Agents",
    icon: "groups",
  },
  {
    url: "/triggers",
    title: "Triggers",
    icon: "conversion_path",
  },
];

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
  return `chat/${thread.metadata.agentId}/${thread.id}`;
}

function SidebarThreadList({ threads }: { threads: Thread[] }) {
  const handleThreadClick = (thread: Thread) => {
    trackEvent("sidebar_thread_click", {
      threadId: thread.id,
      threadTitle: thread.title,
      agentId: thread.metadata.agentId,
    });
  };

  return threads.map((thread) => (
    <SidebarMenuItem key={thread.id}>
      <WithActive to={buildThreadUrl(thread)}>
        {({ isActive }) => (
          <SidebarMenuButton
            asChild
            isActive={isActive}
            tooltip={thread.title}
            className="h-9"
          >
            <Link
              to={buildThreadUrl(thread)}
              onClick={() => handleThreadClick(thread)}
            >
              <span className="truncate">{thread.title}</span>
            </Link>
          </SidebarMenuButton>
        )}
      </WithActive>
    </SidebarMenuItem>
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
  const { data } = useThreads(user?.id ?? "");
  const groupedThreads = groupThreadsByDate(data?.threads ?? []);

  return (
    <>
      {groupedThreads.today.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Today</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              <SidebarThreadList threads={groupedThreads.today} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}

      {groupedThreads.yesterday.length > 0 && (
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarGroupLabel>Yesterday</SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
              <SidebarThreadList threads={groupedThreads.yesterday} />
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
                  <SidebarThreadList threads={threads} />
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
  return null;
}

function PrefetchAgents() {
  useAgents();
  return null;
}

function _InvitesLinkErrorFallback() {
  // Return null on error to ensure the sidebar doesn't break
  return null;
}

function InvitesLink() {
  const { data: invites = [] } = useInvites();
  const href = "/invites";
  const match = useMatch(href);

  console.log({ invites });
  // If no invites, don't show the link
  if (!invites.length) {
    return null;
  }

  const handleClick = () => {
    trackEvent("sidebar_navigation_click", {
      item: "Invites",
    });
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={!!match}
        tooltip="Invites"
        className="h-9 relative"
      >
        <Link to={href} onClick={handleClick}>
          <Icon name="mail" filled={!!match} />
          <span className="truncate">Invites</span>
          <span className="absolute right-2 top-1/2 -mt-2 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-medium text-white">
            {invites.length}
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const workspaceLink = useWorkspaceLink();

  const handleStaticItemClick = (title: string) => {
    trackEvent("sidebar_navigation_click", {
      item: title,
    });
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader />

      {/* Since the sidebar is rendered in the root layout, we prefetch common data here */}
      <Suspense fallback={null}>
        <PrefetchIntegrations />
        <PrefetchAgents />
      </Suspense>

      <SidebarContent className="flex flex-col h-full overflow-x-hidden">
        <div className="flex flex-col h-full">
          {/* Fixed section with static items */}
          <div className="flex-none">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
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
                              className="h-9"
                            >
                              <Link
                                to={href}
                                onClick={() =>
                                  handleStaticItemClick(item.title)}
                              >
                                <Icon name={item.icon} filled={isActive} />
                                <span className="truncate">{item.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          )}
                        </WithActive>
                      </SidebarMenuItem>
                    );
                  })}
                  <InvitesLink />
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>

          {/* Scrollable section with threads */}
          {!isCollapsed && (
            <>
              <SidebarSeparator />
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <Suspense fallback={<SidebarThreadsSkeleton />}>
                  <SidebarThreads />
                </Suspense>
              </div>
            </>
          )}

          {/* Footer with user info */}
          <div className="flex mt-auto items-start justify-start">
            <SidebarFooter />
          </div>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
