import {
  Locator,
  SDKProvider,
  useAgentData,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@deco/ui/components/breadcrumb.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { ButtonGroup } from "@deco/ui/components/button-group.tsx";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { Fragment, Suspense, useState, type ReactNode } from "react";
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useParams,
} from "react-router";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useUser } from "../../hooks/use-user.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import RegisterActivity from "../common/register-activity.tsx";
import { DecopilotProvider } from "../decopilot/context.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";
import { DecopilotThreadProvider } from "../decopilot/thread-context.tsx";
import { ThreadManagerProvider } from "../decopilot/thread-manager-context.tsx";
import { ProfileModalProvider, useProfileModal } from "../profile-modal.tsx";
import { ProjectSidebar } from "../sidebar/index.tsx";
import { WithWorkspaceTheme } from "../theme.tsx";
import { useDecopilotOpen } from "./decopilot-layout.tsx";
import { TopbarLayout } from "./home.tsx";
import { BreadcrumbOrgSwitcher } from "./org-project-switcher.tsx";
import { BreadcrumbProjectSwitcher } from "./project-switcher.tsx";

export function BaseRouteLayout({ children }: { children: ReactNode }) {
  // remove?
  useUser();
  const { org, project } = useParams();

  if (!org || !project) {
    throw new Error("No organization or project found");
  }

  return (
    <SDKProvider locator={Locator.from({ org, project })}>
      {children}
      <Toaster />
    </SDKProvider>
  );
}

export function ProjectLayout() {
  const { value: defaultSidebarOpen, update: setDefaultSidebarOpen } =
    useLocalStorage({
      key: "deco-chat-sidebar",
      defaultValue: true,
    });
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const { open: decopilotOpen } = useDecopilotOpen();
  const location = useLocation();
  const isAgentDetailPage = location.pathname.match(/\/agent\/[^\/]+\/[^\/]+$/);

  const { org, project } = useParams();

  const {
    profileOpen,
    setProfileOpen,
    openProfileModal,
    closeProfileModal,
    handlePhoneSaved,
  } = useProfileModal();

  return (
    <BaseRouteLayout>
      <WithWorkspaceTheme>
        <ThreadManagerProvider>
          <DecopilotThreadProvider>
            <DecopilotProvider>
            <ProfileModalProvider
                profileOpen={profileOpen}
                setProfileOpen={setProfileOpen}
                openProfileModal={openProfileModal}
                closeProfileModal={closeProfileModal}
                handlePhoneSaved={handlePhoneSaved}
              >
              <SidebarProvider
                open={sidebarOpen}
                onOpenChange={(open) => {
                  setDefaultSidebarOpen(open);
                  setSidebarOpen(open);
                }}
              >
                <div className="flex flex-col h-full">
                  <TopbarLayout
                    breadcrumb={[
                      {
                        label: (
                          <Suspense fallback={<BreadcrumbOrgSwitcher.Skeleton />}>
                            <BreadcrumbOrgSwitcher />
                          </Suspense>
                        ),
                      },
                      {
                        label: (
                          <Suspense
                            fallback={<BreadcrumbProjectSwitcher.Skeleton />}
                          >
                            <BreadcrumbProjectSwitcher />
                          </Suspense>
                        ),
                        link: `/${org}/${project}`,
                      },
                    ]}
                  >
                    <SidebarLayout
                      className="h-full bg-sidebar"
                      style={
                        {
                          "--sidebar-width": "13rem",
                          "--sidebar-width-mobile": "11rem",
                        } as Record<string, string>
                      }
                    >
                      <ProjectSidebar />
                      <SidebarInset className="h-[calc(100vh-48px)] flex-col bg-sidebar">
                        <ResizablePanelGroup direction="horizontal">
                          <ResizablePanel>
                            <Suspense
                              fallback={
                                <div className="h-[calc(100vh-48px)] w-full grid place-items-center">
                                  <Spinner />
                                </div>
                              }
                            >
                              <Outlet />
                            </Suspense>
                          </ResizablePanel>
                          {/* Don't show DecopilotChat panel on agent detail pages - they handle chat mode switching internally */}
                          {decopilotOpen && !isAgentDetailPage && (
                            <>
                              <ResizableHandle withHandle />
                              <ResizablePanel defaultSize={30}>
                                <DecopilotChat />
                              </ResizablePanel>
                            </>
                          )}
                        </ResizablePanelGroup>
                      </SidebarInset>
                    </SidebarLayout>
                  </TopbarLayout>
                  <RegisterActivity orgSlug={org} projectSlug={project} />
                </div>
              </SidebarProvider>
            </ProfileModalProvider>
          </DecopilotProvider>
        </DecopilotThreadProvider>
      </ThreadManagerProvider>
      </WithWorkspaceTheme>
    </BaseRouteLayout>
  );
}

const useIsProjectContext = () => {
  const { org, project } = useParams();
  return !!org && !!project;
};

function AgentChatModeSwitch() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const searchParams = new URLSearchParams(location.search);

  // Get agent ID from URL params
  const agentId = params.id;

  // Early return if no agent ID
  if (!agentId) return null;

  const { data: agent } = useAgentData(agentId);

  // Get current chat mode from URL (default to 'agent')
  const currentMode =
    (searchParams.get("chat") as "agent" | "decopilot") || "agent";

  const handleModeChange = (mode: "agent" | "decopilot") => {
    const newParams = new URLSearchParams(location.search);
    newParams.set("chat", mode);
    navigate(`${location.pathname}?${newParams.toString()}`, { replace: true });
  };

  return (
    <ButtonGroup>
      <Button
        size="sm"
        variant={currentMode === "agent" ? "special" : "outline"}
        onClick={() => handleModeChange("agent")}
        className="flex items-center gap-1.5"
      >
        {agent && (
          <AgentAvatar
            className="rounded-sm border-none"
            url={agent.avatar}
            fallback={agent.name}
            size="2xs"
          />
        )}
        Agent
      </Button>
      <Button
        size="sm"
        variant={currentMode === "decopilot" ? "special" : "outline"}
        onClick={() => handleModeChange("decopilot")}
        className="flex items-center gap-1.5"
      >
        <AgentAvatar
          className="rounded-sm border-none"
          url={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
          fallback={
            <img src="/img/logo-tiny.svg" alt="Deco" className="w-4 h-4" />
          }
          size="2xs"
        />
        Chat
      </Button>
    </ButtonGroup>
  );
}

export const ToggleDecopilotButton = () => {
  const isProjectContext = useIsProjectContext();
  const { toggle } = useDecopilotOpen();

  if (!isProjectContext) {
    return null;
  }

  return (
    <Button size="sm" variant="special" onClick={toggle}>
      <AgentAvatar
        className="rounded-sm border-none"
        url={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
        fallback={
          <img src="/img/logo-tiny.svg" alt="Deco" className="w-4 h-4" />
        }
        size="2xs"
      />
      Chat
    </Button>
  );
};

export const TopbarControls = () => {
  const location = useLocation();
  const isProjectContext = useIsProjectContext();
  const isAgentDetailPage = location.pathname.match(/\/agent\/[^\/]+\/[^\/]+$/);

  if (!isProjectContext) {
    return null;
  }

  if (isAgentDetailPage) {
    // Show chat mode switch on agent detail pages
    return <AgentChatModeSwitch />;
  }

  // Show regular chat button on other pages
  return <ToggleDecopilotButton />;
};

interface BreadcrumbItem {
  label: string | ReactNode;
  link?: string;
}

export function DefaultBreadcrumb({
  items,
  useWorkspaceLink: useWorkspaceLinkProp = true,
}: {
  items: BreadcrumbItem[];
  useWorkspaceLink?: boolean;
}) {
  const isMobile = useIsMobile();
  const withWorkspace = useWorkspaceLink();
  return (
    <div className="flex items-center gap-3">
      <Breadcrumb>
        <BreadcrumbList>
          {isMobile ? (
            <BreadcrumbItem key={`mobile-${items.at(-1)?.link || "last"}`}>
              <BreadcrumbPage className="truncate">
                {items.at(-1)?.label}
              </BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            items?.map((item, index) => {
              const isLast = index === items.length - 1;
              const hasLink = Boolean(item.link);
              const link = hasLink
                ? useWorkspaceLinkProp
                  ? withWorkspace(item.link!)
                  : item.link!
                : "";

              if (isLast) {
                return (
                  <BreadcrumbItem
                    key={`last-${item.link || index}`}
                    className="min-w-0 flex-1"
                  >
                    <BreadcrumbPage className="truncate">
                      {item.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                );
              }

              if (!hasLink) {
                return (
                  <Fragment key={`${index}`}>
                    <BreadcrumbItem className="flex-shrink-0">
                      <span className="truncate">{item.label}</span>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="flex-shrink-0" />
                  </Fragment>
                );
              }

              return (
                <Fragment key={`${item.link}-${index}`}>
                  <BreadcrumbItem className="flex-shrink-0">
                    <BreadcrumbLink asChild href={link} className="truncate">
                      <Link to={link}>{item.label}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="flex-shrink-0 " />
                </Fragment>
              );
            })
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
