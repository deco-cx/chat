import {
  RegistryApp,
  useCreateAPIKey,
  useCreateIntegration,
  useGetRegistryApp,
  useInstallFromMarketplace,
  useMarketplaceAppSchema,
  usePermissionDescriptions,
} from "@deco/sdk/hooks";
import type { Integration } from "@deco/sdk/models";
import type { JSONSchema7 } from "json-schema";
import { useState as _useState } from "react";
import { useWorkspaceLink } from "./use-navigate-workspace.ts";
import { useMutation } from "@tanstack/react-query";
import { createPolicyStatements, getAllScopes } from "../utils/scopes.ts";

interface InstallState {
  scopes?: string[];
  stateSchema?: JSONSchema7;
  integrationName?: string;
  integration?: Integration;
  appName?: string;
  appId?: string;
  vendor?: string;
  provider?: string;
}

export const useInstallCreatingApiKeyAndIntegration = () => {
  const createAPIKey = useCreateAPIKey();
  const createIntegration = useCreateIntegration();

  const mutation = useMutation({
    mutationFn: async ({
      clientId,
      app,
      formData,
      scopes,
      installId: inlineInstallId,
    }: {
      clientId: string;
      app: RegistryApp;
      formData: Record<string, unknown>;
      scopes: string[];
      installId?: string;
    }) => {
      const installId = inlineInstallId ?? crypto.randomUUID();
      const keyName = `${app.name}-${installId}`;

      const appName = clientId;

      const apiKey = await createAPIKey.mutateAsync({
        claims: {
          state: formData,
          integrationId: installId,
          appName,
        },
        name: keyName,
        policies: createPolicyStatements(scopes ?? [], formData),
      });

      const integrationData = {
        id: installId,
        name: app.friendlyName ?? app.name,
        description: app.description,
        icon: app.icon,
        connection: {
          ...app.connection,
          token: apiKey.value,
          // Merge form data into connection
          ...formData,
        }, // Type assertion to handle the connection type
      };

      const integration = await createIntegration.mutateAsync({
        ...integrationData,
        clientIdFromApp: appName,
      });

      return integration;
    },
  });

  return mutation;
};

export function useIntegrationInstall(appName?: string) {
  const { data: appSchema } = useMarketplaceAppSchema(appName);
  const getLinkFor = useWorkspaceLink();
  const installMutation = useInstallFromMarketplace();
  const getRegistryApp = useGetRegistryApp();

  const installCreatingApiKeyAndIntegration =
    useInstallCreatingApiKeyAndIntegration();

  const handleInstall = async (
    params: {
      appId: string;
      appName: string;
      provider: string;
      returnUrl: string;
    },
    formData: Record<string, unknown> | null,
  ) => {
    try {
      const result = await installMutation.mutateAsync(params);

      // If we get a stateSchema, show the modal
      if (result.stateSchema) {
        const scopes = result.scopes || [];

        const installState: InstallState = {
          stateSchema: result.stateSchema as JSONSchema7,
          scopes: scopes,
          integrationName: params.appName,
          integration: result.integration,
          appName: params.appName,
          provider: params.provider,
        };

        if (formData) {
          await setupAppOauth(formData, installState);
        }
      } else if (result.redirectUrl) {
        // Handle redirect URL as before
        globalThis.location.href = result.redirectUrl;
      }

      return result;
    } catch (error) {
      console.error("Installation failed:", error);
      throw error;
    }
  };

  const setupAppOauth = async (
    formData: Record<string, unknown>,
    installState: InstallState,
  ) => {
    if (!installState.appName || !installState.provider) {
      throw new Error("Missing app name or provider");
    }

    try {
      // Step 1: Generate API key with required policies
      const installId = installState.integration?.id ?? crypto.randomUUID();
      // Step 2: Get marketplace app info
      const marketplaceApp = await getRegistryApp.mutateAsync({
        name: installState.appName,
      });

      await installCreatingApiKeyAndIntegration.mutateAsync({
        clientId: installState.appName,
        app: marketplaceApp,
        formData,
        scopes: installState.scopes ?? [],
        installId,
      });

      const redirectPath = getLinkFor(`/connection/unknown:::${installId}`);
      globalThis.location.href = redirectPath;
    } catch (error) {
      console.error("Failed to complete setup:", error);
      throw error;
    }
  };

  const integrationSchema = appSchema?.schema as JSONSchema7;
  const integrationScopes = appSchema?.scopes ?? [];
  // Get dynamic permission descriptions for all scopes
  const allScopes = getAllScopes(integrationScopes, integrationSchema);
  const { permissions: dynamicPermissions, isLoading: permissionsLoading } =
    usePermissionDescriptions(allScopes);

  return {
    // Install function
    install: handleInstall,

    // // Modal state and handlers
    integrationState: {
      schema: integrationSchema,
      scopes: integrationScopes,
      permissions: dynamicPermissions,
      integrationName: installMutation.variables?.appName,
      integration: installMutation.data?.integration,
      isLoading:
        installCreatingApiKeyAndIntegration.isPending ||
        getRegistryApp.isPending ||
        permissionsLoading,
    },

    // Mutation state
    isLoading:
      installMutation.isPending ||
      installCreatingApiKeyAndIntegration.isPending ||
      getRegistryApp.isPending,
    error: installMutation.error,
  };
}
