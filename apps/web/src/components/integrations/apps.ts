/**
 * This file uses a concept of "App" to group connections by their source MCP.
 *
 * An "App" is a group of connections from the same source MCP.
 *
 * This is not persisted anywhere, so we can change it later, or
 * remove it completely.
 *
 * The "App key" is a unique identifier used to group connections by their source application.
 * Grouping by app is useful to see all connections from the same app in one place.
 */
import {
  type Integration,
  maybeRegistryApp,
  MCPConnection,
  useIntegrations,
  useMarketplaceIntegrations,
  WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
  WellKnownMcpGroupIds,
} from "@deco/sdk";
import { AppName } from "@deco/sdk/common";
import { useEffect, useMemo } from "react";
import { LEGACY_INTEGRATIONS } from "../../constants.ts";
import {
  addIntegrationUpdateListener,
  type IntegrationMessage,
} from "../../lib/broadcast-channels.ts";
import { MarketplaceIntegration } from "./marketplace.tsx";

export interface GroupedApp {
  id: string;
  name: string;
  icon?: string;
  description: string;
  instances: number;
  provider?: string;
  usedBy: { avatarUrl: string }[];
  connection?: MCPConnection;
  verified?: boolean;
  friendlyName?: string;
  isNative?: boolean;
}

export interface AppKey {
  appId: string;
  provider: string;
}

export const AppKeys = {
  build: (key: AppKey) => `${key.provider}:::${key.appId}`,
  toAppName: (key: string) => {
    const { provider, appId } = AppKeys.parse(key);
    return `@${provider}/${appId}`;
  },
  parse: (key: string) => {
    const [provider, appId] = key.split(":::");
    return {
      appId,
      provider,
    } as AppKey;
  },
};

export const WELL_KNOWN_DECO_CMS_APP_KEY = AppKeys.build({
  appId: "admin.decocms.com",
  provider: "deco",
});

export const WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY = AppKeys.build({
  appId: "knowledge-bases",
  provider: "deco",
});

export const WELL_KNOWN_APPS: Record<string, GroupedApp> = {
  [WELL_KNOWN_DECO_CMS_APP_KEY]: {
    id: WELL_KNOWN_DECO_CMS_APP_KEY,
    name: "Deco CMS",
    icon: "https://assets.decocache.com/mcp/306fcf27-d5dd-4d8c-8ddd-567d763372ee/decochat.png",
    description: "Native deco CMS tools.",
    instances: 1,
    usedBy: [],
  },
  [WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY]: {
    id: WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY,
    name: "Knowledge Base",
    icon: "https://assets.decocache.com/mcp/85269424-f5c7-4473-a67e-c3d6a120f586/knowledgebase.png",
    description: "Native knowledge base tools",
    instances: 1,
    usedBy: [],
  },
} as const;

export function isWellKnownApp(appKey: string): boolean {
  return (
    WELL_KNOWN_DECO_CMS_APP_KEY === appKey ||
    WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY === appKey
  );
}

// Native apps that are always available
export const NATIVE_APPS: GroupedApp[] = [
  {
    id: "native:::documents",
    name: "Documents",
    icon: "icon://docs",
    description: "Create and manage documents with AI assistance",
    instances: 1,
    provider: "native",
    usedBy: [],
    isNative: true,
  },
  {
    id: "native:::agents",
    name: "Agents",
    icon: "icon://robot_2",
    description: "Create AI agents with specialized capabilities",
    instances: 1,
    provider: "native",
    usedBy: [],
    isNative: true,
  },
  {
    id: "native:::workflows",
    name: "Workflows",
    icon: "icon://flowchart",
    description: "Build and automate workflows",
    instances: 1,
    provider: "native",
    usedBy: [],
    isNative: true,
  },
  {
    id: "native:::tools",
    name: "Tools",
    icon: "icon://build",
    description: "Manage and configure your tools",
    instances: 1,
    provider: "native",
    usedBy: [],
    isNative: true,
  },
  {
    id: "native:::views",
    name: "Views",
    icon: "icon://web",
    description: "Custom views and pages",
    instances: 1,
    provider: "native",
    usedBy: [],
    isNative: true,
  },
  {
    id: "native:::files",
    name: "Files",
    icon: "icon://folder",
    description: "Manage and organize your files",
    instances: 1,
    provider: "native",
    usedBy: [],
    isNative: true,
  },
  {
    id: "native:::theme-editor",
    name: "Theme",
    icon: "icon://palette",
    description: "Customize your workspace colors and branding",
    instances: 1,
    provider: "native",
    usedBy: [],
    isNative: true,
  },
];

// Map native app names to their canonical titles for view matching
export const NATIVE_APP_NAME_MAP: Record<string, string> = {
  "native:::documents": "Documents",
  "native:::agents": "Agents",
  "native:::workflows": "Workflows",
  "native:::tools": "Tools",
  "native:::views": "Views",
  "native:::files": "Files",
  "native:::theme-editor": "Theme",
};

export function getConnectionAppKey(connection: Integration): AppKey {
  try {
    if (!connection.appName) {
      return {
        appId: connection.id,
        provider: "custom",
      };
    }
    if (WellKnownMcpGroupIds.some((id) => connection.id.startsWith(id))) {
      return AppKeys.parse(WELL_KNOWN_DECO_CMS_APP_KEY);
    }

    if (
      connection.id.startsWith(
        WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
      )
    ) {
      return AppKeys.parse(WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY);
    }

    if (connection.connection.type === "HTTP") {
      const url = new URL(connection.connection.url);

      if (url.hostname.includes("mcp.wppagent.com")) {
        return {
          appId: "WhatsApp",
          provider: "wppagent", // the same as deco? will use this for a "verified" badge
        };
      }
    }

    const { scopeName, name } = AppName.parse(
      connection.appName || connection.name,
    );

    return {
      appId: name,
      provider: scopeName,
    };
  } catch (err) {
    console.error("Could not get connection app key", err, connection);
    return {
      appId: connection.id,
      provider: "unknown",
    };
  }
}

function groupConnections(integrations: Integration[]) {
  const grouped: Record<string, Integration[]> = {};

  for (const integration of integrations) {
    const key = getConnectionAppKey(integration);

    const appKey = key.appId
      ? AppKeys.build(key)
      : `custom:::${integration.id}`;

    if (!grouped[appKey]) {
      grouped[appKey] = [];
    }

    grouped[appKey].push(integration);
  }

  return grouped;
}

export function useRefetchIntegrationsOnNotification({
  shouldFetch,
}: {
  shouldFetch?: boolean;
} = {}) {
  const { refetch: refetchIntegrations } = useIntegrations({
    shouldFetch,
  });

  useEffect(() => {
    if (shouldFetch === false) {
      return;
    }

    const handleMessage = (message: IntegrationMessage) => {
      if (message.type === "INTEGRATION_UPDATED") {
        refetchIntegrations();
      }
    };

    const cleanup = addIntegrationUpdateListener(handleMessage);
    return cleanup;
  }, [refetchIntegrations, shouldFetch]);
}

const isAgentIntegration = (integration: Integration) =>
  integration.connection.type === "HTTP" &&
  integration.connection.url?.includes("/agents/");

const isInnateIntegration = (integration: Integration) =>
  integration.connection.type === "INNATE";

export function useGroupedApps({ filter }: { filter: string }) {
  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplace } = useMarketplaceIntegrations();
  useRefetchIntegrationsOnNotification();

  const groupedApps: GroupedApp[] = useMemo(() => {
    const filteredIntegrations =
      installedIntegrations?.filter(
        (integration) =>
          integration.name.toLowerCase().includes(filter.toLowerCase()) &&
          !isAgentIntegration(integration) &&
          !isInnateIntegration(integration),
      ) ?? [];

    const grouped = groupConnections(filteredIntegrations);
    const apps: GroupedApp[] = [];

    for (const [key, integrations] of Object.entries(grouped)) {
      if (LEGACY_INTEGRATIONS.some((id) => key.endsWith(id))) {
        continue;
      }

      if (WELL_KNOWN_APPS[key]) {
        apps.push({ ...WELL_KNOWN_APPS[key], instances: integrations.length });
        continue;
      }

      const { appId, provider } = AppKeys.parse(key);
      const marketplaceApp = marketplace?.integrations?.find(
        (app) => app.id === appId && app.provider === provider,
      );

      if (marketplaceApp) {
        apps.push({
          id: key,
          name: marketplaceApp.name,
          icon: marketplaceApp.icon,
          description: marketplaceApp.description ?? "",
          instances: integrations.length,
          usedBy: [],
        });
        continue;
      }

      const firstInstance = integrations[0];
      if (firstInstance) {
        apps.push({
          id: key,
          name: firstInstance.name,
          icon: firstInstance.icon,
          description: firstInstance.description ?? "",
          instances: integrations.length,
          provider: "custom",
          usedBy: [],
        });
        continue;
      }

      apps.push({
        id: key,
        name: "Unknown",
        icon: "",
        description: "Unknown connection",
        instances: integrations.length,
        usedBy: [],
      });
    }

    // Add native apps at the beginning (filtered by search term)
    const filteredNativeApps = NATIVE_APPS.filter((app) =>
      app.name.toLowerCase().includes(filter.toLowerCase()),
    );

    return [...filteredNativeApps, ...apps];
  }, [installedIntegrations, filter, marketplace]);

  return groupedApps;
}

export function useGroupedApp({ appKey }: { appKey: string }) {
  const { data: installedIntegrations, refetch: refetchIntegrations } =
    useIntegrations();
  const app = maybeRegistryApp({
    app: AppKeys.toAppName(appKey),
  });
  useRefetchIntegrationsOnNotification();

  const instances = useMemo(() => {
    const grouped = groupConnections(installedIntegrations ?? []);
    return grouped[appKey];
  }, [installedIntegrations, appKey]);

  const info = useMemo<Partial<MarketplaceIntegration>>(() => {
    const wellKnownApp = WELL_KNOWN_APPS[appKey];
    if (wellKnownApp) {
      return wellKnownApp;
    }

    if (app) {
      return {
        ...app,
        description: app.description ?? "No description available",
        name: AppName.build(app.scopeName, app.name),
        provider: "marketplace",
      } satisfies MarketplaceIntegration;
    }

    const firstInstance = instances?.[0];
    if (firstInstance) {
      return {
        name: firstInstance.name,
        icon: firstInstance.icon,
        description: firstInstance.description ?? "",
        provider: "custom",
      };
    }

    return {
      name: "Unknown Connection",
      description: "No description available",
      provider: "unknown",
    };
  }, [appKey, instances]);

  return {
    info,
    instances,
    refetch: () => refetchIntegrations(),
  };
}
