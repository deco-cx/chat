import { type Integration, useIntegrations } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { useMemo } from "react";
import { IntegrationIcon } from "./common.tsx";
import { LEGACY_INTEGRATIONS } from "../../constants.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";

function CardItem({ integration, onRowClick, isSelected }: {
  integration: Integration;
  onRowClick: (integration: Integration) => void;
  isSelected: (integration: Integration) => boolean;
}) {
  const selected = isSelected(integration);
  if (LEGACY_INTEGRATIONS.includes(integration.id)) {
    return null;
  }

  return (
    <Card
      key={integration.id}
      className={cn(
        "group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]",
        selected && "border-2 border-primary-light bg-primary-light/10",
      )}
      onClick={() => onRowClick(integration)}
    >
      <CardContent className="p-4 relative">
        {selected && (
          <div className="absolute top-2 right-2">
            <Icon
              name="check_circle"
              size={16}
              className="text-primary-light"
              filled
            />
          </div>
        )}
        <div className="grid grid-cols-[min-content_1fr] gap-4">
          <IntegrationIcon
            icon={integration.icon}
            className="h-10 w-10"
          />
          <div className="grid grid-cols-1 gap-1">
            <div className="text-sm font-semibold truncate">
              {integration.name}
            </div>
            <div className="text-sm text-muted-foreground line-clamp-3">
              {integration.description}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CardsView(
  { integrations, onRowClick, isSelected: _isSelected }: {
    integrations: Integration[];
    onRowClick: (integration: Integration) => void;
    isSelected?: (integration: Integration) => boolean;
  },
) {
  const isSelected = _isSelected ?? (() => false);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      {integrations.map((integration) => (
        <CardItem
          key={integration.id}
          integration={integration}
          onRowClick={onRowClick}
          isSelected={isSelected}
        />
      ))}
    </div>
  );
}

export function InstalledConnections({
  query,
  filter,
  onClick,
  emptyState,
  isSelected,
}: {
  query: string;
  filter?: (integration: Integration) => boolean;
  onClick: (integration: Integration) => void;
  emptyState?: React.ReactNode;
  isSelected?: (integration: Integration) => boolean;
}) {
  const { data: installedIntegrations } = useIntegrations();

  const filteredIntegrations = useMemo(() => {
    const searchTerm = query.toLowerCase();

    const filteredByQuery = query
      ? installedIntegrations.filter((integration: Integration) =>
        integration.name.toLowerCase().includes(searchTerm) ||
        (integration.description?.toLowerCase() ?? "").includes(searchTerm)
      )
      : installedIntegrations;

    return filter ? filteredByQuery.filter(filter) : filteredByQuery;
  }, [installedIntegrations, query, filter]);

  if (filteredIntegrations.length === 0 && emptyState) {
    return emptyState;
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex-1 min-h-0 overflow-x-auto">
        <CardsView
          integrations={filteredIntegrations}
          onRowClick={onClick}
          isSelected={isSelected}
        />
      </div>
    </div>
  );
}
