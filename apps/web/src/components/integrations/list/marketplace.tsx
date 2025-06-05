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
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useMemo, useState } from "react";
import { trackEvent } from "../../../hooks/analytics.ts";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../../hooks/use-navigate-workspace.ts";
import { IntegrationPageLayout } from "./breadcrumb.tsx";
import { IntegrationIcon } from "./common.tsx";

export interface MarketplaceIntegration extends Integration {
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function Marketplace() {
  const [registryFilter, setRegistryFilter] = useState("");
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

  const filteredIntegrations = useMemo(() => {
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
    const returnUrl = new URL(
      buildWorkspaceUrl("/connections"),
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
    <div className="flex flex-col gap-4 h-full p-4">
      <Input
        placeholder="Find connection..."
        value={registryFilter}
        onChange={(e) => setRegistryFilter(e.target.value)}
      />

      <div className="flex-1 min-h-0 overflow-x-auto">
        <CardsView
          integrations={filteredIntegrations}
          onRowClick={handleOpenModal}
        />
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
