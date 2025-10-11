/**
 * Hook to generate mention items for Tiptap
 * Combines tools from integrations + previous workflow steps
 */
import { useMemo } from "react";
import { useIntegrations } from "./useIntegrations";
import type { Workflow } from "../types/workflow";

interface ToolItem {
  id: string;
  type: "tool";
  label: string;
  description?: string;
  category?: string;
  integration?: { id: string; name: string; icon?: string };
}

interface StepItem {
  id: string;
  type: "step";
  label: string;
  description?: string;
  category?: string;
}

export type MentionItem = ToolItem | StepItem;

export function useMentionItems(workflow?: Workflow): MentionItem[] {
  const { data: integrations = [], isLoading, error } = useIntegrations();

  console.log("🎯 [useMentionItems] Hook called with:", {
    integrationsCount: integrations.length,
    workflowSteps: workflow?.steps.length || 0,
    isLoading,
    error,
  });

  return useMemo(() => {
    const items: MentionItem[] = [];

    console.log(
      "🔨 [useMentionItems] Building items from integrations:",
      integrations,
    );

    // Add tools from integrations
    integrations.forEach((integration) => {
      console.log(
        "🔧 [useMentionItems] Processing integration:",
        integration.name,
        "Tools:",
        integration.tools?.length,
      );
      integration.tools?.forEach((tool) => {
        items.push({
          id: `@${tool.name}`,
          type: "tool",
          label: tool.name,
          description: tool.description,
          category: integration.name,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: undefined,
          },
        });
      });
    });

    // Add previous steps (if workflow provided)
    if (workflow) {
      console.log(
        "📦 [useMentionItems] Adding workflow steps:",
        workflow.steps.length,
      );
      workflow.steps.forEach((step, index) => {
        if (index < workflow.steps.length) {
          // Add the step reference without property suffix - user can type it
          items.push({
            id: `@${step.id}`,
            type: "step",
            label: `${step.title}`,
            description: `Reference output: @${step.id}.output`,
            category: "Previous Steps",
          });
        }
      });
    }

    console.log("✅ [useMentionItems] Final items:", {
      totalItems: items.length,
      tools: items.filter((i) => i.type === "tool").length,
      steps: items.filter((i) => i.type === "step").length,
      integrations: integrations.length,
      itemsList: items.map((i) => ({ id: i.id, label: i.label, type: i.type })),
    });

    return items;
  }, [integrations, workflow]);
}
