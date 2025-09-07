import {
  type Integration,
  MCPConnection,
  useMarketplaceIntegrations,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useMemo, useState } from "react";
import { useParams } from "react-router";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import type { Tab } from "../dock/index.tsx";
import { AppKeys, getConnectionAppKey } from "../integrations/apps.ts";
import { VerifiedBadge } from "../integrations/marketplace.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";

// For the future, it should be controlled in a view
const HIGHLIGHTS = [
  {
    appName: "@admin-deco/admin-cx",
    name: "deco sites",
    description: "Vibecode high-performance websites",
    banner:
      "https://assets.decocache.com/starting/997a782f-3036-4e23-a75e-ffa9c32bd2d5/58bebf51abe94574a84fef328ca3412fcc5f8ccf.png",
  },
];

// For the future, it should be controlled in a view
const FEATURED = [
  "@decocms/perplexity",
  "@deco/airtable",
  "@deco/stability",
  "@deco/spotify",
  "@deco/slack",
  "@deco/google-sheets",
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
        navigateWorkspace(`/connection/${appKey}`);
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
        navigateWorkspace(`/connection/${appKey}`);
      }}
      className="flex gap-2 py-2 cursor-pointer overflow-hidden items-center"
    >
      <IntegrationAvatar
        url={integration.icon}
        fallback={integration.friendlyName ?? integration.name}
        size="lg"
      />
      <div className="flex flex-col gap-1">
        <h3 className="text-sm flex gap-1 items-center">
          {integration.friendlyName || integration.name}
        </h3>
        <p className="text-sm text-muted-foreground">
          {integration.description}
        </p>
      </div>
    </div>
  );
};

const Marketplace = () => {
  const [search, setSearch] = useState("");
  const { data: integrations } = useMarketplaceIntegrations();
  const navigateWorkspace = useNavigateWorkspace();
  const createCustomConnection = useCreateCustomConnection();

  const featuredIntegrations = integrations?.integrations.filter(
    (integration) => FEATURED.includes(integration.name),
  );
  const verifiedIntegrations = integrations?.integrations.filter(
    (integration) => integration.verified,
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

  return (
    <div className="p-4 flex flex-col gap-4 overflow-y-auto h-full">
      <div className="flex justify-between items-center">
        <div className="relative">
          <Input
            placeholder="Search"
            className="w-[370px]"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <div className="z-20 p-4 bg-white w-[370px] absolute left-0 top-[calc(100%+8px)] rounded-xl">
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
      <div className="grid grid-cols-6 gap-8">
        <div className="flex flex-col gap-4 col-span-4">
          {highlights.map((item) => {
            if (!item.id) {
              return null;
            }
            const key = getConnectionAppKey(item as Integration);
            const appKey = AppKeys.build(key);
            return (
              <a
                onClick={() => {
                  navigateWorkspace(`/connection/${appKey}`);
                }}
                key={item.appName}
                className="relative rounded-xl cursor-pointer overflow-hidden"
              >
                <img
                  src={item.banner}
                  alt={item.appName || ""}
                  className="w-full h-full object-cover"
                />
                <div className="absolute flex flex-col gap-1 bottom-6 left-6">
                  <IntegrationAvatar
                    url={item.icon}
                    fallback={item.friendlyName ?? item.name}
                    size="lg"
                    className="border-none"
                  />
                  <h3 className="flex gap-2 items-center text-3xl text-white">
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

          <h2 className="text-lg font-medium">
            Featured Apps
            <span className="text-muted-foreground text-sm ml-2">
              {featuredIntegrations?.length}
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {featuredIntegrations?.map((integration) => (
              <FeaturedCard key={integration.id} integration={integration} />
            ))}
          </div>

          <h2 className="text-lg font-medium">
            All Apps
            <span className="text-muted-foreground text-sm ml-2">
              {integrations?.integrations?.length}
            </span>
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {integrations?.integrations.map((integration) => (
              <FeaturedCard key={integration.id} integration={integration} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 col-span-2">
          <h2 className="text-muted-foreground">VERIFIED BY DECO</h2>
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
  );
};

const BASE_TABS: Record<string, Tab> = {
  activity: {
    title: "Activity",
    Component: Marketplace,
    initialOpen: true,
    active: false,
  },
};

export default function Discover() {
  const { tab } = useParams<{ tab?: string }>();
  const activeKey = tab && tab in BASE_TABS ? tab : "activity";

  const tabs = useMemo(() => {
    return Object.fromEntries(
      Object.entries(BASE_TABS).map(([key, value]) => [
        key,
        {
          ...value,
          active: key === activeKey,
        },
      ]),
    ) as Record<string, Tab>;
  }, [activeKey]);

  return (
    <PageLayout
      tabs={tabs}
      hideViewsButton
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Discover", link: "/discover" }]} />
      }
    />
  );
}
