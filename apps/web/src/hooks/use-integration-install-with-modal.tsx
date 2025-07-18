// deno-lint-ignore-file no-explicit-any
import { useState } from "react";
import {
  useCreateAPIKey,
  useCreateIntegration,
  useGetRegistryApp,
  useInstallFromMarketplace,
  usePermissionDescriptions,
} from "@deco/sdk/hooks";
import type { Integration } from "@deco/sdk/models";
import type { JSONSchema7 } from "json-schema";
import { useWorkspaceLink } from "./use-navigate-workspace.ts";

// Default policies required for all integrations
const DEFAULT_INTEGRATION_POLICIES = [
  { effect: "allow" as const, resource: "INTEGRATIONS_GET" },
  { effect: "allow" as const, resource: "DATABASES_RUN_SQL" },
];

interface InstallState {
  isModalOpen: boolean;
  scopes?: string[];
  stateSchema?: JSONSchema7;
  integrationName?: string;
  integration?: Integration;
  appName?: string;
  appId?: string;
  provider?: string;
}

export function useIntegrationInstallWithModal() {
  const [installState, setInstallState] = useState<InstallState>({
    isModalOpen: false,
  });

  const getLinkFor = useWorkspaceLink();
  const installMutation = useInstallFromMarketplace();
  const createIntegration = useCreateIntegration();
  const createAPIKey = useCreateAPIKey();
  const getRegistryApp = useGetRegistryApp();

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
        let scopes = result.scopes || [];

        // If no scopes were returned, try to get them from the registry app
        if (!scopes || scopes.length === 0) {
          try {
            const registryApp = await getRegistryApp.mutateAsync({
              name: params.appName,
            });

            // Check if the registry app has scope information
            // Note: This might not exist in the current schema, but we can check
            if (registryApp && "scopes" in registryApp) {
              scopes = (registryApp as any).scopes || [];
            }
          } catch (error) {
            console.warn("Failed to get registry app info:", error);
          }
        }

        setInstallState({
          isModalOpen: true,
          stateSchema: result.stateSchema as JSONSchema7,
          scopes: scopes,
          integrationName: params.appName,
          integration: result.integration,
          appName: params.appName,
          provider: params.provider,
        });
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

  const handleModalSubmit = async (formData: Record<string, unknown>) => {
    if (!installState.appName || !installState.provider) {
      throw new Error("Missing app name or provider");
    }

    try {
      // Step 1: Generate API key with required policies
      const installId = installState.integration?.id ?? crypto.randomUUID();
      const keyName = `${installState.appName}-${installId}`;

      const apiKey = await createAPIKey.mutateAsync({
        claims: {
          state: formData,
        },
        name: keyName,
        policies: [
          ...DEFAULT_INTEGRATION_POLICIES,
          ...(installState.scopes?.map((scope: string) => ({
            effect: "allow" as const,
            resource: scope,
          })) ?? []),
        ],
      });

      // Step 2: Get marketplace app info
      const marketplaceApp = await getRegistryApp.mutateAsync({
        name: installState.appName,
      });

      // Step 3: Create integration with marketplace info and API token
      const integrationData = {
        id: installId,
        name: marketplaceApp.friendlyName ?? marketplaceApp.name,
        description: marketplaceApp.description,
        icon: marketplaceApp.icon,
        connection: {
          ...marketplaceApp.connection,
          token: apiKey.value,
          // Merge form data into connection
          ...formData,
        }, // Type assertion to handle the connection type
      };

      await createIntegration.mutateAsync(integrationData);

      // Close modal after successful submission
      setInstallState((prev: InstallState) => ({
        ...prev,
        isModalOpen: false,
      }));

      // Step 4: Redirect to the connections page after a brief delay
      // This ensures all async operations are fully processed before redirect

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

  // Get all scopes (default + integration-specific)
  const getAllScopes = (scopes?: string[]): string[] => {
    return [
      ...DEFAULT_INTEGRATION_POLICIES.map((policy) => policy.resource),
      ...(scopes ?? installState.scopes ?? []),
    ];
  };

  // Get dynamic permission descriptions for all scopes
  const allScopes = getAllScopes(installState.scopes);
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
        createAPIKey.isPending ||
        getRegistryApp.isPending ||
        createIntegration.isPending ||
        permissionsLoading,
    },

    // Mutation state
    isLoading: installMutation.isPending,
    error: installMutation.error,
  };
}
