import {
  type Agent,
  AgentSchema,
  useAgent,
  useIntegrations,
  useUpdateAgent,
} from "@deco/sdk";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import {
  getAgentOverrides,
  useAgentHasChanges,
  useAgentOverridesSetter,
  useOnAgentChangesDiscarded,
} from "../../hooks/useAgentOverrides.ts";
import { usePersistedDirtyForm } from "../../hooks/usePersistedDirtyForm.ts";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { FormSubmitControls } from "../common/FormSubmit.tsx";
import { Integration } from "../toolsets/index.tsx";

// Token limits for Anthropic models
const ANTHROPIC_MIN_MAX_TOKENS = 4096;
const ANTHROPIC_MAX_MAX_TOKENS = 64000;

interface SettingsTabProps {
  formId?: string;
}

function SettingsTab({ formId }: SettingsTabProps) {
  const { agentId } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const { data: installedIntegrations } = useIntegrations();
  const updateAgent = useUpdateAgent();

  const [isLoading, setIsLoading] = useState(false);
  const { hasChanges, discardCurrentChanges } = useAgentHasChanges(agentId);

  const agentOverrides = useAgentOverridesSetter(agentId);

  const { form, discardChanges, onMutationSuccess } = usePersistedDirtyForm<
    Agent
  >({
    resolver: zodResolver(AgentSchema),
    defaultValues: agent,
    persist: agentOverrides.update,
    getOverrides: () => getAgentOverrides(agentId),
  });

  useOnAgentChangesDiscarded(agentId, discardChanges);

  const onSubmit = async (data: Agent) => {
    setIsLoading(true);
    try {
      await updateAgent.mutateAsync(data, {
        onSuccess: onMutationSuccess,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const toolsSet = form.watch("tools_set");
  const setIntegrationTools = (
    integrationId: string,
    tools: string[],
  ) => {
    const toolsSet = form.getValues("tools_set");
    const newToolsSet = { ...toolsSet };

    if (tools.length > 0) {
      newToolsSet[integrationId] = tools;
    } else {
      delete newToolsSet[integrationId];
    }

    form.setValue("tools_set", newToolsSet, { shouldDirty: true });
  };

  return (
    <Form {...form}>
      <div className="h-full overflow-y-auto w-full p-4">
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 py-2 pb-16"
        >
          {/* Avatar Section */}
          <div className="flex justify-center">
            <div className="h-40 w-40">
              <AgentAvatar
                name={agent.name}
                avatar={agent.avatar}
                className="rounded-lg"
              />
            </div>
          </div>

          <FormField
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input
                    className="rounded-md border-slate-200"
                    placeholder="Enter agent name"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="instructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>System Prompt</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter the agent's system prompt"
                    className="min-h-36 border-slate-200"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>About this agent</FormLabel>
                <FormDescription className="text-xs text-slate-400">
                  Used only for organization and search, it does not affect the
                  agent's behaviour
                </FormDescription>
                <FormControl>
                  <Textarea
                    placeholder="Describe your agent's purpose"
                    className="min-h-18 border-slate-200"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="max_tokens"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Max Tokens</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    className="rounded-md border-slate-200"
                    min={ANTHROPIC_MIN_MAX_TOKENS}
                    max={ANTHROPIC_MAX_MAX_TOKENS}
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tools Section */}
          <div className="space-y-2 mb-8">
            <div className="space-y-1">
              <FormLabel>
                Tools
              </FormLabel>
              <FormDescription className="text-xs text-slate-400">
                Extensions that expand the agent's abilities.
              </FormDescription>
            </div>
            <div className="flex-1">
              <div className="flex flex-col gap-2">
                {installedIntegrations
                  .filter((i) => !i.id.includes(agentId))
                  .filter((integration) =>
                    Array.isArray(agent?.tools_set?.[integration.id]) ||
                    (toolsSet[integration.id] &&
                      toolsSet[integration.id].length > 0)
                  )
                  .map((integration) => (
                    <Integration
                      key={integration.id}
                      integration={integration}
                      setIntegrationTools={setIntegrationTools}
                      enabledTools={toolsSet[integration.id] || []}
                      savedTools={agent?.tools_set?.[integration.id] || []}
                    />
                  ))}
              </div>
            </div>
          </div>

          <FormSubmitControls
            numberOfChanges={hasChanges ? 1 : 0}
            submitting={isLoading}
            onDiscard={discardCurrentChanges}
          />
        </form>
      </div>
    </Form>
  );
}

export default SettingsTab;
