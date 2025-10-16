/**
 * Hooks para integração com o sistema de tools/integrações.
 *
 * Estes hooks conectam a UI com as tools do server que fazem interface
 * com as integrações INTEGRATIONS, REGISTRY e APIKEYS.
 */
import { useQuery } from "@tanstack/react-query";
import { client } from "../lib/rpc";

export interface Tool {
  name: string;
  description?: string;
  inputSchema?: any;
  outputSchema?: any;
}
export interface Integration {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  tools?: Tool[];
}

// Tipos base para as tools
interface InstalledTool {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  access?: any;
}

interface AvailableTool {
  id: string;
  workspace: string;
  scopeId: string;
  scopeName: string;
  appName: string;
  name: string;
  description?: string;
  icon?: string;
  createdAt: string;
}

interface RegistryScope {
  id: string;
  scopeName: string;
  workspace: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Hook principal para listar integrations com tools
 * Usa LIST_INSTALLED_INTEGRATIONS e retorna formato compatível
 *
 * Optimizations:
 * - Longer stale time (10min) to reduce refetches
 * - Removed select function - data is already in correct format from API
 * - Structural sharing for better memoization
 * - Return early to avoid unnecessary processing
 */
export const useIntegrations = () => {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: async () => {
      // @ts-ignore - Will be typed after gen:self
      const result = await client.LIST_INSTALLED_INTEGRATIONS({});

      if (result.success && result.integrations) {
        // Ensure tools array exists for each integration
        // Do this ONCE in queryFn instead of on every render in select
        const normalized = result.integrations.map(
          (integration: Integration) => {
            // Only create new object if tools is missing
            if (!integration.tools) {
              return { ...integration, tools: [] };
            }
            return integration;
          },
        );

        return normalized as Integration[];
      }

      return [];
    },
    staleTime: 10 * 60 * 1000, // Cache 10 min (increased from 5)
    gcTime: 15 * 60 * 1000, // Keep in cache for 15 min after becoming unused
    retry: 2,
    // Enable structural sharing to prevent unnecessary re-renders
    structuralSharing: true,
    // Disable refetch on window focus to reduce API calls
    refetchOnWindowFocus: false,
  });
};

// Exportar types para uso em outros componentes
export type { InstalledTool, AvailableTool, RegistryScope };
