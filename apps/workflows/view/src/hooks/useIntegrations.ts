/**
 * useIntegrations - Fetch all integrations and their tools
 * Uses runtime.ts for execution
 */

import { useQuery } from "@tanstack/react-query";
import { discoverTools } from "../lib/runtime";
import type { Integration } from "../types/workflow";

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: async (): Promise<Integration[]> => {
      console.log("🔍 [useIntegrations] Fetching tools...");
      try {
        const response = await discoverTools();
        console.log("🔍 [useIntegrations] Response:", response);

        const integrations = response.integrations || [];
        console.log("🔍 [useIntegrations] Raw integrations:", integrations);

        const mapped = integrations.map(
          (integration: {
            id: string;
            name: string;
            tools: Array<{ name: string; description: string }>;
          }) => ({
            id: integration.id,
            name: integration.name,
            tools: integration.tools.map((tool) => ({
              id: tool.name,
              name: tool.name,
              description: tool.description,
              integration: integration.id,
            })),
          }),
        );

        console.log("✅ [useIntegrations] Mapped integrations:", mapped);
        console.log(
          "✅ [useIntegrations] Total tools:",
          mapped.reduce((sum, i) => sum + (i.tools?.length || 0), 0),
        );
        return mapped;
      } catch (error) {
        console.error("❌ [useIntegrations] Error fetching tools:", error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
