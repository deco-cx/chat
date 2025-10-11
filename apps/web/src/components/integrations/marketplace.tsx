import { useMarketplaceIntegrations, type Integration } from "@deco/sdk";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useMemo } from "react";
import { IntegrationIcon } from "./common.tsx";

export interface MarketplaceIntegration extends Integration {
  provider: string;
  friendlyName?: string;
  verified?: boolean;
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

export function SetupIntegrationModal({
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
            Connect to {integration?.friendlyName ?? integration?.name}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <div className="grid grid-cols-[80px_1fr] items-start gap-4">
                <IntegrationIcon
                  icon={integration?.icon}
                  name={integration?.friendlyName ?? integration?.name}
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
          {loading ? (
            <Button disabled={loading}>Connecting...</Button>
          ) : createdIntegrationId ? (
            <div className="flex gap-3">
              <Button onClick={onEdit}>Configure</Button>
            </div>
          ) : (
            <Button onClick={onConnect}>Connect</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function VerifiedBadge() {
  return (
    <div className="relative w-4 h-4">
      <div className="absolute bg-primary rounded-full w-2 h-2 top-1 left-1" />
      <Tooltip>
        <TooltipTrigger asChild>
          <Icon
            name="verified"
            size={16}
            className="absolute z-5 text-primary-light"
            filled
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Verified by Deco</p>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function CardsView({
  integrations,
  onRowClick,
}: {
  integrations: MarketplaceIntegration[];
  onRowClick: (integration: MarketplaceIntegration) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      {integrations.map((integration) => {
        const showVerifiedBadge =
          integration.id !== NEW_CUSTOM_CONNECTION.id && integration.verified;
        return (
          <Card
            key={integration.id}
            className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]"
            onClick={() => onRowClick(integration)}
          >
            <CardContent className="p-4">
              <div className="grid grid-cols-[min-content_1fr] gap-4">
                <IntegrationIcon
                  icon={integration.icon}
                  name={integration.friendlyName ?? integration.name}
                  className="h-10 w-10"
                />
                <div className="grid grid-cols-1 gap-1">
                  <div className="flex items-start gap-1">
                    <div className="text-sm font-semibold truncate">
                      {integration.friendlyName ?? integration.name}
                    </div>
                    {showVerifiedBadge && <VerifiedBadge />}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-3">
                    {integration.description}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export const NEW_CUSTOM_CONNECTION: MarketplaceIntegration = {
  id: "NEW_CUSTOM_CONNECTION",
  name: "Create custom integration",
  description: "Create a new integration with any MCP server",
  icon: "",
  provider: "deco",
  connection: { type: "HTTP", url: "" },
};

export function Marketplace({
  filter,
  onClick,
  emptyState,
}: {
  filter: string;
  onClick: (integration: MarketplaceIntegration) => void;
  emptyState?: React.ReactNode;
}) {
  const { data: marketplace } = useMarketplaceIntegrations();

  const filteredIntegrations = useMemo(() => {
    const searchTerm = filter.toLowerCase();
    const integrations = [
      NEW_CUSTOM_CONNECTION,
      ...(marketplace?.integrations ?? []),
    ];

    return filter
      ? integrations.filter(
          (integration: MarketplaceIntegration) =>
            integration.name.toLowerCase().includes(searchTerm) ||
            (integration.description?.toLowerCase() ?? "").includes(
              searchTerm,
            ) ||
            integration.provider.toLowerCase().includes(searchTerm) ||
            (integration.friendlyName?.toLowerCase() ?? "").includes(
              searchTerm,
            ),
        )
      : integrations;
  }, [marketplace, filter]);

  if (filteredIntegrations.length === 0 && emptyState) {
    return emptyState;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 min-h-0 overflow-x-auto">
        <CardsView integrations={filteredIntegrations} onRowClick={onClick} />
      </div>
    </div>
  );
}
