import { useIntegrations } from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";
import { useMatch } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { ListPageHeader } from "../common/list-page-header.tsx";
import type { ViewModeSwitcherProps } from "../common/view-mode-switcher.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";

export function IntegrationPageLayout({ tabs }: { tabs: Record<string, Tab> }) {
  const [error, setError] = useState<string | null>(null);
  const navigateWorkspace = useNavigateWorkspace();

  return (
    <>
      <PageLayout
        hideViewsButton
        breadcrumb={
          <DefaultBreadcrumb
            items={[{ label: "My Apps", link: "/connections" }]}
          />
        }
        actionButtons={
          <Button
            variant="special"
            onClick={() => navigateWorkspace("/discover")}
          >
            Discover Apps
          </Button>
        }
        tabs={tabs}
      />
      <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>{error}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setError(null)}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export const Header = ({
  query,
  setQuery,
  viewMode,
  setViewMode,
}: {
  query: string;
  setQuery: (query: string) => void;
  viewMode: ViewModeSwitcherProps["viewMode"];
  setViewMode: (viewMode: ViewModeSwitcherProps["viewMode"]) => void;
}) => {
  const teamConnectionsViewActive = useMatch({
    path: `:teamSlug?/connections`,
  });

  const { data: installedIntegrations } = useIntegrations();
  // TODO: private integrations

  return (
    <ListPageHeader
      filter={{
        items: [
          {
            active: !!teamConnectionsViewActive,
            label: (
              <span className="flex items-center gap-2">
                <Icon name="groups" size={16} />
                Team
              </span>
            ),
            id: "connected",
            count:
              installedIntegrations?.filter(
                (integration) => integration.connection.type !== "INNATE",
              ).length ?? 0,
          },
          {
            active: !teamConnectionsViewActive,
            disabled: true,
            tooltip: "Coming soon",
            label: (
              <span className="flex items-center gap-2">
                <Icon name="lock" size={16} />
                Private
              </span>
            ),
            id: "all",
            count: 0,
          },
        ],
        onClick: () => {},
      }}
      input={{
        placeholder: "Search apps",
        value: query,
        onChange: (e) => setQuery(e.target.value),
      }}
      view={{ viewMode, onChange: setViewMode }}
    />
  );
};
