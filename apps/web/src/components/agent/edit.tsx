import {
  type Agent,
  AgentSchema,
  Integration,
  NotFoundError,
  useAgent,
  useIntegrations,
  useUpdateAgent,
  useUpdateAgentCache,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { createContext, Suspense, useContext, useEffect, useMemo } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { useBlocker, useParams } from "react-router";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { ChatProvider, useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/avatar/index.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import PromptTab from "../settings/prompt.tsx";
import { AgentTriggers } from "../triggers/agent-triggers.tsx";
import { AgentBreadcrumbSegment } from "./breadcrumb-segment.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";
import Threads from "./threads.tsx";
import { WhatsAppButton } from "./whatsapp-button.tsx";
import { lazy } from "react";
import { wrapWithUILoadingFallback } from "../../main.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

const Chat = () => {
  const { agentId, chat } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const { chat: { messages } } = useChatContext();
  const { hasChanges } = useAgentSettingsForm();
  const focusChat = useFocusChat();

  return (
    <div className="flex flex-col h-full min-w-[320px]">
      <div className="flex-none p-4">
        <div className="justify-self-start flex items-center gap-3 text-muted-foreground w-full">
          {chat.messages.length > 0 && (
            <div className="flex justify-between items-center gap-2 w-full">
              <div className="flex items-center gap-2 w-full">
                <div className="w-8 h-8 rounded-[10px] overflow-hidden flex items-center justify-center">
                  <AgentAvatar
                    name={agent.name}
                    avatar={agent.avatar}
                    className="rounded-lg text-xs"
                  />
                </div>
                <h1 className="text-sm font-medium tracking-tight">
                  {agent.name}
                </h1>
              </div>
              <Button
                className={messages.length > 0 && !hasChanges
                  ? "inline-flex text-xs"
                  : "hidden"}
                variant="outline"
                size="sm"
                onClick={() =>
                  focusChat(agentId, crypto.randomUUID(), {
                    history: false,
                  })}
              >
                New Thread
              </Button>
            </div>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="flex-none pb-4 px-4">
        <ChatInput />
      </div>
    </div>
  );
};

const AgentSettings = lazy(() =>
  wrapWithUILoadingFallback(import("../settings/agent.tsx"))
);

const IntegrationsTab = lazy(() =>
  import("../settings/integrations.tsx").then(module => ({ default: module.default }))
);

const TABS: Record<string, Tab> = {
  chatView: {
    Component: ThreadView,
    title: "Thread",
    hideFromViews: true,
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
    hideFromViews: true,
  },
  triggers: {
    Component: AgentTriggers,
    title: "Agent Triggers",
  },
  setup: {
    Component: AgentSettings,
    title: "Settings",
    initialOpen: "right",
  },
  prompt: {
    Component: PromptTab,
    title: "System prompt",
    initialOpen: "within",
  },
  integrations: {
    Component: IntegrationsTab,
    title: "Integrations",
    initialOpen: "within",
    // it is not the ideal solution
    // but initialWidth is not working as expected
    maximumWidth: 500,
  },
  audit: {
    Component: Threads,
    title: "Threads",
  },
  chat: {
    Component: Chat,
    title: "Chat",
    initialOpen: "left",
  },
};

// --- AgentSettingsFormContext ---
interface AgentSettingsFormContextValue {
  form: ReturnType<typeof useForm<Agent>>;
  hasChanges: boolean;
  handleSubmit: () => void;
  installedIntegrations: Integration[];
  agent: Agent;
}

const AgentSettingsFormContext = createContext<
  AgentSettingsFormContextValue | undefined
>(undefined);

export function useAgentSettingsForm() {
  const ctx = useContext(AgentSettingsFormContext);
  if (!ctx) {
    throw new Error(
      "useAgentSettingsForm must be used within AgentSettingsFormContext",
    );
  }
  return ctx;
}

function ActionButtons({
  discardChanges,
  numberOfChanges,
  isWellKnownAgent,
}: {
  discardChanges: () => void;
  numberOfChanges: number;
  isWellKnownAgent: boolean;
}) {
  const { form, hasChanges, handleSubmit } = useAgentSettingsForm();

  return (
    <div className="flex items-center gap-2 bg-sidebar transition-opacity">
      {!isWellKnownAgent && (
        <Button
          type="button"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={discardChanges}
          className={hasChanges ? "inline-flex" : "hidden"}
        >
          Discard
        </Button>
      )}

      <Button
        className={hasChanges ? "inline-flex" : "hidden"}
        variant="special"
        onClick={handleSubmit}
        disabled={!numberOfChanges ||
          form.formState.isSubmitting}
      >
        {form.formState.isSubmitting
          ? (
            <>
              <Spinner size="xs" />
              <span>Saving...</span>
            </>
          )
          : (
            <span>
              {isWellKnownAgent
                ? "Save Agent"
                : `Save ${numberOfChanges} change${
                  numberOfChanges > 1 ? "s" : ""
                }`}
            </span>
          )}
      </Button>
      <WhatsAppButton />
    </div>
  );
}

function FormProvider(props: Props & { agentId: string; threadId: string }) {
  const { agentId, threadId } = props;
  const { data: agent } = useAgent(agentId);
  const { data: installedIntegrations } = useIntegrations();
  const updateAgent = useUpdateAgent();
  const updateAgentCache = useUpdateAgentCache();
  const createAgent = useCreateAgent();

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );

  const form = useForm({
    defaultValues: agent,
    resolver: zodResolver(AgentSchema),
  });

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const hasChanges = numberOfChanges > 0;

  // Use deferred values for better UX - updates cache at lower priority
  const values = form.watch();
  useEffect(() => {
    const timeout = setTimeout(() => updateAgentCache(values as Agent), 200);

    return () => clearTimeout(timeout);
  }, [values, updateAgentCache]);

  const blocked = useBlocker(hasChanges && !isWellKnownAgent);

  const handleSubmit = form.handleSubmit(
    async (data: Agent) => {
      try {
        if (isWellKnownAgent) {
          const id = crypto.randomUUID();
          const agent = { ...data, id };
          createAgent(agent, {});
          const wellKnownAgent =
            WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS];
          form.reset(wellKnownAgent);
          updateAgentCache(wellKnownAgent);
          return;
        }

        await updateAgent.mutateAsync(data);
        form.reset(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to update agent",
        );
      }
    },
  );

  function handleCancel() {
    blocked.reset?.();
  }

  function discardChanges() {
    form.reset();
    updateAgentCache(form.getValues() as Agent);
    blocked.proceed?.();
  }

  return (
    <>
      <AlertDialog open={blocked.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave this page, your edits will
              be lost. Are you sure you want to discard your changes and
              navigate away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={discardChanges}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ChatProvider
        agentId={agentId}
        threadId={threadId}
        uiOptions={{
          showThreadTools: false,
          showEditAgent: false,
          showModelSelector: false,
        }}
      >
        <AgentSettingsFormContext.Provider
          value={{
            form: form as UseFormReturn<Agent>,
            hasChanges: hasChanges,
            handleSubmit,
            installedIntegrations: installedIntegrations.filter(
              (i) => !i.id.includes(agentId),
            ),
            agent,
          }}
        >
          <PageLayout
            tabs={TABS}
            key={agentId}
            actionButtons={
              <ActionButtons
                discardChanges={discardChanges}
                numberOfChanges={numberOfChanges}
                isWellKnownAgent={isWellKnownAgent}
              />
            }
            breadcrumb={
              <DefaultBreadcrumb
                items={[
                  { link: "/agents", label: "Agents" },
                  {
                    label: (
                      <AgentBreadcrumbSegment
                        agentId={agentId}
                        variant="summary"
                      />
                    ),
                  },
                ]}
              />
            }
          />
        </AgentSettingsFormContext.Provider>
      </ChatProvider>
    </>
  );
}

export default function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  const threadId = useMemo(
    () => props.threadId || params.threadId || agentId,
    [props.threadId, params.threadId, agentId],
  );

  const chatKey = useMemo(
    () => `${agentId}-${threadId}`,
    [agentId, threadId],
  );

  if (!agentId) {
    throw new NotFoundError("Agent not found");
  }

  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <FormProvider
        {...props}
        agentId={agentId}
        threadId={threadId!}
        key={chatKey}
      />
    </Suspense>
  );
}
