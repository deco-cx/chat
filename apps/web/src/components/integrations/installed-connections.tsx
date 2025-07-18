import { type Integration, useIntegrations } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { useMemo } from "react";
import { IntegrationIcon } from "./common.tsx";
import { LEGACY_INTEGRATIONS } from "../../constants.ts";

function CardsView({
  integrations,
  onRowClick,
}: {
  integrations: Integration[];
  onRowClick: (integration: Integration) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
      {integrations.map((integration) =>
        LEGACY_INTEGRATIONS.includes(integration.id) ? null : (
          <Card
            key={integration.id}
            className="group hover:shadow-md transition-shadow rounded-2xl cursor-pointer h-[116px]"
            onClick={() => onRowClick(integration)}
          >
            <CardContent className="p-4">
              <div className="grid grid-cols-[min-content_1fr] gap-4">
                <IntegrationIcon
                  icon={integration.icon}
                  name={integration.name}
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
        ),
      )}
    </div>
  );
}

export function InstalledConnections({
  query,
  filter,
  onClick,
  emptyState,
}: {
  query: string;
  filter?: (integration: Integration) => boolean;
  onClick: (integration: Integration) => void;
  emptyState?: React.ReactNode;
}) {
  const { data: installedIntegrations } = useIntegrations();

  const filteredIntegrations = useMemo(() => {
    const searchTerm = query.toLowerCase();

    const filteredByQuery = query
      ? installedIntegrations.filter(
          (integration: Integration) =>
            integration.name.toLowerCase().includes(searchTerm) ||
            (integration.description?.toLowerCase() ?? "").includes(searchTerm),
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
        <CardsView integrations={filteredIntegrations} onRowClick={onClick} />
      </div>
    </div>
  );
}
