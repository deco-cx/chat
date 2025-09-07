import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  createIntegration,
  CreateIntegrationPayload,
  deleteIntegration,
  listIntegrations,
  loadIntegration,
  saveIntegration,
} from "../crud/mcp.ts";
import { InternalServerError } from "../errors.ts";
import { MCPClient } from "../fetcher.ts";
import type { Agent, Binder, Integration } from "../models/index.ts";
import { applyDisplayNameToIntegration } from "../utils/integration-display-name.ts";
import { KEYS } from "./api.ts";
import { type MCPTool } from "./index.ts";
import { useSDK } from "./store.tsx";

interface IntegrationToolsResult {
  integration: Integration;
  tools: MCPTool[];
  success: boolean;
}

export const useCreateIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (mcp: CreateIntegrationPayload) =>
      createIntegration(workspace, mcp),
    onSuccess: (result) => {
      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedResult = applyDisplayNameToIntegration(result, agents);

      // update item
      const itemKey = KEYS.INTEGRATION(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, processedResult);

      // update list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(listKey, (old) =>
        !old ? [processedResult] : [processedResult, ...old],
      );
    },
  });

  return create;
};

export const useUpdateIntegration = ({
  onError,
  onSuccess,
}: {
  onError?: (error: Error) => void;
  onSuccess?: (result: Integration) => void;
} = {}) => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = useMutation({
    mutationFn: (mcp: Integration) => saveIntegration(workspace, mcp),
    onSuccess: (result) => {
      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedResult = applyDisplayNameToIntegration(result, agents);

      // Update the individual MCP in cache
      const itemKey = KEYS.INTEGRATION(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, processedResult);

      // Update the list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(listKey, (old) =>
        !old
          ? [processedResult]
          : old.map((mcp) => (mcp.id === result.id ? processedResult : mcp)),
      );

      client.invalidateQueries({ queryKey: ["tools"] });

      onSuccess?.(result);
    },
    onError,
  });

  return update;
};

export const useRemoveIntegration = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteIntegration(workspace, id),
    onSuccess: (_, id) => {
      // Remove the individual MCP from cache
      const itemKey = KEYS.INTEGRATION(workspace, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      // Update the list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(listKey, (old) =>
        !old ? [] : old.filter((mcp) => mcp.id !== id),
      );
    },
  });

  return remove;
};

/** Hook for crud-like operations on MCPs */
export const useIntegration = (id: string) => {
  const { workspace } = useSDK();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace, id),
    queryFn: ({ signal }) => loadIntegration(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

export const useBindingIntegrations = (binder: Binder) => {
  const { workspace } = useSDK();
  return useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace, binder),
    queryFn: async ({ signal }) => {
      const integrations = await listIntegrations(
        workspace,
        { binder },
        signal,
      );
      return integrations;
    },
  });
};

/** Hook for listing all MCPs */
export const useIntegrations = ({ isPublic }: { isPublic?: boolean } = {}) => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useSuspenseQuery({
    queryKey: KEYS.INTEGRATION(workspace),

    queryFn: async ({ signal }) => {
      if (isPublic) {
        return [];
      }
      const items = await listIntegrations(workspace, {}, signal);

      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedItems = items.map((item) =>
        applyDisplayNameToIntegration(item, agents),
      );

      for (const item of processedItems) {
        const itemKey = KEYS.INTEGRATION(workspace, item.id);

        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Integration>(itemKey, item);
      }

      return processedItems;
    },
  });

  return data;
};

interface IntegrationsResult {
  integrations: Array<
    Integration & {
      provider: string;
      friendlyName?: string;
      verified?: boolean;
    }
  >;
}

export const useMarketplaceIntegrations = () => {
  const { workspace } = useSDK();

  return useSuspenseQuery<IntegrationsResult>({
    queryKey: ["integrations", "marketplace"],
    queryFn: () =>
      MCPClient.forWorkspace(workspace)
        .DECO_INTEGRATIONS_SEARCH({ query: "" })
        .then((r: IntegrationsResult | string) =>
          typeof r === "string" ? { integrations: [] } : r,
        ),
  });
};

const WELL_KNOWN_DECO_OAUTH_INTEGRATIONS = [
  "github",
  "googlesheets",
  "googlegmail",
  "googleyoutube",
  "googledocs",
  "googledrive",
  "googlesites",
  "airtable",
  "slack",
  "googlecalendar",
  "googleslides",
  "spotify",
];

export const useInstallFromMarketplace = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const mutation = useMutation<
    {
      integration: Integration;
      redirectUrl?: string | null;
      stateSchema?: unknown;
      scopes?: string[];
    },
    Error,
    { appName: string; returnUrl: string; provider: string }
  >({
    mutationFn: async ({
      appName,
      provider,
      returnUrl,
      appId,
    }: {
      appName: string;
      returnUrl: string;
      provider: string;
      appId?: string;
    }) => {
      const result: { installationId: string } = await MCPClient.forWorkspace(
        workspace,
      ).DECO_INTEGRATION_INSTALL({ id: appName, provider, appId });

      const integration = await loadIntegration(
        workspace,
        result.installationId,
      );

      let redirectUrl: string | null = null;

      if (
        (WELL_KNOWN_DECO_OAUTH_INTEGRATIONS.includes(appName.toLowerCase()) &&
          provider === "deco") ||
        provider === "marketplace"
      ) {
        const result = await MCPClient.forWorkspace(
          workspace,
        ).DECO_INTEGRATION_OAUTH_START({
          appName: appName,
          returnUrl,
          installId: integration.id.split(":").pop()!,
          provider,
        });

        // Handle both return types: { redirectUrl } or { stateSchema }
        if (result && "redirectUrl" in result) {
          redirectUrl = result.redirectUrl;
        } else if (result && "stateSchema" in result) {
          // Return integration with stateSchema for modal handling
          return {
            integration,
            stateSchema: result.stateSchema,
            scopes: result.scopes,
          };
        } else {
          throw new Error("Invalid OAuth response format");
        }
      }

      return { integration, redirectUrl };
    },
    onSuccess: ({ integration }) => {
      if (!integration) {
        return;
      }

      const agents = client.getQueryData<Agent[]>(KEYS.AGENT(workspace));
      const processedIntegration = applyDisplayNameToIntegration(
        integration,
        agents,
      );

      // update item
      const itemKey = KEYS.INTEGRATION(workspace, integration.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Integration>(itemKey, processedIntegration);

      // update list
      const listKey = KEYS.INTEGRATION(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<Integration[]>(listKey, (old) =>
        !old ? [processedIntegration] : [processedIntegration, ...old],
      );
    },
  });

  return mutation;
};

export const useMarketplaceAppSchema = (appName?: string) => {
  const { workspace } = useSDK();
  const canRunQuery = !!appName;

  return useQuery({
    queryKey: ["integrations", "marketplace", appName, "schema"],
    queryFn: () =>
      canRunQuery
        ? MCPClient.forWorkspace(workspace).DECO_GET_APP_SCHEMA({ appName })
        : null,
    enabled: canRunQuery,
  });
};

export const useCreateOAuthCodeForIntegration = () => {
  const mutation = useMutation({
    mutationFn: async (params: {
      integrationId: string;
      workspace: string;
      redirectUri: string;
      state?: string;
    }) => {
      const { integrationId, workspace, redirectUri, state } = params;

      const { code } = await MCPClient.forWorkspace(
        workspace,
      ).OAUTH_CODE_CREATE({
        integrationId,
      });

      const url = new URL(redirectUri);
      url.searchParams.set("code", code);
      state && url.searchParams.set("state", state);

      return {
        redirectTo: url.toString(),
      };
    },
  });

  return mutation;
};
