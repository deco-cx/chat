import { listTools, useIntegrations } from "@deco/sdk";
import { useCallback } from "react";
import { useAgent } from "../components/agent/provider.tsx";
import { useRefetchIntegrationsOnNotification } from "../components/integrations/apps.ts";

export function useAgentSettingsToolsSet() {
  const { form, agent } = useAgent();
  const { data: _installedIntegrations } = useIntegrations();
  const installedIntegrations = _installedIntegrations.filter(
    (i) => !i.id.includes(agent.id),
  );
  const toolsSet = form.watch("tools_set");

  useRefetchIntegrationsOnNotification();

  const enableAllTools = useCallback(
    (integrationId: string) => {
      const toolsSet = form.getValues("tools_set");
      const newToolsSet = { ...toolsSet };
      // When enabling all tools, first set the tools to an empty array
      // so the integration is at least enabled even if fetching the tools fails
      newToolsSet[integrationId] = [];
      form.setValue("tools_set", newToolsSet, { shouldDirty: true });

      // account for optimistic update post connection creation
      // TODO: change to on success and track pending integrations to selectall
      setTimeout(() => {
        const connection = installedIntegrations.find(
          (integration) => integration.id === integrationId,
        )?.connection;

        if (!connection) {
          console.error("No connection found for integration", integrationId);
          return;
        }

        listTools(connection)
          .then((result) => {
            // If fetching goes well, update the form again
            newToolsSet[integrationId] = result.tools.map((tool) => tool.name);
            form.setValue("tools_set", newToolsSet, { shouldDirty: true });
          })
          .catch(console.error);
      }, 100);
      form.setValue("tools_set", newToolsSet, { shouldDirty: true });
    },
    [form, installedIntegrations],
  );

  const disableAllTools = useCallback(
    (integrationId: string) => {
      const toolsSet = form.getValues("tools_set");
      const newToolsSet = { ...toolsSet };
      delete newToolsSet[integrationId];
      form.setValue("tools_set", newToolsSet, { shouldDirty: true });
    },
    [form],
  );

  const setIntegrationTools = useCallback(
    (integrationId: string, tools: string[]) => {
      const toolsSet = form.getValues("tools_set");
      const newToolsSet = { ...toolsSet };
      newToolsSet[integrationId] = tools;
      form.setValue("tools_set", newToolsSet, { shouldDirty: true });
    },
    [form],
  );

  const appendIntegrationTool = useCallback(
    (integrationId: string, toolName: string) => {
      const toolsSet = form.getValues("tools_set");
      const newToolsSet = { ...toolsSet };
      const currentTools = newToolsSet[integrationId] || [];

      // Only add the tool if it's not already in the list
      if (!currentTools.includes(toolName)) {
        newToolsSet[integrationId] = [...currentTools, toolName];
        form.setValue("tools_set", newToolsSet, { shouldDirty: true });
      }
    },
    [form],
  );

  return {
    toolsSet,
    setIntegrationTools,
    appendIntegrationTool,
    enableAllTools,
    disableAllTools,
    installedIntegrations,
  };
}
