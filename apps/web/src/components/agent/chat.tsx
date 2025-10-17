import { useAgentData, useAgentRoot, useFile, useThreadMessages, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useParams, useLocation } from "react-router";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { isFilePath } from "../../utils/path.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import { AgenticChatProvider, useAgenticChat } from "../chat/provider.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";

export type WellKnownAgents =
  (typeof WELL_KNOWN_AGENT_IDS)[keyof typeof WELL_KNOWN_AGENT_IDS];

interface Props {
  agentId?: WellKnownAgents;
  threadId?: string;
  showThreadMessages?: boolean;
}

interface MainChatProps {
  showInput?: boolean;
  initialScrollBehavior?: "top" | "bottom";
  className?: string;
  contentClassName?: string;
}

export const MainChatSkeleton = ({
  showInput = true,
  className,
}: Pick<MainChatProps, "showInput" | "className"> = {}) => {
  return (
    <div className={`w-full flex flex-col h-full ${className ?? ""}`}>
      <ScrollArea className="flex-1 min-h-0">
        <div className="w-full min-w-0">
          {/* Empty state skeleton - centered */}
          <div className="h-full flex flex-col justify-between py-12">
            <div className="flex flex-col items-center justify-center max-w-2xl mx-auto p-4">
              <div className="flex flex-col items-center gap-4 mb-6">
                {/* Avatar skeleton */}
                <div className="w-12 h-12 flex items-center justify-center">
                  <Skeleton className="h-12 w-12 rounded-md" />
                </div>

                {/* Title and description skeletons */}
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-9 w-48" />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <Skeleton className="h-5 w-96 max-w-[90vw]" />
                    <Skeleton className="h-5 w-72 max-w-[80vw]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
      {showInput && (
        <div className="flex-none w-full mx-auto p-2">
          <div className="relative rounded-md w-full mx-auto">
            <div className="relative flex flex-col">
              {/* Rich text area skeleton */}
              <div className="overflow-y-auto relative">
                <Skeleton className="h-[88px] w-full rounded-t-2xl" />
              </div>

              {/* Input footer skeleton */}
              <div className="flex items-center justify-between h-12 border border-t-0 rounded-b-2xl px-2 bg-background">
                <div className="flex items-center gap-2" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-20 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const MainChat = ({
  showInput = true,
  initialScrollBehavior = "bottom",
  className,
  contentClassName,
}: MainChatProps = {}) => {
  return (
    <div className={`w-full flex flex-col h-full ${className ?? ""}`}>
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages
          initialScrollBehavior={initialScrollBehavior}
          className={contentClassName}
        />
      </ScrollArea>
      {showInput && (
        <div className="flex-none p-2">
          <ChatInput />
        </div>
      )}
    </div>
  );
};

function AgentMetadataUpdater() {
  const { agent } = useAgenticChat();
  const { data: resolvedAvatar } = useFile(
    agent?.avatar && isFilePath(agent.avatar) ? agent.avatar : "",
  );

  // Compute favicon href, favouring resolved file URLs for local files.
  const faviconHref = isFilePath(agent?.avatar)
    ? typeof resolvedAvatar === "string"
      ? resolvedAvatar
      : undefined
    : agent?.avatar;

  useDocumentMetadata({
    title: agent ? `${agent.name} | deco CMS` : undefined,
    favicon: faviconHref,
  });

  return null;
}

function Page(props: Props) {
  const params = useParams();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const chatMode = (searchParams.get("chat") as "agent" | "decopilot") || "agent";

  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
  }

  const propThreadId = props.threadId || params.threadId;
  const threadId = useMemo(
    () => propThreadId || agentId,
    [propThreadId, agentId],
  );

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  // Use AgenticChatProvider for all agents (including team agent)
  const isTeamAgent = agentId === WELL_KNOWN_AGENT_IDS.teamAgent;

  // Get agent data for decopilot context
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();
  const { data: { messages: threadMessages } = { messages: [] } } = useThreadMessages(
    threadId,
    {
      enabled: props.showThreadMessages ?? true,
    }
  );

  // Prepare decopilot context value for agent chat
  const decopilotContextValue = useMemo(() => {
    if (!agent) return {};

    const rules: string[] = [
      `You are helping with agent chat and conversation. The current agent is "${agent.name}". Focus on operations related to conversation management, message handling, and chat functionality.`,
      `When working with this agent chat (${agent.name}), prioritize operations that help users manage conversations, understand chat history, and interact effectively with the agent. Consider the agent's capabilities and current conversation context when providing assistance.`,
    ];

    return {
      rules,
    };
  }, [agent]);

  if (!agent) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // If chat mode is "decopilot", show the DecopilotChat instead
  if (chatMode === "decopilot") {
    return (
      <DecopilotLayout value={decopilotContextValue}>
        <DecopilotChat />
      </DecopilotLayout>
    );
  }

  // Otherwise show the agent's own chat
  return (
    <Suspense
      // This make the react render fallback when changin agent+threadid, instead of hang the whole navigation while the subtree isn't changed
      key={chatKey}
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <DecopilotLayout value={decopilotContextValue}>
        <AgenticChatProvider
          agentId={agentId}
          threadId={threadId}
          agent={agent}
          agentRoot={agentRoot}
          model={preferences.defaultModel}
          useOpenRouter={preferences.useOpenRouter}
          sendReasoning={preferences.sendReasoning}
          initialMessages={threadMessages}
          uiOptions={{
            showThreadTools: isTeamAgent,
            showThreadMessages: props.showThreadMessages ?? true,
            showModelSelector: true,
            showAgentVisibility: false,
            showEditAgent: false,
            showContextResources: true,
          }}
        >
          <AgentMetadataUpdater />
          <MainChat />
        </AgenticChatProvider>
      </DecopilotLayout>
    </Suspense>
  );
}

export default Page;
