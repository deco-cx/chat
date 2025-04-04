import { type Agent, SDK, toAgentRoot } from "@deco/sdk";
import {
  WELL_KNOWN_DEFAULT_INTEGRATION_TOOLS,
  WELL_KNOWN_INITIAL_TOOLS_SET,
} from "@deco/sdk/constants";
import { useAgent, useIntegration, useIntegrations } from "@deco/sdk/hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useState } from "react";
import { AgentAvatar } from "../common/Avatar.tsx";
import { Integration } from "./integrations/index.tsx";

const inputStyles =
  "rounded-lg border-input focus:none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-input focus-visible:outline-none";

// Token limits for Anthropic models
const ANTHROPIC_DEFAULT_MAX_TOKENS = 8192;
const ANTHROPIC_MIN_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_MAX_TOKENS = 64000;

function IntegrationItem({
  integrationId,
  onToolToggle,
  setIntegrationTools,
  agent,
  localAgent,
}: {
  integrationId: string;
  onToolToggle: (
    integrationId: string,
    toolId: string,
    checked: boolean,
  ) => void;
  setIntegrationTools: (
    integrationId: string,
    tools: string[],
  ) => void;
  agent: Agent;
  localAgent: Agent;
}) {
  const { data: integration } = useIntegration(integrationId);

  if (!integration) {
    return null;
  }

  return (
    <Integration
      key={integration.id}
      integration={integration}
      onToolToggle={onToolToggle}
      setIntegrationTools={setIntegrationTools}
      agent={agent}
      localAgent={localAgent}
    />
  );
}

function App({ agentId }: { agentId: string }) {
  const { data: agent, update, error, loading } = useAgent(agentId);
  const { items: installedIntegrations } = useIntegrations();
  const [agentRoot, setAgentRoot] = useState<string | null>(null);
  const [localAgent, setLocalAgent] = useState<typeof agent | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let cancel = false;

    const init = async () => {
      const resolved = await SDK.fs.resolvePath(toAgentRoot(agentId));

      if (cancel) return;

      setAgentRoot(resolved);
    };

    init().catch(console.error);

    return () => {
      cancel = true;
    };
  }, [agentId]);

  useEffect(() => {
    if (agent && !localAgent) {
      setLocalAgent(JSON.parse(JSON.stringify(agent)));
    }
  }, [agent, localAgent]);

  const hasFieldChanged = (field: keyof NonNullable<typeof agent>) => {
    return agent && localAgent && localAgent[field] !== agent[field];
  };

  const countChanges = () => {
    if (!agent || !localAgent) return 0;
    let count = 0;

    const fields: (keyof NonNullable<typeof agent>)[] = [
      "name",
      "description",
      "instructions",
      "max_tokens",
      "avatar",
    ];
    count += fields.filter((field) => hasFieldChanged(field)).length;

    const originalTools = agent.tools_set;
    const localTools = localAgent.tools_set;

    Object.entries(originalTools).forEach(([key, tools]) => {
      const localToolsForIntegration = localTools[key] || [];
      count += tools.filter((tool) =>
        !localToolsForIntegration.includes(tool)
      ).length;
      count +=
        localToolsForIntegration.filter((tool) => !tools.includes(tool)).length;
    });

    Object.keys(localTools).forEach((key) => {
      if (!originalTools[key]) {
        count += localTools[key].length;
      }
    });

    return count;
  };

  // Function to handle save
  const handleSave = async () => {
    if (!localAgent) return;
    await update(localAgent);
    setIsDirty(false);
  };

  // Modified update wrapper to only update local state
  const handleUpdate = (changes: Partial<typeof agent>) => {
    if (!localAgent) return;
    setLocalAgent({ ...localAgent, ...changes });
    setIsDirty(true);
  };

  const handleToolToggle = (
    integrationId: string,
    toolId: string,
    checked: boolean,
  ) => {
    if (!localAgent) return;

    const currentTools = localAgent.tools_set[integrationId] || [];
    const updatedTools = checked
      ? [...currentTools, toolId]
      : currentTools.filter((tool) => tool !== toolId);

    setLocalAgent({
      ...localAgent,
      tools_set: {
        ...localAgent.tools_set,
        [integrationId]: updatedTools,
      },
    });
    setIsDirty(true);
  };

  const setIntegrationTools = (
    integrationId: string,
    tools: string[],
  ) => {
    if (!localAgent) return;

    setLocalAgent({
      ...localAgent,
      tools_set: {
        ...localAgent.tools_set,
        [integrationId]: tools,
      },
    });
    setIsDirty(true);
  };

  const handleResetIntegrations = () => {
    if (!localAgent) return;

    setLocalAgent({
      ...localAgent,
      tools_set: WELL_KNOWN_INITIAL_TOOLS_SET,
    });
    setIsDirty(true);
  };

  const integrations = Object.keys(WELL_KNOWN_DEFAULT_INTEGRATION_TOOLS)
    .concat(installedIntegrations || []);

  if (loading || !agent || !agentRoot) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center">
        <div className="relative">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        Error loading agent: {typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "bg-gradient-to-b from-white to-slate-50 p-6 text-slate-700 relative rounded-xl",
        isDirty ? "pb-32" : "pb-20",
      )}
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-6">
          {/* Avatar Section */}
          <div className="flex justify-center">
            <div className="h-20 w-20">
              <AgentAvatar
                name={agent.name}
                avatar={agent.avatar}
                className="rounded-lg"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={localAgent?.name || ""}
                onChange={(e) => handleUpdate({ name: e.target.value })}
                placeholder="Enter agent name"
                className={inputStyles}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={localAgent?.description || ""}
                onChange={(e) => handleUpdate({ description: e.target.value })}
                className={cn(inputStyles, "min-h-36")}
                placeholder="Describe your agent's purpose"
              />
              <p className="text-sm text-slate-500">
                Used only for organization and search, it does not affect the
                agent's behaviour
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">System Prompt</Label>
              <Textarea
                id="instructions"
                value={localAgent?.instructions || ""}
                onChange={(e) => handleUpdate({ instructions: e.target.value })}
                className={cn(inputStyles, "min-h-36")}
                placeholder="Enter the agent's system prompt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={agent.model || "anthropic:claude-3-7-sonnet-20250219"}
                readOnly
                className={inputStyles}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_tokens">Max Tokens</Label>
              <Input
                id="max_tokens"
                value={localAgent?.max_tokens || ANTHROPIC_DEFAULT_MAX_TOKENS}
                type="number"
                min={ANTHROPIC_MIN_MAX_TOKENS}
                max={ANTHROPIC_MAX_MAX_TOKENS}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value)) {
                    handleUpdate({ max_tokens: value });
                  }
                }}
                onBlur={(e) => {
                  const value = parseInt(e.target.value);
                  if (isNaN(value)) {
                    handleUpdate({ max_tokens: ANTHROPIC_DEFAULT_MAX_TOKENS });
                    return;
                  }
                  const validValue = Math.min(
                    Math.max(value, ANTHROPIC_MIN_MAX_TOKENS),
                    ANTHROPIC_MAX_MAX_TOKENS,
                  );
                  handleUpdate({ max_tokens: validValue });
                }}
                className={inputStyles}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar">Avatar URL</Label>
              <Input
                id="avatar"
                value={localAgent?.avatar || ""}
                onChange={(e) => handleUpdate({ avatar: e.target.value })}
                placeholder="Enter avatar URL"
                className={inputStyles}
              />
            </div>

            {/* Tools Section */}
            <div className="space-y-2">
              <Label className="text-lg font-medium">Integrations</Label>
              <p className="text-sm text-slate-500">
                Enable or disable integrations to customize your agent's
                capabilities
              </p>
              <ScrollArea className="flex-1">
                <div className="flex flex-col gap-4">
                  {integrations.map((integrationId) => (
                    <IntegrationItem
                      key={integrationId}
                      integrationId={integrationId}
                      onToolToggle={handleToolToggle}
                      setIntegrationTools={setIntegrationTools}
                      agent={agent}
                      localAgent={localAgent || agent}
                    />
                  ))}
                </div>
              </ScrollArea>
              <div className="flex justify-end mt-4">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="link" size="sm">
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Reset Integration Settings
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure? This will reset all integration settings
                        to their default values. You will need to re-enable
                        integrations you want to use.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleResetIntegrations}>
                        Reset
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isDirty && countChanges() > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t p-4 z-50 rounded-b-2xl">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <div className="text-sm text-slate-600">
              {countChanges()} change{countChanges() !== 1 ? "s" : ""} pending
            </div>
            <Button
              onClick={handleSave}
              className="shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20 transition-shadow"
            >
              Save Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
