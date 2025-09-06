import {
  NotFoundError,
  useAgentData,
  useFile,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import AdvancedTab from "../settings/advanced.tsx";
import AgentProfileTab from "../settings/agent-profile.tsx";
import ToolsAndKnowledgeTab from "../settings/integrations.tsx";
import { AgentTriggers } from "../triggers/agent-triggers.tsx";
import { AgentBreadcrumbSegment } from "./breadcrumb-segment.tsx";
import AgentPreview, { useTabsForAgent } from "./preview.tsx";
import ThreadView from "./thread.tsx";
import Threads from "./threads.tsx";
import { isFilePath } from "../../utils/path.ts";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { AgentProvider, useAgent } from "./provider.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

const Chat = () => {
  const { agentId, chat, agent, hasUnsavedChanges: hasChanges } = useAgent();
  const { messages } = chat;
  const focusChat = useFocusChat();

  return (
    <div className="flex flex-col h-full min-w-[320px]">
      <div className="flex-none p-4">
        <div className="justify-self-start flex items-center gap-3 text-muted-foreground w-full">
          {chat.messages.length > 0 && (
            <div className="flex justify-between items-center gap-2 w-full">
              <div className="flex items-center gap-2 w-full">
                <AgentAvatar
                  url={agent.avatar}
                  fallback={agent.name}
                  size="sm"
                />
                <h1 className="text-sm font-medium tracking-tight">
                  {agent.name}
                </h1>
              </div>
              <Button
                className={
                  messages.length > 0 && !hasChanges
                    ? "inline-flex text-xs"
                    : "hidden"
                }
                variant="outline"
                size="sm"
                onClick={() =>
                  focusChat(agentId, crypto.randomUUID(), {
                    history: false,
                  })
                }
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
  // Left side group
  chat: {
    Component: Chat,
    title: "Chat",
    initialOpen: "left",
    initialWidth: 600,
    active: true,
  },
  audit: {
    Component: Threads,
    title: "Threads",
    initialOpen: "within",
  },
  // Right side group
  profile: {
    Component: AgentProfileTab,
    title: "Profile",
    initialOpen: "right",
    initialWidth: 600,
    active: true,
  },
  integrations: {
    Component: ToolsAndKnowledgeTab,
    title: "Tools",
    initialOpen: "within",
  },
  triggers: {
    Component: AgentTriggers,
    title: "Triggers",
    initialOpen: "within",
  },
  advanced: {
    Component: AdvancedTab,
    title: "Advanced",
    initialOpen: "within",
  },
};

// --- AgentSettingsFormContext ---

function ActionButtons() {
  const {
    form,
    hasUnsavedChanges: hasChanges,
    handleSubmit,
    agent,
  } = useAgent();

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agent.id as keyof typeof WELL_KNOWN_AGENTS],
  );

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  function discardChanges() {
    form.reset();
  }

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
        disabled={!numberOfChanges || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Spinner size="xs" />
            <span>Saving...</span>
          </>
        ) : (
          <span>
            {isWellKnownAgent
              ? "Save Agent"
              : `Save ${numberOfChanges} change${
                  numberOfChanges > 1 ? "s" : ""
                }`}
          </span>
        )}
      </Button>
    </div>
  );
}

function FormProvider(props: Props & { agentId: string; threadId: string }) {
  const { agentId, threadId } = props;
  const { data: agent } = useAgentData(agentId);
  const { data: resolvedAvatar } = useFile(
    agent?.avatar && isFilePath(agent.avatar) ? agent.avatar : "",
  );

  const tabs = useTabsForAgent(agent, TABS);

  useDocumentMetadata({
    title: agent ? `${agent.name} | deco CMS` : undefined,
    description: agent
      ? (agent.description ?? agent.instructions ?? "")
      : undefined,
    favicon: isFilePath(agent?.avatar)
      ? typeof resolvedAvatar === "string"
        ? resolvedAvatar
        : undefined
      : agent?.avatar,
    socialImage: agent?.avatar,
  });

  return (
    <AgentProvider
      agentId={agentId}
      threadId={threadId}
      uiOptions={{
        showThreadTools: false,
        showEditAgent: false,
        showModelSelector: false,
      }}
    >
      <PageLayout
        tabs={tabs}
        key={agentId}
        actionButtons={<ActionButtons />}
        breadcrumb={
          <DefaultBreadcrumb
            items={[
              { link: "/agents", label: "Agents" },
              {
                label: <AgentBreadcrumbSegment variant="summary" />,
              },
            ]}
          />
        }
      />
    </AgentProvider>
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

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

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
