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
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useMemo, useState } from "react";
import { trackEvent } from "../../../hooks/analytics.ts";
import { useNavigateWorkspace } from "../../../hooks/useNavigateWorkspace.ts";
import { Breadcrumb, IntegrationPageLayout } from "./breadcrumb.tsx";
import { IntegrationIcon } from "./common.tsx";
import { Table, TableColumn } from "../../common/Table.tsx";
import { IntegrationInfo } from "../../common/TableCells.tsx";

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
    integrations: MarketplaceIntegration[];
    onRowClick: (integration: MarketplaceIntegration) => void;
  },
) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {integrations.map((integration) => (
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
  );
}

function TableView(
  { integrations, onConfigure }: {
    integrations: MarketplaceIntegration[];
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
  const sortedIntegrations = [...integrations].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

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
    <Table
      columns={columns}
      data={sortedIntegrations}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={onConfigure}
    />
  );
}

function MarketplaceTab() {
  const [registryFilter, setRegistryFilter] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
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

  const { data: marketplace } = useMarketplaceIntegrations();

  const filteredRegistryIntegrations = useMemo(() => {
    const searchTerm = registryFilter.toLowerCase();
    const integrations = marketplace?.integrations ?? [];
    return registryFilter
      ? integrations.filter((integration: MarketplaceIntegration) =>
        integration.name.toLowerCase().includes(searchTerm) ||
        (integration.description?.toLowerCase() ?? "").includes(searchTerm) ||
        integration.provider.toLowerCase().includes(searchTerm)
      )
      : integrations;
  }, [marketplace, registryFilter]);

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
    installIntegration(selectedIntegration.id, {
      onSuccess: (data) => {
        if (typeof data.id !== "string") {
          setIsPending(false);
          return;
        }
        setCreatedIntegrationId(data.id);
        setIsPending(false);
        trackEvent("integration_install", {
          success: true,
          data: selectedIntegration,
        });
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
    <div className="flex flex-col gap-4 h-full py-4">
      <div className="px-4 overflow-x-auto">
        <Breadcrumb
          value={registryFilter}
          setValue={(value) => setRegistryFilter(value)}
          viewMode={viewMode}
          setViewMode={setViewMode}
        />
      </div>

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
    </div>
  );
}

export default function Page() {
  return (
    <IntegrationPageLayout
      tabs={{
        marketplace: {
          title: "Marketplace",
          Component: MarketplaceTab,
          initialOpen: true,
        },
      }}
    />
  );
}
