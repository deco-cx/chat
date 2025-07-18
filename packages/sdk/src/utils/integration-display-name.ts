import type { Agent, Integration } from "../models/index.ts";
import { WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH } from "../constants.ts";
import { extractAgentUuidFromKnowledgeBaseId } from "./knowledge.ts";

/**
 * Interface for providing custom names for integrations.
 *
 * To add a new integration name provider:
 * 1. Implement this interface
 * 2. Add your provider to the `createNameProviders` function
 *
 * @example
 * ```ts
 * class MyCustomProvider implements IntegrationNameProvider {
 *   canHandle(integration: Integration): boolean {
 *     return integration.id.startsWith("my-custom-prefix");
 *   }
 *
 *   getDisplayName(integration: Integration): string | undefined {
 *     return "My Custom Name";
 *   }
 * }
 * ```
 */
export interface IntegrationNameProvider {
  /**
   * Determines if this provider can handle the given integration
   */
  canHandle: (integration: Integration) => boolean;

  /**
   * Returns a custom display name for the integration, or undefined if the provider
   * cannot generate a name (fallback to original name)
   */
  getDisplayName: (integration: Integration) => string | undefined;
}

/**
 * Provider for knowledge base integrations that shows agent names
 */
export class KnowledgeBaseNameProvider implements IntegrationNameProvider {
  constructor(private agents: Agent[] | undefined) {}

  canHandle(integration: Integration): boolean {
    return integration.id.startsWith(
      WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
    );
  }

  getDisplayName(integration: Integration): string | undefined {
    const agentUuid = extractAgentUuidFromKnowledgeBaseId(integration.id);
    if (agentUuid && this.agents) {
      const agent = this.agents.find((a) => a.id === agentUuid);
      if (agent) {
        return `${agent.name} (knowledge base)`;
      }
    }
    return undefined;
  }
}

/**
 * Registry of all integration name providers.
 *
 * Add new providers here to extend the integration naming system.
 * Providers are evaluated in order, so more specific providers should come first.
 */
export function createNameProviders(
  agents: Agent[] | undefined,
): IntegrationNameProvider[] {
  return [new KnowledgeBaseNameProvider(agents)];
}

/**
 * Extended integration type that includes original name backup
 */
export type IntegrationWithDisplayName = Integration & { _name?: string };

/**
 * Applies display name logic to an integration using the provider system
 */
export function applyDisplayNameToIntegration(
  integration: Integration,
  agents?: Agent[],
): IntegrationWithDisplayName {
  const providers = createNameProviders(agents);

  // Try each provider in order
  for (const provider of providers) {
    if (provider.canHandle(integration)) {
      const customName = provider.getDisplayName(integration);
      if (customName) {
        return {
          ...integration,
          name: customName,
          _name: integration.name,
        };
      }
    }
  }

  // Fallback to original name if no provider handles it
  return integration;
}
