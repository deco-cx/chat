/**
 * Hook to generate mention items for Tiptap
 * Combines tools from integrations + previous workflow steps
 *
 * OPTIMIZED: Use specific dependencies instead of entire objects
 */
import { useMemo } from "react";
import { useIntegrations } from "./useIntegrations";
import { WorkflowStep } from "shared/types/workflows";
import { useCurrentWorkflow } from "@/store/workflow";

interface ToolItem {
  id: string;
  type: "tool";
  label: string;
  description?: string;
  category?: string;
  integration?: { id: string; name: string; icon?: string };
  inputSchema?: any;
  outputSchema?: any;
}

interface StepItem {
  id: string;
  type: "step";
  label: string;
  description?: string;
  category?: string;
}

export type MentionItem = ToolItem | StepItem;

/**
 * Hook to get tools from integrations (does not require workflow context)
 */
export function useToolItems(): ToolItem[] {
  const { data: integrations = [] } = useIntegrations();

  // OPTIMIZATION: Create stable string key for integrations to prevent recalculation
  const integrationsKey = useMemo(
    () => integrations.map((i) => `${i.id}:${i.tools?.length || 0}`).join(","),
    [integrations],
  );

  return useMemo(() => {
    const items: ToolItem[] = [];

    // Add tools from integrations
    integrations.forEach((integration) => {
      integration.tools?.forEach((tool) => {
        items.push({
          id: `@${integration.id}:${tool.name}`,
          type: "tool",
          label: tool.name,
          description: tool.description,
          category: integration.name,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
          },
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        });
      });
    });

    return items;
  }, [integrationsKey, integrations]);
}

/**
 * Hook to get all mention items including workflow steps
 * Requires WorkflowStoreProvider context
 */
export function useMentionItems(options?: {
  includeSteps?: boolean;
}): MentionItem[] {
  const toolItems = useToolItems();
  const includeSteps = options?.includeSteps ?? true;

  // For compatibility - if includeSteps is false, just return tool items
  if (!includeSteps) {
    return toolItems;
  }

  // This requires workflow context - will throw if not available
  const workflow = useCurrentWorkflow();
  const workflowSteps = workflow?.steps;

  const stepsKey = useMemo(
    () => workflowSteps?.map((s) => s.def?.name).join(",") || "",
    [workflowSteps],
  );

  return useMemo(() => {
    const items: MentionItem[] = [];

    // Add previous steps FIRST - they get priority in the dropdown
    if (workflowSteps?.length) {
      workflowSteps.forEach((step: WorkflowStep) => {
        items.push({
          id: `@${step.def?.name}`,
          type: "step",
          label: `${step.def?.name}`,
          description: `Reference output: @${step.def?.name}.output`,
          category: "Previous Steps",
        });
      });
    }

    // Add tools from integrations after steps
    items.push(...toolItems);

    return items;
  }, [stepsKey, workflowSteps, toolItems]);
}
