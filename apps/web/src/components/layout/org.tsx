import { Locator, SDKProvider } from "@deco/sdk";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import {
  SidebarInset,
  SidebarLayout,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { type ReactNode, Suspense, useState } from "react";
import { Outlet, useLocation, useParams } from "react-router";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useUser } from "../../hooks/use-user.ts";
import { MainChatSkeleton } from "../agent/chat.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";
import { ThreadContextProvider } from "../decopilot/thread-context-provider.tsx";
import { DecopilotThreadProvider } from "../decopilot/thread-context.tsx";
import { ThreadManagerProvider } from "../decopilot/thread-manager-context.tsx";
import { ProfileModalProvider, useProfileModal } from "../profile-modal.tsx";
import { WithWorkspaceTheme } from "../theme.tsx";
import { useDecopilotOpen } from "./decopilot-layout.tsx";
import { TopbarLayout } from "./home.tsx";
import { BreadcrumbOrgSwitcher } from "./org-project-switcher.tsx";
import { OrgsSidebar } from "../sidebar/orgs.tsx";

export function BaseRouteLayout({ children }: { children: ReactNode }) {
  // remove?
  useUser();
  const { org } = useParams();

  if (!org) {
    throw new Error("No organization or project found");
  }

  return (
    <SDKProvider locator={Locator.from({ org, project: "default" })}>
      {children}
      <Toaster
        position="bottom-left"
        toastOptions={{
          className: "max-w-sm text-sm",
          style: {
            padding: "12px 16px",
          },
        }}
      />
    </SDKProvider>
  );
}

// TODO: Register activity for org so we can order them by latest accessed later
export function OrgsLayout() {
  const { value: defaultSidebarOpen, update: setDefaultSidebarOpen } =
    useLocalStorage({
      key: "deco-chat-sidebar",
      defaultValue: true,
    });
  const [sidebarOpen, setSidebarOpen] = useState(defaultSidebarOpen);
  const { open: decopilotOpen } = useDecopilotOpen();
  const location = useLocation();

  // Only show chat on theme editor page
  const isThemeEditorPage = location.pathname.endsWith("/theme-editor");

  const { org } = useParams();

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
          <ThreadContextProvider>
            <DecopilotThreadProvider>
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
                            <Suspense
                              fallback={<BreadcrumbOrgSwitcher.Skeleton />}
                            >
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
                        <OrgsSidebar />
                        <SidebarInset className="h-[calc(100vh-48px)] flex-col bg-sidebar">
                          <ResizablePanelGroup direction="horizontal">
                            <ResizablePanel className="bg-background">
                              {/* Topbar height is 48px */}
                              <ScrollArea className="h-[calc(100vh-48px)]">
                                <Suspense
                                  fallback={
                                    <div className="h-[calc(100vh-48px)] w-full grid place-items-center">
                                      <Spinner />
                                    </div>
                                  }
                                >
                                  <Outlet />
                                </Suspense>
                              </ScrollArea>
                            </ResizablePanel>
                            {decopilotOpen && isThemeEditorPage && (
                              <>
                                <ResizableHandle withHandle />
                                <ResizablePanel defaultSize={30}>
                                  <Suspense fallback={<MainChatSkeleton />}>
                                    <DecopilotChat />
                                  </Suspense>
                                </ResizablePanel>
                              </>
                            )}
                          </ResizablePanelGroup>
                        </SidebarInset>
                      </SidebarLayout>
                    </TopbarLayout>
                  </div>
                </SidebarProvider>
              </ProfileModalProvider>
            </DecopilotThreadProvider>
          </ThreadContextProvider>
        </ThreadManagerProvider>
      </WithWorkspaceTheme>
    </BaseRouteLayout>
  );
}
