import { SDKProvider } from "@deco/sdk";
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
import { Fragment, type ReactNode, useMemo, useState } from "react";
import { Link, Outlet, useParams } from "react-router";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useUser } from "../../hooks/use-user.ts";
import RegisterActivity from "../common/register-activity.tsx";
import {
  DecopilotChat,
  DecopilotTabs,
  toggleDecopilotTab,
  useDecopilotParams,
} from "../decopilot/index.tsx";
import Docked, { type Tab, useDock } from "../dock/index.tsx";
import { ProfileModalProvider, useProfileModal } from "../profile-modal.tsx";
import { AppSidebar } from "../sidebar/index.tsx";
import { WithWorkspaceTheme } from "../theme.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { Locator } from "@deco/sdk";

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
  const { value: defaultOpen, update: setDefaultOpen } = useLocalStorage({
    key: "deco-chat-sidebar",
    defaultValue: true,
  });
  const [open, setOpen] = useState(defaultOpen);
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
            <RegisterActivity orgSlug={org} projectSlug={project} />
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
  const { initialInput, autoSend } = useDecopilotParams();
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
    if (preferences.showDecopilot || (autoSend && initialInput)) {
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
            "max-w-md min-w-0",
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
          <ToggleDecopilotButton />
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

function BreadcrumbSidebarToggle() {
  const { toggleSidebar, open, isMobile } = useSidebar();

  if (open) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => toggleSidebar()}
      className={cn(isMobile && "hidden", "size-8")}
    >
      <Icon name="dock_to_right" className="text-muted-foreground" />
    </Button>
  );
}

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
    <div className="flex items-center gap-3 pl-2 min-w-0">
      <ErrorBoundary fallback={null}>
        <BreadcrumbSidebarToggle />
      </ErrorBoundary>

      <Breadcrumb className="flex-1 min-w-0">
        <BreadcrumbList className="flex-1 min-w-0">
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
                ? (useWorkspaceLinkProp
                    ? withWorkspace(item.link!)
                    : item.link!)
                : "";

              if (isLast) {
                return (
                  <BreadcrumbItem key={`last-${item.link || index}`} className="min-w-0 flex-1">
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
                    <BreadcrumbLink
                      asChild
                      href={link}
                      className="truncate"
                    >
                      <Link to={link}>{item.label}</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="flex-shrink-0" />
                </Fragment>
              );
            })
          )}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
