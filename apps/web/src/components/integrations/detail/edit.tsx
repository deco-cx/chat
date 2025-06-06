import {
  type Integration,
  IntegrationSchema,
  useAgent,
  useIntegration,
  useThreadMessages,
  useTools,
  useUpdateAgentCache,
  useUpdateIntegration,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { trackEvent } from "../../../hooks/analytics.ts";
import { ChatInput } from "../../chat/chat-input.tsx";
import { ChatMessages } from "../../chat/chat-messages.tsx";
import { ChatProvider } from "../../chat/context.tsx";
import { Tab } from "../../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../../layout.tsx";
import { Context } from "./context.ts";
import { Inspector } from "./inspector.tsx";

function MainChat() {
  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="p-2">
        <ChatInput />
      </div>
    </div>
  );
}

const TABS: Record<string, Tab> = {
  main: {
    Component: MainChat,
    title: "Chat setup",
    initialOpen: true,
  },
  inspector: {
    Component: Inspector,
    title: "Test integration",
    initialOpen: "right",
  },
};

export default function Page() {
  const agentId = WELL_KNOWN_AGENT_IDS.setupAgent;

  const { id } = useParams();
  const integrationId = id!;
  const threadId = integrationId;

  const { data: integration } = useIntegration(integrationId);
  const { data: agent } = useAgent(agentId);
  const tools = useTools(integration.connection);
  const updateAgentCache = useUpdateAgentCache();
  const messages = useThreadMessages(threadId);

  const form = useForm<Integration>({
    resolver: zodResolver(IntegrationSchema),
    defaultValues: {
      id: integration.id || crypto.randomUUID(),
      name: integration.name || "",
      description: integration.description || "",
      icon: integration.icon || "",
      connection: integration.connection || {
        type: "HTTP" as const,
        url: "https://example.com/messages",
        token: "",
      },
      access: integration.access || null,
    },
  });

  const updateIntegration = useUpdateIntegration();
  const isMutating = updateIntegration.isPending;

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  const handleDiscard = () => form.reset(integration);

  const onSubmit = async (data: Integration) => {
    try {
      await updateIntegration.mutateAsync(data);

      trackEvent("integration_update", {
        success: true,
        data,
      });

      form.reset(data);
    } catch (error) {
      console.error(
        `Error updating integration:`,
        error,
      );

      trackEvent("integration_create", {
        success: false,
        error,
        data,
      });
    }
  };

  useEffect(() => {
    if (tools.isLoading || !tools.data) {
      return;
    }

    updateAgentCache({
      ...agent,
      tools_set: { [integrationId]: tools.data.tools.map((tool) => tool.name) },
    });
  }, [tools.data, tools.isLoading]);

  return (
    <ChatProvider
      agentId={agentId}
      threadId={threadId}
      uiOptions={{ showEditAgent: false }}
      initialInput={messages.data?.length === 0
        ? `Can you help me setup ${integration.name}?`
        : undefined}
    >
      <Context.Provider
        value={{ form, integration, onSubmit }}
      >
        <PageLayout
          tabs={TABS}
          actionButtons={
            <div
              className={cn(
                "flex items-center gap-2",
                "transition-opacity",
                numberOfChanges > 0 ? "opacity-100" : "opacity-0",
              )}
            >
              <Button
                type="button"
                variant="outline"
                className="text-foreground"
                onClick={handleDiscard}
              >
                Discard
              </Button>
              <Button
                className="bg-primary-light text-primary-dark hover:bg-primary-light/90 gap-2"
                disabled={!numberOfChanges}
                onClick={() => {
                  onSubmit(form.getValues());
                }}
              >
                {isMutating
                  ? (
                    <>
                      <Spinner size="xs" />
                      <span>Saving...</span>
                    </>
                  )
                  : (
                    <span>
                      Save {numberOfChanges}{" "}
                      change{numberOfChanges > 1 ? "s" : ""}
                    </span>
                  )}
              </Button>
            </div>
          }
          breadcrumb={
            <DefaultBreadcrumb
              items={[
                { label: "Connections", link: "/connections" },
                ...(integration?.name ? [{ label: integration.name }] : []),
              ]}
            />
          }
        />
      </Context.Provider>
    </ChatProvider>
  );
}
