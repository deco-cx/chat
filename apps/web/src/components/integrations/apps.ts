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
  useIntegrations,
  useMarketplaceIntegrations,
} from "@deco/sdk";
import { useMemo } from "react";

export interface GroupedApp {
  id: string;
  name: string;
  icon?: string;
  description: string;
  instances: number;
  usedBy: { avatarUrl: string }[];
}

export interface AppKey {
  appId: string;
  provider: string;
}

export const AppKeys = {
  build: (key: AppKey) => `${key.provider}:::${key.appId}`,
  parse: (key: string) => {
    const [provider, appId] = key.split(":::");
    return {
      appId,
      provider,
    } as AppKey;
  },
};

export const WELL_KNOWN_DECO_CHAT_APP_KEY = AppKeys.build({
  appId: "deco.chat",
  provider: "deco",
});

export const WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY = AppKeys.build({
  appId: "knowledge-bases",
  provider: "deco",
});

export const WELL_KNOWN_APPS: Record<string, GroupedApp> = {
  [WELL_KNOWN_DECO_CHAT_APP_KEY]: {
    id: WELL_KNOWN_DECO_CHAT_APP_KEY,
    name: "Deco Chat",
    icon:
      "https://assets.decocache.com/mcp/306fcf27-d5dd-4d8c-8ddd-567d763372ee/decochat.png",
    description: "Native deco.chat tools.",
    instances: 1,
    usedBy: [],
  },
  [WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY]: {
    id: WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY,
    name: "Knowledge Base",
    icon:
      "https://assets.decocache.com/mcp/85269424-f5c7-4473-a67e-c3d6a120f586/knowledgebase.png",
    description: "Native knowledge base tools",
    instances: 1,
    usedBy: [],
  },
} as const;

const WELL_KNOWN_DECO_CHAT_CONNECTION_IDS = [
  "i:workspace-management",
  "i:user-management",
];

const WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH = "i:knowledge-base";

export function isWellKnownApp(appKey: string): boolean {
  return WELL_KNOWN_DECO_CHAT_APP_KEY === appKey ||
    WELL_KNOWN_KNOWLEDGE_BASE_APP_KEY === appKey;
}

export function getConnectionAppKey(connection: Integration): AppKey {
  try {
    if (
      WELL_KNOWN_DECO_CHAT_CONNECTION_IDS.some((id) =>
        connection.id.startsWith(id)
      )
    ) {
      return AppKeys.parse(WELL_KNOWN_DECO_CHAT_APP_KEY);
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

      if (url.hostname.includes("mcp.deco.site")) {
        // https://mcp.deco.site/apps/{appName}...
        const appName = url.pathname.split("/")[2];
        return {
          appId: decodeURIComponent(appName),
          provider: "deco",
        };
      }

      if (url.hostname.includes("mcp.wppagent.com")) {
        return {
          appId: "WhatsApp",
          provider: "wppagent", // the same as deco?
        };
      }

      return {
        appId: connection.id,
        provider: "unknown",
      };
    }

    if (connection.connection.type === "SSE") {
      const url = new URL(connection.connection.url);

      if (url.hostname.includes("mcp.composio.dev")) {
        // https://mcp.composio.dev/{appName}...
        const parts = url.pathname.split("/");

        const appName = parts[1] === "partner" ? parts[3] : parts[1];

        return {
          appId: appName,
          provider: "composio",
        };
      }

      return {
        appId: connection.id,
        provider: "unknown",
      };
    }

    return {
      appId: connection.id,
      provider: "unknown",
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
    const appKey = AppKeys.build(key);

    if (!grouped[appKey]) {
      grouped[appKey] = [];
    }

    grouped[appKey].push(integration);
  }

  return grouped;
}

export function useGroupedApps({
  filter,
}: {
  filter: string;
}) {
  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplace } = useMarketplaceIntegrations();

  const groupedApps: GroupedApp[] = useMemo(() => {
    const filteredIntegrations = installedIntegrations?.filter((integration) =>
      integration.name.toLowerCase().includes(filter.toLowerCase()) &&
      integration.connection.type !== "INNATE"
    ) ?? [];

    const grouped = groupConnections(filteredIntegrations);
    const apps: GroupedApp[] = [];

    for (const [key, integrations] of Object.entries(grouped)) {
      if (WELL_KNOWN_APPS[key]) {
        apps.push(WELL_KNOWN_APPS[key]);
        continue;
      }

      const { appId, provider } = AppKeys.parse(key);
      const marketplaceApp = marketplace?.integrations?.find((app) =>
        app.id === appId && app.provider === provider
      );

      apps.push({
        id: key,
        name: marketplaceApp?.name ?? "Unknown",
        icon: marketplaceApp?.icon ?? integrations[0].icon,
        description: marketplaceApp?.description ?? "description",
        instances: integrations.length,
        usedBy: [],
      });
    }

    return apps;
  }, [installedIntegrations, filter]);

  return groupedApps;
}

export function useGroupedApp({
  appKey,
}: {
  appKey: string;
}) {
  const { data: installedIntegrations } = useIntegrations();
  const { data: marketplace } = useMarketplaceIntegrations();

  const instances = useMemo(() => {
    const grouped = groupConnections(installedIntegrations ?? []);
    return grouped[appKey];
  }, [installedIntegrations, appKey]);

  const info = useMemo(() => {
    const wellKnownApp = WELL_KNOWN_APPS[appKey];
    if (wellKnownApp) {
      return wellKnownApp;
    }

    const marketplaceApp = marketplace?.integrations?.find((app) =>
      AppKeys.build({
        appId: app.id,
        provider: app.provider,
      }) === appKey
    );

    return {
      name: marketplaceApp?.name ?? "Unknown",
      icon: marketplaceApp?.icon ?? instances[0].icon,
      description: marketplaceApp?.description ?? "description",
    };
  }, [marketplace, appKey]);

  return {
    info,
    instances,
  };
}
