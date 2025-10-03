import { BreadcrumbSeparator } from "@deco/ui/components/breadcrumb.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { Link } from "react-router";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { ReportIssueButton } from "../common/report-issue-button.tsx";
import { LoggedUser, LoggedUserAvatarTrigger } from "../sidebar/footer";
import { DefaultBreadcrumb, ToggleDecopilotButton } from "./project";

interface BreadcrumbItem {
  label: string | React.ReactNode;
  link?: string;
}

function SidebarToggle() {
  const { toggleSidebar } = useSidebar();

  return (
    <>
      <Button
        onClick={toggleSidebar}
        size="icon"
        variant="ghost"
        className="w-8 h-8 rounded-md"
      >
        <Icon
          name="dock_to_right"
          className="text-muted-foreground"
          size={20}
        />
      </Button>
      <div className="h-8 w-px bg-border" />
    </>
  );
}

export function Topbar({ breadcrumb }: { breadcrumb: BreadcrumbItem[] }) {
  return (
    <div className="fixed top-0 left-0 right-0 z-20 bg-sidebar flex items-center justify-between w-full p-4 h-12 border-b border-border">
      <div className="flex items-center gap-2">
        <ErrorBoundary fallback={null}>
          <SidebarToggle />
        </ErrorBoundary>
        <Link to="/" className="ml-2">
          <img
            src="/img/logo-tiny.svg"
            className="size-5 text-xs"
            alt="Deco Logo"
          />
        </Link>
        <BreadcrumbSeparator className="text-muted-foreground" />
        <DefaultBreadcrumb items={breadcrumb} useWorkspaceLink={false} />
      </div>
      <div className="flex items-center gap-3">
        <ReportIssueButton />
        <ToggleDecopilotButton />
        <LoggedUser
          trigger={(user) => <LoggedUserAvatarTrigger user={user} />}
          align="end"
        />
      </div>
    </div>
  );
}
