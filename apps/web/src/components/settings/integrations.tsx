import { Form } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useMemo, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { useAgentSettingsForm } from "../agent/edit.tsx";
import { SelectConnectionDialog } from "../integrations/select-connection-dialog.tsx";
import { IntegrationListItem } from "../toolsets/selector.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Integration } from "@deco/sdk";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { AppKeys, getConnectionAppKey } from "../integrations/apps.ts";

type SetIntegrationTools = (
  integrationId: string,
  tools: string[] | boolean,
) => void;

const ADVANCED_INTEGRATIONS = [
  "i:user-management",
  "i:workspace-management",
  "i:knowledge-base-standard",
  "DECO_INTEGRATIONS",
  "DECO_UTILS",
];

const connectionFilter = (integration: Integration) =>
  integration.id.startsWith("i:") ||
  ADVANCED_INTEGRATIONS.includes(integration.id);

function Connections({
  installedIntegrations,
  toolsSet,
  setIntegrationTools,
}: {
  installedIntegrations: Integration[];
  toolsSet: Record<string, string[]>;
  setIntegrationTools: SetIntegrationTools;
}) {
  const [search, setSearch] = useState("");
  const navigateWorkspace = useNavigateWorkspace();
  const onConfigureConnection = (integration: Integration) => {
    const appKey = AppKeys.build(getConnectionAppKey(integration));
    navigateWorkspace(`/connection/${appKey}?selected=${integration.id}`);
  };

  const activeIntegrations = installedIntegrations.filter((integration) =>
    !!toolsSet[integration.id]
  );
  const filteredIntegrations = activeIntegrations.filter((integration) => {
    const searchTerm = search.toLowerCase();
    return (
      integration?.name?.toLowerCase().includes(searchTerm) ||
      integration?.description?.toLowerCase().includes(searchTerm)
    );
  });

  const connections = filteredIntegrations.filter((integration) =>
    integration.id.startsWith("i:")
  );

  const showAddConnectionEmptyState = connections.length === 0;
  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Connections</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Connect and configure integrations to extend your agent's capabilities
          with external services.
        </span>
        {!showAddConnectionEmptyState && (
          <SelectConnectionDialog
            onSelect={(integration) =>
              setIntegrationTools(integration.id, true)}
            filter={connectionFilter}
            trigger={
              <Button variant="outline">
                <Icon name="add" /> Add connection
              </Button>
            }
          />
        )}
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
              <SelectConnectionDialog
                onSelect={(integration) =>
                  setIntegrationTools(integration.id, true)}
                filter={connectionFilter}
                trigger={
                  <Button variant="outline">
                    <Icon name="add" /> Add connection
                  </Button>
                }
              />
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
                    placeholder="Search"
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
                      integration={connection}
                      toolsSet={toolsSet}
                      setIntegrationTools={setIntegrationTools}
                      onConfigure={onConfigureConnection}
                      onRemove={(integrationId) =>
                        setIntegrationTools(integrationId, false)}
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

function Knowledge() {
  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Knowledge</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Directly attach files to the assistant knowledge base.
        </span>
      </div>
      <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
        <img
          src="/img/empty-state-agent-knowledge.svg"
          alt="No connections found"
          className="h-24 mb-4"
        />
        <Tooltip>
          <TooltipTrigger>
            <Button disabled variant="outline">
              <Icon name="add" /> Add files
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Coming soon</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}

function MultiAgent({
  installedIntegrations,
  toolsSet,
  setIntegrationTools,
}: {
  installedIntegrations: Integration[];
  toolsSet: Record<string, string[]>;
  setIntegrationTools: SetIntegrationTools;
}) {
  const navigateWorkspace = useNavigateWorkspace();
  const onConfigure = (connection: Integration) => {
    const agentId = connection.id.split("a:")[1];
    navigateWorkspace(`/agent/${agentId}/${crypto.randomUUID()}`);
  };

  const activeIntegrations = installedIntegrations.filter((integration) =>
    !!toolsSet[integration.id]
  );
  const agentConnections = activeIntegrations.filter((integration) =>
    integration.id.startsWith("a:")
  );
  const showAddAgentEmptyState = agentConnections.length === 0;

  const newAgentButton = (
    <SelectConnectionDialog
      title="Connect agent"
      filter={(integration) => integration.id.startsWith("a:")}
      onSelect={(integration) =>
        setIntegrationTools(integration.id, ["HANDOFF_AGENT"])}
      trigger={
        <Button variant="outline">
          <Icon name="add" /> Add agent
        </Button>
      }
    />
  );

  return (
    <div className="flex flex-col gap-2">
      <h6 className="text-sm font-medium">Multi-Agent</h6>
      <div className="flex justify-between items-center">
        <span className="block text-sm text-muted-foreground pb-2">
          Enable your agent to communicate with other agents for collaborative
          workflows.
        </span>
        {!showAddAgentEmptyState ? newAgentButton : null}
      </div>
      {showAddAgentEmptyState
        ? (
          <div className="flex flex-col gap-2 items-center justify-center h-full min-h-[200px] rounded-xl bg-muted border border-border border-dashed">
            {newAgentButton}
          </div>
        )
        : (
          <div className="space-y-2">
            <div className="flex-1">
              <div className="flex flex-col gap-2">
                {agentConnections.map((agentConnection) => (
                  <IntegrationListItem
                    key={agentConnection.id}
                    integration={agentConnection}
                    toolsSet={toolsSet}
                    setIntegrationTools={setIntegrationTools}
                    onConfigure={onConfigure}
                    onRemove={(integrationId) =>
                      setIntegrationTools(integrationId, false)}
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
  const {
    form,
    handleSubmit,
    installedIntegrations,
  } = useAgentSettingsForm();

  const toolsSet = form.watch("tools_set");
  const setIntegrationTools: SetIntegrationTools = (
    integrationId: string,
    tools: string[] | boolean,
  ) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };

    // Boolean means enable/disable all tools
    if (typeof tools === "boolean") {
      if (tools) {
        // enable all tools
        newToolsSet[integrationId] = [];
      } else {
        delete newToolsSet[integrationId];
      }
      form.setValue("tools_set", newToolsSet, { shouldDirty: true });
      return;
    }

    newToolsSet[integrationId] = tools;
    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  return (
    <ScrollArea className="h-full w-full">
      <Form {...form}>
        <div className="h-full w-full p-4 max-w-3xl mx-auto">
          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <Connections
              installedIntegrations={installedIntegrations}
              toolsSet={toolsSet}
              setIntegrationTools={setIntegrationTools}
            />
            <Knowledge />
            <MultiAgent
              installedIntegrations={installedIntegrations}
              toolsSet={toolsSet}
              setIntegrationTools={setIntegrationTools}
            />
          </form>
        </div>
      </Form>
    </ScrollArea>
  );
}

export default ToolsAndKnowledgeTab;
