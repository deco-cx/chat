import { SDKProvider, type Workspace } from "@deco/sdk";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@deco/ui/components/breadcrumb.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@deco/ui/components/sidebar.tsx";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { DockviewReadyEvent } from "dockview-react";
import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link, Outlet, useParams } from "react-router";
import { useLocalStorage } from "../hooks/use-local-storage.ts";
import { useWorkspaceLink } from "../hooks/use-navigate-workspace.ts";
import { useUserPreferences } from "../hooks/use-user-preferences.ts";
import { useUser } from "../hooks/use-user.ts";
import RegisterActivity from "./common/register-activity.tsx";
import {
  DecopilotChat,
  DecopilotTabs,
  toggleDecopilotTab,
} from "./decopilot/index.tsx";
import Docked, { useDock, type Tab } from "./dock/index.tsx";
import { ProfileModalProvider, useProfileModal } from "./profile-modal.tsx";
import { AppSidebar } from "./sidebar/index.tsx";
import { WithWorkspaceTheme } from "./theme.tsx";

export function BaseRouteLayout({ children }: { children: ReactNode }) {
  const user = useUser();
  const { teamSlug } = useParams();

  const rootContext: Workspace = teamSlug
    ? `shared/${teamSlug}`
    : `users/${user?.id}`;

  return (
    <SDKProvider workspace={rootContext}>
      {children}
      <Toaster />
    </SDKProvider>
  );
}

export function RouteLayout() {
  const { value: defaultOpen, update: setDefaultOpen } = useLocalStorage({
    key: "deco-chat-sidebar",
    defaultValue: true,
  });
  const [open, setOpen] = useState(defaultOpen);
  const { teamSlug } = useParams();

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
            open={open}
            onOpenChange={(open) => {
              setDefaultOpen(open);
              setOpen(open);
            }}
            className="h-full bg-sidebar"
            style={
              {
                "--sidebar-width": "16rem",
                "--sidebar-width-mobile": "14rem",
              } as Record<string, string>
            }
          >
            <AppSidebar />
            <SidebarInset className="h-full flex-col bg-sidebar">
              <Outlet />
            </SidebarInset>
            <RegisterActivity teamSlug={teamSlug} />
          </SidebarProvider>
        </ProfileModalProvider>
      </WithWorkspaceTheme>
    </BaseRouteLayout>
  );
}

export interface PageLayoutProps {
  breadcrumb?: ReactNode;
  actionButtons?: ReactNode;
  tabs: Record<string, Tab>;
  hideViewsButton?: boolean;
}

const ToggleDecopilotButton = () => {
  const { api } = useDock();
  const { preferences, setPreferences } = useUserPreferences();

  const handleToggle = () => {
    if (!api) {
      return;
    }

    const isNowOpen = toggleDecopilotTab(api);

    // Update user preference based on the action being taken
    // If we're opening the tab, set preference to true
    // If we're closing the tab, set preference to false
    setPreferences({
      ...preferences,
      showDecopilot: isNowOpen,
    });
  };

  return (
    <Button size="icon" variant="ghost" onClick={handleToggle}>
      <Icon name="chat" className="text-muted-foreground" />
    </Button>
  );
};

export function PageLayout({
  breadcrumb,
  actionButtons,
  tabs,
  hideViewsButton,
}: PageLayoutProps) {
  const { toggleSidebar, open } = useSidebar();
  const { preferences } = useUserPreferences();
  const withDecopilot = useMemo(
    () => ({
      ...tabs,
      [DecopilotChat.displayName]: {
        title: "Decopilot Chat",
        Component: DecopilotChat,
      },
    }),
    [tabs],
  );

  const onReady = (event: DockviewReadyEvent) => {
    if (preferences.showDecopilot) {
      toggleDecopilotTab(event.api);
    }
  };

  return (
    <Docked.Provider tabs={withDecopilot}>
      <div className={cn("bg-sidebar", "grid grid-cols-3 md:grid-cols-2 px-0")}>
        <div className="p-2 md:p-0 md:hidden">
          <Button
            onClick={toggleSidebar}
            size="icon"
            variant="ghost"
            className={cn("p-1")}
          >
            <Icon name="menu" />
          </Button>
        </div>
        <div
          id="chat-header-start-slot"
          className={cn(
            "peer",
            "flex items-center gap-2",
            "mb-0 md:-mb-2 empty:mb-0",
            "min-h-14 empty:min-h-0",
            "justify-self-center md:justify-self-start",
          )}
        >
          {breadcrumb}
        </div>
        <div
          id="chat-header-end-slot"
          className={cn(
            "flex items-center gap-2",
            "mb-0 md:-mb-2 empty:mb-0",
            "min-h-14 empty:min-h-0",
            "justify-self-end",
          )}
        >
          {actionButtons}
          {preferences.enableDecopilot && <ToggleDecopilotButton />}
        </div>
        {!open && (
          <div className="peer-empty:flex items-center justify-center hidden fixed left-0 top-0 z-10 h-14 px-3">
            <Button
              onClick={toggleSidebar}
              size="icon"
              variant="ghost"
              className="p-1 size-8"
            >
              <Icon name="dock_to_right" className="text-muted-foreground" />
            </Button>
          </div>
        )}
      </div>
      <div className="h-full p-0 md:px-0">
        <Docked
          hideViewsButton={hideViewsButton}
          onReady={onReady}
          tabComponents={{
            [DecopilotTabs.displayName]: DecopilotTabs,
          }}
        />
      </div>
    </Docked.Provider>
  );
}

interface BreadcrumbItem {
  label: string | ReactNode;
  link?: string;
}

export function DefaultBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const { toggleSidebar, open, isMobile } = useSidebar();
  const withWorkspace = useWorkspaceLink();

  return (
    <div className="flex items-center gap-3">
      {!open && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSidebar()}
          className={cn(isMobile && "hidden", "size-8")}
        >
          <Icon name="dock_to_right" className="text-muted-foreground" />
        </Button>
      )}

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
              const link = withWorkspace(item.link ?? "");

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
