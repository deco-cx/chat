import { AgentSchema, useIntegrations, useUpdateThreadTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Form, FormDescription, FormLabel } from "@deco/ui/components/form.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { useTools } from "../../hooks/useTools.ts";
import { useChatContext } from "../chat/context.tsx";
import { getDiffCount, Integration } from "../toolsets/index.tsx";
import { ToolsetSelector } from "../toolsets/selector.tsx";

const ChatSchema = z.object({
  tools_set: AgentSchema.shape.tools_set,
});

type Chat = z.infer<typeof ChatSchema>;

function ThreadSettingsTab() {
  const { agentId, threadId } = useChatContext();
  const tools_set = useTools(agentId, threadId);
  const { data: installedIntegrations } = useIntegrations();
  const updateTools = useUpdateThreadTools(agentId, threadId);
  const defaultValues = useMemo(() => ({ tools_set }), [tools_set]);

  const form = useForm<Chat>({
    resolver: zodResolver(ChatSchema),
    defaultValues,
  });

  const toolsSet = form.watch("tools_set");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(null);

  const usedIntegrations = installedIntegrations
    ? installedIntegrations.filter((integration) =>
      !!toolsSet[integration.id]?.length
    )
    : [];

  const numberOfChanges = (() => {
    const { tools_set: _, ...rest } = form.formState.dirtyFields;
    return Object.keys(rest).length + getDiffCount(toolsSet, tools_set);
  })();

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

  const handleIntegrationClick = (
    integration: typeof installedIntegrations[number],
  ) => {
    setSelectedIntegrationId(integration.id);
    setIsModalOpen(true);
  };

  const onSubmit = async (data: Chat) => {
    await updateTools.mutateAsync(data.tools_set);
    form.reset(data);
  };

  return (
    <ScrollArea className="h-full w-full p-2 text-slate-700">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 px-4 py-2"
        >
          <div className="space-y-2 mb-8">
            <div className="flex items-center justify-between space-y-1">
              <div className="flex flex-col gap-2">
                <FormLabel>Tools</FormLabel>
                <FormDescription className="text-xs text-slate-400">
                  Extensions that expand the agent's abilities.
                </FormDescription>
              </div>
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 bg-slate-700 hover:bg-slate-600 rounded-lg"
                onClick={() => {
                  setSelectedIntegrationId(null);
                  setIsModalOpen(true);
                }}
                aria-label="Add tools"
              >
                <span className="sr-only">Add tools</span>
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24">
                  <path
                    d="M12 5v14m7-7H5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            </div>
            <div className="flex-1">
              <div className="flex flex-col gap-2">
                {usedIntegrations.map((integration) => (
                  <Integration
                    key={integration.id}
                    integration={integration}
                    setIntegrationTools={setIntegrationTools}
                    enabledTools={toolsSet[integration.id] || []}
                    onIntegrationClick={handleIntegrationClick}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="h-12" />

          {numberOfChanges > 0 && (
            <div className="absolute bottom-0 left-0 right-0 bg-background border-t p-4 flex items-center justify-between gap-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  form.reset(defaultValues);
                }}
              >
                Discard
              </Button>
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? (
                    <>
                      <Spinner size="sm" /> Saving...
                    </>
                  )
                  : `Save ${numberOfChanges} Change${
                    numberOfChanges === 1 ? "" : "s"
                  }`}
              </Button>
            </div>
          )}
        </form>
        <ToolsetSelector
          open={isModalOpen}
          onOpenChange={(open) => {
            setIsModalOpen(open);
            if (!open) {
              setSelectedIntegrationId(null);
            }
          }}
          installedIntegrations={installedIntegrations?.filter((i) =>
            i.id !== agentId
          ) || []}
          toolsSet={toolsSet}
          setIntegrationTools={setIntegrationTools}
          initialSelectedIntegration={selectedIntegrationId}
        />
      </Form>
    </ScrollArea>
  );
}

export default ThreadSettingsTab;
