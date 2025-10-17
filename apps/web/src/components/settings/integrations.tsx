import { type Integration, useKnowledgeListFiles } from "@deco/sdk";
import { getExtensionFromContentType, KnowledgeBaseID } from "@deco/sdk/utils";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Form,
  FormDescription,
  FormItem,
  FormLabel,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { LEGACY_INTEGRATIONS } from "../../constants.ts";
import { useAgentSettingsToolsSet } from "../../hooks/use-agent-settings-tools-set.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import {
  type UploadFile,
  useAgentKnowledgeIntegration,
  useUploadAgentKnowledgeFiles,
} from "../agent/hooks/use-agent-knowledge.ts";
import { useAgenticChat, useAgenticChatForm } from "../chat/provider.tsx";
import {
  AddFileToKnowledgeButton,
  KnowledgeBaseFileList,
  type KnowledgeFile,
} from "../agent/upload-knowledge-asset.tsx";
import { AppKeys, getConnectionAppKey } from "../integrations/apps.ts";
import { SelectConnectionDialog } from "../integrations/select-connection-dialog.tsx";
import { IntegrationListItem } from "../toolsets/selector.tsx";

const ADVANCED_INTEGRATIONS = [
  ...LEGACY_INTEGRATIONS,
  KnowledgeBaseID.format("standard"),
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
          <Icon name="add" /> Add integration
        </Button>
      }
    />
  );
}

function useConfigureConnection() {
  const navigateWorkspace = useNavigateWorkspace();
  return useCallback(
    (integration: Integration) => {
      const appKey = AppKeys.build(getConnectionAppKey(integration));
      navigateWorkspace(`/apps/${appKey}?edit=${integration.id}`);
    },
    [navigateWorkspace],
  );
}

function Integrations() {
  const {
    toolsSet,
    setIntegrationTools,
    installedIntegrations,
    disableAllTools,
  } = useAgentSettingsToolsSet();
  const [_search, setSearch] = useState("");
  const search = useDeferredValue(_search.toLowerCase());

  const onConfigureConnection = useConfigureConnection();

  const connections = installedIntegrations
    .filter(connectionFilter)
    .filter((connection) => !!toolsSet[connection.id]);

  const showAddConnectionEmptyState = connections.length === 0 && !search;
  return (
    <div className="flex flex-col gap-2">
      <FormLabel>Integrations</FormLabel>
      <div className="flex justify-between items-center">
        <FormDescription className="pb-2">
          Connect and configure integrations to extend your agent's capabilities
          with external services.
        </FormDescription>
        {!showAddConnectionEmptyState && <AddConnectionButton />}
      </div>
      {showAddConnectionEmptyState ? (
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
      ) : (
        <>
          <div className="flex gap-2 w-full">
            <div className="border border-border rounded-xl w-full">
              <div className="flex items-center h-10 px-4 gap-2">
                <Icon
                  name="search"
                  size={20}
                  className="text-muted-foreground"
                />
                <Input
                  placeholder="Search tools..."
                  value={_search}
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
                    onRemove={(integrationId) => disableAllTools(integrationId)}
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
      <FormLabel>Knowledge</FormLabel>
      <div className="flex justify-between items-center">
        <FormDescription className="pb-2">
          Directly attach files to the assistant knowledge base.
        </FormDescription>
      </div>
    </>
  );
}

function _Knowledge() {
  const { agent } = useAgenticChat();
  const { setIntegrationTools } = useAgentSettingsToolsSet();
  const [uploadingFiles, setUploadedFiles] = useState<UploadFile[]>([]);
  const { integration } = useAgentKnowledgeIntegration({ agent });
  const { data: files, isLoading } = useKnowledgeListFiles({
    connection: integration?.connection,
  });
  const { uploadKnowledgeFiles } = useUploadAgentKnowledgeFiles({
    agent,
    onAddFile: setUploadedFiles,
    setIntegrationTools,
  });

  const formatedFiles = useMemo<KnowledgeFile[]>(
    () =>
      files
        ? files.map((file) => ({
            fileUrl: file.fileUrl,
            ...file.metadata,
            name: file.filename,
            status: file.status,
          }))
        : [],
    [files],
  );

  // Combine uploaded files with uploading files (uploading files come after uploaded files)
  // Filter out uploading files that already exist in uploaded files based on file_url
  const allFiles = useMemo<KnowledgeFile[]>(() => {
    const uploadedFileUrls = new Set(formatedFiles.map((file) => file.fileUrl));

    const filteredUploadingFiles = uploadingFiles
      .filter(
        ({ fileUrl: file_url }) => !file_url || !uploadedFileUrls.has(file_url),
      )
      .map(
        ({ file, uploading, fileUrl }): KnowledgeFile => ({
          name: file.name,
          fileType: getExtensionFromContentType(file.type),
          fileSize: file.size,
          fileUrl: fileUrl ?? file.name,
          uploading,
        }),
      );

    return [...formatedFiles, ...filteredUploadingFiles];
  }, [formatedFiles, uploadingFiles]);

  // Show empty view only if there are no uploaded files AND no uploading files
  const hasNoFiles =
    (files?.length === 0 || !files) && uploadingFiles.length === 0;

  // Disable add file button when loading on first request and has no files
  const shouldDisableAddButton = isLoading && hasNoFiles;

  if (hasNoFiles) {
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
            uploadKnowledgeFiles={uploadKnowledgeFiles}
            disabled={shouldDisableAddButton}
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

        <AddFileToKnowledgeButton
          uploadKnowledgeFiles={uploadKnowledgeFiles}
          disabled={shouldDisableAddButton}
        />
      </div>
      <KnowledgeBaseFileList
        agentId={agent.id}
        files={allFiles}
        integration={integration}
      />
    </FormItem>
  );
}

function useConfigureAgentConnection() {
  const navigateWorkspace = useNavigateWorkspace();
  return useCallback(
    (connection: Integration) => {
      const agentId = connection.id.split("a:")[1];
      navigateWorkspace(`/agent/${agentId}/${crypto.randomUUID()}`);
    },
    [navigateWorkspace],
  );
}

const agentConnectionFilter = (integration: Integration) =>
  integration.id.startsWith("a:");

function AddAgentConnectionButton() {
  const { setIntegrationTools } = useAgentSettingsToolsSet();
  const { agent } = useAgenticChat();

  return (
    <SelectConnectionDialog
      title="Connect agent"
      // Filter in only agents
      // Filter out the current agent opened
      filter={(connection) =>
        agentConnectionFilter(connection) && connection.id !== `a:${agent.id}`
      }
      forceTab="my-connections"
      myConnectionsEmptyState={
        <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
          <div className="flex flex-col gap-2 pt-8">
            <h3 className="text-lg font-medium">No agents found</h3>
          </div>
        </div>
      }
      onSelect={(integration) =>
        setIntegrationTools(integration.id, ["AGENT_GENERATE_TEXT"])
      }
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
      <FormLabel>Multi-Agent</FormLabel>
      <div className="flex justify-between items-center">
        <FormDescription className="pb-2">
          Enable your agent to communicate with other agents for collaborative
          workflows.
        </FormDescription>
        {!showAddAgentEmptyState ? <AddAgentConnectionButton /> : null}
      </div>
      {showAddAgentEmptyState ? (
        <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
          <AddAgentConnectionButton />
        </div>
      ) : (
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

function ToolsAndKnowledgeTab() {
  const { saveAgent } = useAgenticChat();
  const form = useAgenticChatForm();

  const handleSubmit = form.handleSubmit(async () => {
    await saveAgent();
  });

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Integrations />
            {/* TODO: bring this back. The flow it buggs is adding a file to kb <Knowledge /> */}
            {/* <Knowledge /> */}
            <MultiAgent />
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default ToolsAndKnowledgeTab;
