import {
  Integration,
  useCreateIntegration,
  useIntegrations,
  useMarketplaceIntegrations,
  useUpdateThreadMessages,
} from "@deco/sdk";
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
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useEffect, useState } from "react";
import { useNavigateWorkspace } from "../../../hooks/use-navigate-workspace.ts";
import { ListPageHeader } from "../../common/list-page-header.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";
import { InstalledIntegrationsTab } from "./installed.tsx";
import { MarketplaceTab } from "./marketplace.tsx";

const isUUID = (uuid: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);

function MainTab() {
  const [filter, setFilter] = useState("");
  const [visibility, setVisibility] = useState<
    "all" | "team" | "private" | "marketplace"
  >("all");
  const [viewMode, setViewMode] = useState<
    "cards" | "table"
  >("cards");

  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplaceIntegrations } = useMarketplaceIntegrations();

  const {
    team: teamIntegrations,
    private: privateIntegrations,
  } = installedIntegrations.reduce((acc, integration) => {
    if (integration.connection.type === "INNATE") {
      return acc;
    }

    const visibility = integration.access?.includes("private")
      ? "private"
      : "team";

    acc[visibility] = [
      ...(acc[visibility] || []),
      integration,
    ];

    return acc;
  }, {
    team: [],
    private: [],
  } as Record<"team" | "private", Integration[]>);

  return (
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4 overflow-x-auto">
        <ListPageHeader
          filter={{
            items: [
              {
                active: visibility === "all",
                label: "All",
                id: "all" as const,
                count: installedIntegrations.length,
              },
              {
                active: visibility === "team",
                label: (
                  <>
                    <Icon name="groups" /> Team
                  </>
                ),
                id: "team" as const,
                count: teamIntegrations.length,
              },
              {
                active: visibility === "private",
                label: (
                  <>
                    <Icon name="lock" /> Private
                  </>
                ),
                id: "private" as const,
                count: privateIntegrations.length,
              },
              {
                active: visibility === "marketplace",
                label: (
                  <>
                    <Icon name="shopping_bag" /> Marketplace
                  </>
                ),
                id: "marketplace" as const,
                count: marketplaceIntegrations?.integrations.length ?? 0,
              },
            ],
            onClick: (item) => {
              setVisibility(item.id as "team" | "private" | "marketplace");
            },
          }}
          input={{
            placeholder: "Search integration",
            value: filter,
            onChange: (e) => setFilter(e.target.value),
          }}
          view={{ viewMode, onChange: setViewMode }}
        />
      </div>

      <div className="flex-1 min-h-0 px-4 overflow-x-auto">
        {visibility === "marketplace"
          ? <MarketplaceTab viewMode={viewMode} filter={filter} />
          : (
            <InstalledIntegrationsTab
              setVisibility={setVisibility}
              viewMode={viewMode}
              filter={filter}
              integrations={
                visibility === "all"
                  ? installedIntegrations
                  : visibility === "team"
                  ? teamIntegrations
                  : privateIntegrations
              }
            />
          )}
      </div>
    </div>
  );
}

const TABS = {
  main: {
    title: "Integrations",
    Component: MainTab,
    initialOpen: true,
  },
};

function IntegrationPageLayout() {
  const navigateWorkspace = useNavigateWorkspace();
  const [error, setError] = useState<string | null>(null);

  const create = useCreateIntegration();
  const updateThreadMessages = useUpdateThreadMessages();

  useEffect(() => {
    const url = new URL(globalThis.location.href);
    const mcpUrl = url.searchParams.get("mcpUrl");

    const uuid = mcpUrl?.split("/").at(-3);

    if (typeof uuid === "string" && isUUID(uuid)) {
      navigateWorkspace(`/integration/${uuid}`);
    }
  }, []);

  const handleCreate = async () => {
    try {
      const result = await create.mutateAsync({});
      updateThreadMessages(result.id);
      navigateWorkspace(`/integration/${result.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create integration",
      );
    }
  };

  return (
    <>
      <PageLayout
        displayViewsTrigger={false}
        tabs={TABS}
        breadcrumb={
          <DefaultBreadcrumb
            items={[{ label: "Integrations", link: "/integrations" }]}
          />
        }
        actionButtons={
          <Button
            onClick={handleCreate}
            disabled={create.isPending}
            variant="special"
            className="gap-2"
          >
            {create.isPending
              ? (
                <>
                  <Spinner size="xs" />
                  <span>Creating...</span>
                </>
              )
              : (
                <>
                  <Icon name="add" />
                  <span className="hidden md:inline">New Integration</span>
                </>
              )}
          </Button>
        }
      />
      <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Error</AlertDialogTitle>
            <AlertDialogDescription>
              {error}
            </AlertDialogDescription>
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

export default IntegrationPageLayout;
