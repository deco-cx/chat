import {
  RegistryApp,
  useCreateAPIKey,
  useCreateIntegration,
  useGetRegistryApp,
  useInstallFromMarketplace,
  usePermissionDescriptions,
} from "@deco/sdk/hooks";
import type { Integration } from "@deco/sdk/models";
import type { JSONSchema7 } from "json-schema";
import { useState } from "react";
import { useWorkspaceLink } from "./use-navigate-workspace.ts";
import { useMutation } from "@tanstack/react-query";
import { createPolicyStatements, getAllScopes } from "../utils/scopes.ts";

interface InstallState {
  isModalOpen: boolean;
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

export function useIntegrationInstallWithModal() {
  const [installState, setInstallState] = useState<InstallState>({
    isModalOpen: false,
  });

  const getLinkFor = useWorkspaceLink();
  const installMutation = useInstallFromMarketplace();
  const getRegistryApp = useGetRegistryApp();

  const installCreatingApiKeyAndIntegration =
    useInstallCreatingApiKeyAndIntegration();

  const handleInstall = async (params: {
    appId: string;
    appName: string;
    provider: string;
    returnUrl: string;
  }) => {
    try {
      const result = await installMutation.mutateAsync(params);

      // If we get a stateSchema, show the modal
      if (result.stateSchema) {
        const scopes = result.scopes || [];

        setInstallState({
          isModalOpen: true,
          stateSchema: result.stateSchema as JSONSchema7,
          scopes: scopes,
          integrationName: params.appName,
          integration: result.integration,
          appName: params.appName,
          provider: params.provider,
        });
      }

      return result;
    } catch (error) {
      console.error("Installation failed:", error);
      throw error;
    }
  };

  const handleModalSubmit = async (formData: Record<string, unknown>) => {
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

      // Close modal after successful submission
      setInstallState((prev: InstallState) => ({
        ...prev,
        isModalOpen: false,
      }));

      const redirectPath = getLinkFor(`/connection/unknown:::${installId}`);
      globalThis.location.href = redirectPath;
    } catch (error) {
      console.error("Failed to complete setup:", error);
      throw error;
    }
  };

  const handleModalClose = () => {
    setInstallState((prev: InstallState) => ({ ...prev, isModalOpen: false }));
  };

  // Get dynamic permission descriptions for all scopes
  const allScopes = getAllScopes(
    installState.scopes ?? [],
    installState.stateSchema,
  );
  const { permissions: dynamicPermissions, isLoading: permissionsLoading } =
    usePermissionDescriptions(allScopes);

  return {
    // Install function
    install: handleInstall,

    // Modal state and handlers
    modalState: {
      isOpen: installState.isModalOpen,
      schema: installState.stateSchema,
      scopes: installState.scopes,
      permissions: dynamicPermissions,
      integrationName: installState.integrationName,
      integration: installState.integration,
      onSubmit: handleModalSubmit,
      onClose: handleModalClose,
      isLoading:
        installCreatingApiKeyAndIntegration.isPending ||
        getRegistryApp.isPending ||
        permissionsLoading,
    },

    // Mutation state
    isLoading: installMutation.isPending,
    error: installMutation.error,
  };
}
