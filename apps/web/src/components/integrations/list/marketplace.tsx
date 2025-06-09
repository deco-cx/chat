import {
  type Integration,
  useInstallFromMarketplace,
  useMarketplaceIntegrations,
  useUpdateThreadMessages,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { useMemo, useState } from "react";
import { trackEvent } from "../../../hooks/analytics.ts";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../../hooks/use-navigate-workspace.ts";
import { Table, TableColumn } from "../../common/table/index.tsx";
import { IntegrationInfo } from "../../common/table/table-cells.tsx";
import { IntegrationIcon } from "./common.tsx";

interface MarketplaceIntegration extends Integration {
  provider: string;
}

interface ConnectIntegrationModalProps {
  open: boolean;
  integration: MarketplaceIntegration | null;
  createdIntegrationId: string | null;
  loading: boolean;
  onConnect: () => void;
  onEdit: () => void;
  onClose: () => void;
}
function ConnectIntegrationModal({
  open,
  integration,
  createdIntegrationId,
  loading,
  onConnect,
  onEdit,
  onClose,
}: ConnectIntegrationModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Connect to {integration?.name}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <div className="grid grid-cols-[80px_1fr] items-start gap-4">
                <IntegrationIcon
                  icon={integration?.icon}
                  name={integration?.name || ""}
                />
                <div>
                  <div className="text-sm text-muted-foreground">
                    {integration?.description}
                  </div>
                  {createdIntegrationId && (
                    <div className="font-bold mt-4">
                      The integration has been installed successfully. Click the
                      button below to configure it.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {loading
            ? (
              <Button disabled={loading}>
                Connecting...
              </Button>
            )
            : createdIntegrationId
            ? (
              <div className="flex gap-3">
                <Button onClick={onEdit}>
                  Configure
                </Button>
              </div>
            )
            : (
              <Button onClick={onConnect}>
                Connect
              </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CardsView(
  { integrations, onRowClick }: {
    integrations: Record<string, MarketplaceIntegration[]>;
    onRowClick: (integration: MarketplaceIntegration) => void;
  },
) {
  return (
    <div className="flex flex-col gap-6">
      {Object.entries(integrations).map(([category, categoryIntegrations]) => (
        <div key={category}>
          <h3 className="text-lg font-semibold mb-3">{category}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {categoryIntegrations.map((integration) => (
              <Card
                key={integration.id}
                className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer"
                onClick={() => onRowClick(integration)}
              >
                <CardContent className="p-4">
                  <div className="grid grid-cols-[min-content_1fr] gap-4">
                    <IntegrationIcon
                      icon={integration.icon}
                      name={integration.name}
                      className="h-16 w-16"
                    />
                    <div className="grid grid-cols-1 gap-1">
                      <div className="text-base font-semibold truncate">
                        {integration.name}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {integration.description}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <span className="text-xs px-2 py-1 bg-secondary rounded-full">
                      {integration.provider}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function TableView(
  { integrations, onConfigure }: {
    integrations: Record<string, MarketplaceIntegration[]>;
    onConfigure: (integration: MarketplaceIntegration) => void;
  },
) {
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(row: MarketplaceIntegration, key: string): string {
    if (key === "provider") return row.provider?.toLowerCase() || "";
    if (key === "description") return row.description?.toLowerCase() || "";
    return row.name?.toLowerCase() || "";
  }

  const columns: TableColumn<MarketplaceIntegration>[] = [
    {
      id: "name",
      header: "Name",
      render: (integration) => <IntegrationInfo integration={integration} />,
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (integration) => integration.description,
      sortable: true,
      cellClassName: "max-w-md",
    },
    {
      id: "provider",
      header: "Provider",
      accessor: (integration) => integration.provider,
      sortable: true,
    },
  ];

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {Object.entries(integrations).map(([category, categoryIntegrations]) => {
        const sortedIntegrations = [...categoryIntegrations].sort((a, b) => {
          const aVal = getSortValue(a, sortKey);
          const bVal = getSortValue(b, sortKey);
          if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
          if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
          return 0;
        });

        return (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-3">{category}</h3>
            <Table
              columns={columns}
              data={sortedIntegrations}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSort={handleSort}
              onRowClick={onConfigure}
            />
          </div>
        );
      })}
    </div>
  );
}

export function MarketplaceTab(
  { viewMode, filter }: { viewMode: "cards" | "table"; filter: string },
) {
  const [selectedIntegration, setSelectedIntegration] = useState<
    MarketplaceIntegration | null
  >(null);
  const [showModal, setShowModal] = useState(false);
  const [createdIntegrationId, setCreatedIntegrationId] = useState<
    string | null
  >(null);
  const [isPending, setIsPending] = useState(false);
  const { mutate: installIntegration } = useInstallFromMarketplace();
  const navigateWorkspace = useNavigateWorkspace();
  const updateThreadMessages = useUpdateThreadMessages();
  const buildWorkspaceUrl = useWorkspaceLink();

  const { data: marketplace } = useMarketplaceIntegrations();

  const filteredRegistryIntegrations = useMemo(() => {
    const searchTerm = filter.toLowerCase();
    const integrations = marketplace?.integrations ?? [];

    const filtered = filter
      ? integrations.filter((integration: MarketplaceIntegration) =>
        integration.name.toLowerCase().includes(searchTerm) ||
        (integration.description?.toLowerCase() ?? "").includes(searchTerm) ||
        integration.provider.toLowerCase().includes(searchTerm)
      )
      : integrations;

    // Categorize integrations
    const categorized: Record<string, MarketplaceIntegration[]> = {
      "First Party Integrations": [],
      "Third Party Integrations": [],
    };

    filtered.forEach((integration: MarketplaceIntegration) => {
      if (integration.provider === "deco") {
        categorized["First Party Integrations"].push(integration);
      } else {
        categorized["Third Party Integrations"].push(integration);
      }
    });

    return categorized;
  }, [marketplace, filter]);

  function handleOpenModal(integration: MarketplaceIntegration) {
    setSelectedIntegration(integration);
    setShowModal(true);
    setCreatedIntegrationId(null);
  }

  function handleCloseModal() {
    setShowModal(false);
    setSelectedIntegration(null);
    setCreatedIntegrationId(null);
    setIsPending(false);
  }

  function handleConnect() {
    if (!selectedIntegration) return;
    setIsPending(true);
    const returnUrl = new URL(
      buildWorkspaceUrl("/integrations"),
      globalThis.location.origin,
    );

    installIntegration({
      appName: selectedIntegration.id,
      provider: selectedIntegration.provider,
      returnUrl: returnUrl.href,
    }, {
      onSuccess: ({ integration, redirectUrl }) => {
        if (typeof integration?.id !== "string") {
          setIsPending(false);
          return;
        }
        setCreatedIntegrationId(integration.id);
        setIsPending(false);
        trackEvent("integration_install", {
          success: true,
          data: selectedIntegration,
        });

        if (redirectUrl) {
          globalThis.location.href = redirectUrl;
        }
      },
      onError: (error) => {
        setIsPending(false);
        trackEvent("integration_install", {
          success: false,
          data: selectedIntegration,
          error,
        });
      },
    });
  }

  function handleEditIntegration() {
    if (!createdIntegrationId) return;
    updateThreadMessages(createdIntegrationId);
    navigateWorkspace(`/integration/${createdIntegrationId}`);
  }

  return (
    <>
      <div className="flex-1 min-h-0 px-4 overflow-x-auto">
        {viewMode === "table"
          ? (
            <TableView
              integrations={filteredRegistryIntegrations}
              onConfigure={handleOpenModal}
            />
          )
          : (
            <CardsView
              integrations={filteredRegistryIntegrations}
              onRowClick={handleOpenModal}
            />
          )}
      </div>
      <ConnectIntegrationModal
        open={showModal}
        integration={selectedIntegration}
        createdIntegrationId={createdIntegrationId}
        loading={isPending}
        onConnect={handleConnect}
        onEdit={handleEditIntegration}
        onClose={handleCloseModal}
      />
    </>
  );
}
