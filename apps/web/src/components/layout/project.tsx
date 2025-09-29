import { Locator, SDKProvider } from "@deco/sdk";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@deco/ui/components/breadcrumb.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@deco/ui/components/resizable.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { Fragment, type ReactNode, Suspense, useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useUser } from "../../hooks/use-user.ts";
import RegisterActivity from "../common/register-activity.tsx";
import { ProfileModalProvider, useProfileModal } from "../profile-modal.tsx";
import { ProjectSidebar } from "../sidebar/index.tsx";
import { WithWorkspaceTheme } from "../theme.tsx";
import { TopbarLayout } from "./home.tsx";
import { BreadcrumbOrgSwitcher } from "./org-project-switcher.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";

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

export function useDecopilotOpen() {
  const { value: open, update: setOpen } = useLocalStorage({
    key: "deco-cms-decopilot",
    defaultValue: false,
  });

  const toggle = () => {
    setOpen(!open);
  };

  return {
    open,
    setOpen,
    toggle,
  };
}

export function ProjectLayout() {
  const { value: defaultSidebarOpen, update: setDefaultSidebarOpen } =
    useLocalStorage({
      key: "deco-chat-sidebar",
      defaultValue: true,
    });
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);

  const { open: decopilotOpen } = useDecopilotOpen();

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
                    link: `/${org}`,
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
                  <SidebarInset className="h-full flex-col bg-sidebar">
                    <ResizablePanelGroup direction="horizontal">
                      <ResizablePanel>
                        {/* Topbar height is 48px */}
                        <ScrollArea className="h-[calc(100vh-48px)]">
                          <Suspense
                            fallback={
                              <div className="h-[calc(100vh-48px)] grid place-items-center">
                                <Spinner />
                              </div>
                            }
                          >
                            <Outlet />
                          </Suspense>
                        </ScrollArea>
                      </ResizablePanel>
                      {decopilotOpen && (
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
      </WithWorkspaceTheme>
    </BaseRouteLayout>
  );
}

// // Listen for toggle decopilot events
// useEffect(() => {
//   const handleToggleDecopilot = () => {
//     if (!dockApi) {
//       return;
//     }

//     const isNowOpen = toggleDecopilotTab(dockApi);

//     // Update user preference based on the action being taken
//     // If we're opening the tab, set preference to true
//     // If we're closing the tab, set preference to false
//     setPreferences({
//       ...preferences,
//       showDecopilot: isNowOpen,
//     });
//   };

//   globalThis.addEventListener("toggle-decopilot", handleToggleDecopilot);

//   return () => {
//     globalThis.removeEventListener("toggle-decopilot", handleToggleDecopilot);
//   };
// }, [dockApi, preferences, setPreferences]);

const useIsProjectContext = () => {
  const { org, project } = useParams();
  return !!org && !!project;
};

export const ToggleDecopilotButton = () => {
  const isProjectContext = useIsProjectContext();
  const { toggle } = useDecopilotOpen();

  if (!isProjectContext) {
    return null;
  }

  return (
    <Button size="sm" variant="special" onClick={toggle}>
      <img src="/img/logo-tiny.svg" alt="Deco logo" className="w-4 h-4" />
      Chat
    </Button>
  );
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
              <BreadcrumbPage className="inline-flex items-center gap-2">
                {items.at(-1)?.label}
              </BreadcrumbPage>
            </BreadcrumbItem>
          ) : (
            items?.map((item, index) => {
              const isLast = index === items.length - 1;
              const link = useWorkspaceLinkProp
                ? withWorkspace(item.link ?? "")
                : (item.link ?? "");

              if (isLast) {
                return (
                  <BreadcrumbItem key={`last-${item.link || index}`}>
                    <BreadcrumbPage className="inline-flex items-center gap-2">
                      {item.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                );
              }

              return (
                <Fragment key={`${item.link}-${index}`}>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      asChild
                      href={link}
                      className="inline-flex items-center gap-2"
                    >
                      <Link to={link}>{item.label}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              );
            })
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
