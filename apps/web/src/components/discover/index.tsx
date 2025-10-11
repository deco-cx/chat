import {
  MCPConnection,
  useMarketplaceIntegrations,
  type Integration,
} from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useMemo, useState } from "react";
import { useCreateCustomApp } from "../../hooks/use-create-custom-connection.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { type DecopilotContextValue } from "../decopilot/context.tsx";
import { AppKeys, getConnectionAppKey } from "../integrations/apps.ts";
import { VerifiedBadge } from "../integrations/marketplace.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";

// For the future, it should be controlled in a view
const HIGHLIGHTS = [
  {
    appName: "@deco/google-sheets",
    name: "Google Sheets",
    description: "Manage spreadsheets with structured data",
    banner:
      "https://assets.decocache.com/decocms/3cbf2b30-57aa-47a3-89c5-9277a6b8c993/googlesheets.png",
  },
];

// For the future, it should be controlled in a view
const FEATURED: string[] = [
  // "@deco/google-gmail",
  // "@deco/google-calendar",
  // "@deco/notion",
  // "@deco/slack",
  // "@deco/google-sheets",
];

type FeaturedIntegration = Integration & {
  provider: string;
  friendlyName?: string;
  verified?: boolean;
  connection: MCPConnection;
};

const FeaturedCard = ({
  integration,
}: {
  integration: FeaturedIntegration;
}) => {
  const navigateWorkspace = useNavigateWorkspace();
  const key = getConnectionAppKey(integration);
  const appKey = AppKeys.build(key);
  return (
    <div
      onClick={() => {
        navigateWorkspace(`/apps/${appKey}`);
      }}
      className="flex flex-col gap-2 p-4 bg-card relative rounded-xl cursor-pointer overflow-hidden"
    >
      <IntegrationAvatar
        url={integration.icon}
        fallback={integration.friendlyName ?? integration.name}
        size="lg"
      />
      <h3 className="text-sm flex gap-1 items-center">
        {integration.friendlyName || integration.name}
        {integration.verified && <VerifiedBadge />}
      </h3>
      <p className="text-sm text-muted-foreground">{integration.description}</p>
    </div>
  );
};

const SimpleFeaturedCard = ({
  integration,
}: {
  integration: FeaturedIntegration;
}) => {
  const navigateWorkspace = useNavigateWorkspace();
  const key = getConnectionAppKey(integration);
  const appKey = AppKeys.build(key);
  return (
    <div
      onClick={() => {
        navigateWorkspace(`/apps/${appKey}`);
      }}
      className="flex p-2 gap-2 cursor-pointer overflow-hidden items-center hover:bg-muted rounded-lg"
    >
      <IntegrationAvatar
        url={integration.icon}
        fallback={integration.friendlyName ?? integration.name}
        size="lg"
      />
      <div className="flex flex-col gap-1">
        <div className="flex gap-1 items-center">
          <h3 className="text-sm">
            {integration.friendlyName || integration.name}
          </h3>
          {integration.verified ? (
            <VerifiedBadge />
          ) : (
            <Badge variant="secondary">Experimental</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {integration.description}
        </p>
      </div>
    </div>
  );
};

const Discover = () => {
  const [search, setSearch] = useState("");
  const [showExperimental, setShowExperimental] = useState(false);
  const { data: integrations } = useMarketplaceIntegrations();
  const navigateWorkspace = useNavigateWorkspace();
  const createCustomConnection = useCreateCustomApp();

  const featuredIntegrations = integrations?.integrations.filter(
    (integration) => FEATURED.includes(integration.name),
  );
  const verifiedIntegrations = integrations?.integrations.filter(
    (integration) => integration.verified,
  );

  const experimentalIntegrations = integrations?.integrations.filter(
    (integration) =>
      !integration.verified && !FEATURED.includes(integration.name),
  );

  const highlights = useMemo(() => {
    return HIGHLIGHTS.map((highlight) => {
      const integration = integrations?.integrations.find(
        (integration) => integration.name === highlight.appName,
      );
      return {
        ...integration,
        ...highlight,
      };
    });
  }, [integrations]);

  const filteredIntegrations = useMemo(() => {
    return integrations?.integrations
      ?.filter(
        (integration) =>
          integration.name.toLowerCase().includes(search.toLowerCase()) ||
          integration.friendlyName
            ?.toLowerCase()
            .includes(search.toLowerCase()),
      )
      ?.slice(0, 7);
  }, [integrations, search]);

  const decopilotContextValue: DecopilotContextValue = {
    additionalTools: {},
  };

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <div className="flex flex-col h-full">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-background p-4">
          <div className="flex justify-between items-center">
            <div className="relative">
              <Icon
                name="search"
                size={20}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
              />
              <Input
                placeholder="Search"
                className="w-[370px] pl-12"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <div className="z-50 p-2 bg-popover w-[370px] absolute left-0 top-[calc(100%+8px)] rounded-xl border border-border shadow-lg">
                  {filteredIntegrations?.map((integration) => (
                    <SimpleFeaturedCard
                      key={"search-" + integration.id}
                      integration={integration}
                    />
                  ))}
                  {filteredIntegrations?.length === 0 && (
                    <div className="text-sm text-muted-foreground">
                      No integrations found
                    </div>
                  )}
                </div>
              )}
            </div>
            <Button variant="outline" onClick={createCustomConnection}>
              Create Custom App
            </Button>
          </div>
        </div>

        {/* Scrollable content with independent columns */}
        <div className="flex-1 p-4 grid grid-cols-6 gap-8 overflow-hidden">
          {/* Left column - main content with independent scroll */}
          <div className="col-span-4 overflow-y-auto">
            <div className="flex flex-col gap-4">
              {highlights.map((item) => {
                if (!item.id) {
                  return null;
                }
                const key = getConnectionAppKey(item as Integration);
                const appKey = AppKeys.build(key);
                return (
                  <a
                    onClick={() => {
                      navigateWorkspace(`/apps/${appKey}`);
                    }}
                    key={item.appName}
                    className="relative rounded-xl cursor-pointer overflow-hidden"
                  >
                    <img
                      src={item.banner}
                      alt={item.appName || ""}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute flex flex-col bottom-6 left-6">
                      <IntegrationAvatar
                        url={item.icon}
                        fallback={item.friendlyName ?? item.name}
                        size="lg"
                        className="border-none mb-2"
                      />
                      <h3 className="flex gap-2 items-center text-3xl text-white mb-0.5">
                        {item.name || item.friendlyName || item.appName}
                        <VerifiedBadge />
                      </h3>
                      <p className="text-sm text-white">{item.description}</p>
                    </div>
                    <Button
                      className="absolute bottom-6 right-6 hover:bg-primary-light!"
                      variant="special"
                    >
                      See app
                    </Button>
                  </a>
                );
              })}

              {featuredIntegrations?.length > 0 && (
                <>
                  <h2 className="text-lg pt-5 font-medium">
                    Featured Apps
                    <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
                      {featuredIntegrations?.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    {featuredIntegrations?.map((integration) => (
                      <FeaturedCard
                        key={integration.id}
                        integration={integration}
                      />
                    ))}
                  </div>
                </>
              )}

              {verifiedIntegrations?.length > 0 && (
                <>
                  <h2 className="text-lg pt-5 font-medium">
                    Verified Apps
                    <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
                      {verifiedIntegrations?.length}
                    </span>
                  </h2>
                  <div className="grid grid-cols-3 gap-4">
                    {verifiedIntegrations.map((integration) => (
                      <FeaturedCard
                        key={integration.id}
                        integration={integration}
                      />
                    ))}
                  </div>
                </>
              )}

              <div className="flex items-center justify-between pt-5">
                <h2 className="text-lg font-medium">
                  Experimental Apps
                  <span className="text-muted-foreground font-mono font-normal text-sm ml-2">
                    {experimentalIntegrations?.length}
                  </span>
                </h2>
                <Button
                  variant="outline"
                  onClick={() => setShowExperimental(!showExperimental)}
                  aria-expanded={showExperimental}
                >
                  {showExperimental ? "Hide" : "Show"} Experimental Apps
                </Button>
              </div>
              {showExperimental && (
                <div className="grid grid-cols-3 gap-4">
                  {experimentalIntegrations?.map((integration) => (
                    <FeaturedCard
                      key={integration.id}
                      integration={integration}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column - verified apps with independent scroll */}
          <div className="col-span-2 overflow-y-auto">
            <div className="flex flex-col gap-2">
              <div className="sticky top-0 bg-background pb-2 z-10">
                <h2 className="text-muted-foreground text-sm font-mono">
                  VERIFIED BY DECO
                </h2>
              </div>
              <div className="grid gap-2">
                {verifiedIntegrations?.map((integration) => (
                  <SimpleFeaturedCard
                    key={integration.id}
                    integration={integration}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DecopilotLayout>
  );
};

export default Discover;
