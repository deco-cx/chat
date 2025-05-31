import { SDKProvider, Workspace } from "@deco/sdk";
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
import { cn } from "@deco/ui/lib/utils.ts";
import {
  createContext,
  Fragment,
  ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { Link, Outlet, useParams } from "react-router";
import { Toaster } from "@deco/ui/components/sonner.tsx";
import { useUser } from "../hooks/use-user.ts";
import { useWorkspaceLink } from "../hooks/use-navigate-workspace.ts";
import RegisterActivity from "./common/register-activity.tsx";
import Docked, { Tab } from "./dock/index.tsx";
import { AppSidebar } from "./sidebar/index.tsx";
import { useLocalStorage } from "../hooks/use-local-storage.ts";
import { ProfileSettings } from "./settings/profile.tsx";
import { WithWorkspaceTheme } from "./theme.tsx";

// Context for profile modal
interface ProfileModalContextType {
  openProfileModal: (onPhoneSaved?: () => void) => void;
  closeProfileModal: () => void;
}
export const ProfileModalContext = createContext<
  ProfileModalContextType | undefined
>(undefined);
export function useProfileModal() {
  const ctx = useContext(ProfileModalContext);
  if (!ctx) {
    throw new Error("useProfileModal must be used within ProfileModalContext");
  }
  return ctx;
}

export function RouteLayout() {
  const {
    value: defaultOpen,
    update: setDefaultOpen,
  } = useLocalStorage({ key: "deco-chat-sidebar", defaultValue: true });
  const [open, setOpen] = useState(defaultOpen);
  const { teamSlug } = useParams();
  const user = useUser();
  const [profileOpen, setProfileOpen] = useState(false);
  const pendingProfileAction = useRef<(() => void) | null>(null);

  function openProfileModal(onPhoneSaved?: () => void) {
    if (onPhoneSaved) pendingProfileAction.current = onPhoneSaved;
    setProfileOpen(true);
  }
  function closeProfileModal() {
    setProfileOpen(false);
    pendingProfileAction.current = null;
  }
  function handlePhoneSaved() {
    if (pendingProfileAction.current) {
      pendingProfileAction.current();
      pendingProfileAction.current = null;
    }
    setProfileOpen(false);
  }

  const rootContext: Workspace = teamSlug
    ? `shared/${teamSlug}`
    : `users/${user?.id}`;

  return (
    <SDKProvider workspace={rootContext}>
      <WithWorkspaceTheme>
        <ProfileModalContext.Provider
          value={{ openProfileModal, closeProfileModal }}
        >
          <SidebarProvider
            open={open}
            onOpenChange={(open) => {
              setDefaultOpen(open);
              setOpen(open);
            }}
            className="h-full bg-sidebar"
            style={{
              "--sidebar-width": "16rem",
              "--sidebar-width-mobile": "14rem",
            } as Record<string, string>}
          >
            <AppSidebar />
            <SidebarInset className="h-full flex-col bg-sidebar">
              <Outlet />
            </SidebarInset>
            <ProfileSettings
              open={profileOpen}
              onOpenChange={setProfileOpen}
              onPhoneSaved={handlePhoneSaved}
            />
            <RegisterActivity teamSlug={teamSlug} />
            <Toaster />
          </SidebarProvider>
        </ProfileModalContext.Provider>
      </WithWorkspaceTheme>
    </SDKProvider>
  );
}

export interface PageLayoutProps {
  breadcrumb?: ReactNode;
  actionButtons?: ReactNode;
  tabs: Record<string, Tab>;
  displayViewsTrigger?: boolean;
}

export function PageLayout({
  breadcrumb,
  actionButtons,
  tabs,
  displayViewsTrigger = true,
}: PageLayoutProps) {
  const { toggleSidebar, open } = useSidebar();

  return (
    <Docked.Provider tabs={tabs}>
      <div
        className={cn(
          "bg-sidebar",
          "grid grid-cols-3 md:grid-cols-2 px-2",
        )}
      >
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
          {displayViewsTrigger && <Docked.ViewsTrigger />}
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
      <div className="h-full p-0 md:p-1">
        <Docked tabs={tabs} />
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
          {isMobile
            ? (
              <BreadcrumbItem key={items.at(-1)?.link}>
                <BreadcrumbPage className="inline-flex items-center gap-2">
                  {items.at(-1)?.label}
                </BreadcrumbPage>
              </BreadcrumbItem>
            )
            : items?.map((item, index) => {
              const isLast = index === items.length - 1;
              const link = withWorkspace(item.link ?? "");

              if (isLast) {
                return (
                  <BreadcrumbItem key={item.link}>
                    <BreadcrumbPage className="inline-flex items-center gap-2">
                      {item.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                );
              }

              return (
                <Fragment key={item.link}>
                  <BreadcrumbItem>
                    <BreadcrumbLink
                      asChild
                      href={link}
                      className="inline-flex items-center gap-2"
                    >
                      <Link to={link}>
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator />
                </Fragment>
              );
            })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
