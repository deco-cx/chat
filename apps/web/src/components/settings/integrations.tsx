import { Form, FormItem } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useCallback, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { SelectConnectionDialog } from "../integrations/select-connection-dialog.tsx";
import { IntegrationListItem } from "../toolsets/selector.tsx";
import { type Integration, listTools, useIntegrations } from "@deco/sdk";
import { getKnowledgeBaseIntegrationId } from "@deco/sdk/utils";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import {
  AppKeys,
  getConnectionAppKey,
  useRefetchIntegrationsOnNotification,
} from "../integrations/apps.ts";
import {
  AddFileToKnowledgeButton,
  AgentKnowledgeBaseFileList,
  KnowledgeBaseFileList,
  type UploadFile,
  useAgentFiles,
} from "../agent/upload-knowledge-asset.tsx";

const ADVANCED_INTEGRATIONS = [
  "i:user-management",
  "i:workspace-management",
  getKnowledgeBaseIntegrationId("standard"),
  "DECO_INTEGRATIONS",
  "DECO_UTILS",
];

const connectionFilter = (integration: Integration) =>
  integration.id.startsWith("i:") ||
  ADVANCED_INTEGRATIONS.includes(integration.id);

function AddConnectionButton() {
  const { enableAllTools } = useAgentSettingsToolsSet();
  return (
    <SelectConnectionDialog
      onSelect={(integration) => enableAllTools(integration.id)}
      filter={connectionFilter}
      trigger={
        <Button variant="outline">
          <Icon name="add" /> Add connection
        </Button>
      }
    />
  );
}

function useConfigureConnection() {
  const navigateWorkspace = useNavigateWorkspace();
  return useCallback((integration: Integration) => {
    const appKey = AppKeys.build(getConnectionAppKey(integration));
    navigateWorkspace(`/connection/${appKey}?edit=${integration.id}`);
  }, [navigateWorkspace]);
}

function Connections() {
  const {
    toolsSet,
    setIntegrationTools,
    installedIntegrations,
    disableAllTools,
  } = useAgentSettingsToolsSet();
  const [search, setSearch] = useState("");

  const onConfigureConnection = useConfigureConnection();

  const connections = installedIntegrations
    .filter(connectionFilter)
    .filter((connection) => !!toolsSet[connection.id]);

  const showAddConnectionEmptyState = connections.length === 0 && !search;
  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Connections</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Connect and configure integrations to extend your agent's capabilities
          with external services.
        </span>
        {!showAddConnectionEmptyState && <AddConnectionButton />}
      </div>
      {showAddConnectionEmptyState
        ? (
          <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed relative overflow-hidden">
            <div className="absolute inset-0">
              <img
                src="/img/empty-state-agent-connections.svg"
                alt="No connections found"
                className="h-40"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-muted via-transparent to-muted" />
            </div>
            <div className="absolute z-10 flex flex-col items-center gap-2 bottom-6">
              <AddConnectionButton />
            </div>
          </div>
        )
        : (
          <>
            <div className="flex gap-2 w-full">
              <div className="border border-border rounded-lg w-full">
                <div className="flex items-center h-10 px-4 gap-2">
                  <Icon
                    name="search"
                    size={20}
                    className="text-muted-foreground"
                  />
                  <Input
                    placeholder="Search tools..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="flex-1 h-full border-none focus-visible:ring-0 placeholder:text-muted-foreground bg-transparent px-2"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex-1">
                <div className="flex flex-col gap-2">
                  {connections.map((connection) => (
                    <IntegrationListItem
                      key={connection.id}
                      toolsSet={toolsSet}
                      setIntegrationTools={setIntegrationTools}
                      integration={connection}
                      onConfigure={onConfigureConnection}
                      onRemove={(integrationId) =>
                        disableAllTools(integrationId)}
                      searchTerm={search}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
    </div>
  );
}

function KnowledgeHeading() {
  return (
    <>
      <h6 className="text-sm font-medium">Knowledge</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Directly attach files to the assistant knowledge base.
        </span>
      </div>
    </>
  );
}

// TODO: bring this back. The flow it buggs is adding a file to kb
// deno-lint-ignore  no-unused-vars
function Knowledge() {
  const { agent } = useAgentSettingsForm();
  const [uploadedFiles, setUploadedFiles] = useState<
    UploadFile[]
  >([]);
  const { data: files } = useAgentFiles(agent.id);

  if (files?.length === 0) {
    return (
      <div className="flex flex-col gap-2" key="empty-kb">
        <KnowledgeHeading />
        <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
          <img
            src="/img/empty-state-agent-knowledge.svg"
            alt="No connections found"
            className="h-24 mb-4"
          />
          <span className="text-sm text-muted-foreground">
            Supports: PDF, TXT, MD, CSV, JSON
          </span>
          <AddFileToKnowledgeButton
            agent={agent}
            onAddFile={setUploadedFiles}
          />
        </div>
      </div>
    );
  }

  return (
    <FormItem className="flex flex-col gap-2" key="files-kb">
      <div className="flex items-center gap-2">
        <div className="grow flex flex-col gap-2">
          <KnowledgeHeading />
        </div>

        <AddFileToKnowledgeButton agent={agent} onAddFile={setUploadedFiles} />
      </div>
      <AgentKnowledgeBaseFileList agentId={agent.id} />

      <div className="space-y-4">
        {/* Uploaded Files List */}
        <KnowledgeBaseFileList
          agentId={agent.id}
          files={uploadedFiles.map(({ file, uploading, file_url, docIds }) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            file_url: file_url,
            uploading,
            docIds,
          }))}
        />
      </div>
    </FormItem>
  );
}

function useConfigureAgentConnection() {
  const navigateWorkspace = useNavigateWorkspace();
  return useCallback((connection: Integration) => {
    const agentId = connection.id.split("a:")[1];
    navigateWorkspace(`/agent/${agentId}/${crypto.randomUUID()}`);
  }, [navigateWorkspace]);
}

const agentConnectionFilter = (integration: Integration) =>
  integration.id.startsWith("a:");

function AddAgentConnectionButton() {
  const { setIntegrationTools } = useAgentSettingsToolsSet();
  return (
    <SelectConnectionDialog
      title="Connect agent"
      filter={agentConnectionFilter}
      forceTab="my-connections"
      myConnectionsEmptyState={
        <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
          <div className="flex flex-col gap-2 pt-8">
            <h3 className="text-lg font-medium">
              No agents found
            </h3>
          </div>
        </div>
      }
      onSelect={(integration) =>
        setIntegrationTools(integration.id, ["HANDOFF_AGENT"])}
      trigger={
        <Button variant="outline">
          <Icon name="add" /> Add agent
        </Button>
      }
    />
  );
}

function MultiAgent() {
  const {
    toolsSet,
    setIntegrationTools,
    installedIntegrations,
    disableAllTools,
  } = useAgentSettingsToolsSet();
  const onConfigure = useConfigureAgentConnection();

  const agentConnections = installedIntegrations
    .filter(agentConnectionFilter)
    .filter((connection) => !!toolsSet[connection.id]);
  const showAddAgentEmptyState = agentConnections.length === 0;

  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Multi-Agent</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Enable your agent to communicate with other agents for collaborative
          workflows.
        </span>
        {!showAddAgentEmptyState ? <AddAgentConnectionButton /> : null}
      </div>
      {showAddAgentEmptyState
        ? (
          <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
            <AddAgentConnectionButton />
          </div>
        )
        : (
          <div className="space-y-2">
            <div className="flex-1">
              <div className="flex flex-col gap-2">
                {agentConnections.map((agentConnection) => (
                  <IntegrationListItem
                    key={agentConnection.id}
                    toolsSet={toolsSet}
                    setIntegrationTools={setIntegrationTools}
                    integration={agentConnection}
                    onConfigure={onConfigure}
                    onRemove={(integrationId) => disableAllTools(integrationId)}
                    hideTools
                  />
                ))}
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export function useAgentSettingsToolsSet() {
  const { form, agent } = useAgentSettingsForm();
  const { data: _installedIntegrations } = useIntegrations();
  const installedIntegrations = _installedIntegrations.filter(
    (i) => !i.id.includes(agent.id),
  );
  const toolsSet = form.watch("tools_set");

  useRefetchIntegrationsOnNotification();

  const enableAllTools = (integrationId: string) => {
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
        }).catch(console.error);
    }, 100);
    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  const disableAllTools = (integrationId: string) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };
    delete newToolsSet[integrationId];
    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  const setIntegrationTools = (
    integrationId: string,
    tools: string[],
  ) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };
    newToolsSet[integrationId] = tools;
    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  return {
    toolsSet,
    setIntegrationTools,
    enableAllTools,
    disableAllTools,
    installedIntegrations,
  };
}

function ToolsAndKnowledgeTab() {
  const {
    form,
    handleSubmit,
  } = useAgentSettingsForm();

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <Connections />
            {/* TODO: bring this back. The flow it buggs is adding a file to kb <Knowledge /> */}
            <MultiAgent />
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default ToolsAndKnowledgeTab;
