import { WELL_KNOWN_AGENTS, useAgentData, useAgentRoot, useThreadMessages } from "@deco/sdk";
import { Suspense } from "react";
import { useLocation } from "react-router";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { MainChat, MainChatSkeleton } from "../agent/chat.tsx";
import { AgenticChatProvider } from "../chat/provider.tsx";
import { useDecopilotContext } from "./context.tsx";
import { useDecopilotThread } from "./thread-context.tsx";
import { useThreadManager } from "./thread-manager-context.tsx";

export const NO_DROP_TARGET = "no-drop-target";

export function DecopilotChat() {
  const { threadState, clearThreadState } = useDecopilotThread();
  const { getThreadForRoute, getActiveThread } = useThreadManager();
  const location = useLocation();
  const { onToolCall } = useDecopilotContext();

  const agentId = WELL_KNOWN_AGENTS.decopilotAgent.id;

  // Get the thread for the current route
  const currentThread = getThreadForRoute(location.pathname);
  
  // Fetch required data
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();
  const { data: { messages: threadMessages } = { messages: [] } } = useThreadMessages(
    currentThread?.id || "",
    {
      enabled: !!currentThread?.id,
    }
  );

  // If no thread yet or agent not loaded, show a loading state
  if (!currentThread || !agent) {
    return (
      <div className="flex h-full w-full flex-col">
        <div className="flex h-10 items-center gap-3 border-b border-border pl-3">
          <img
            src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
            alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
            className="size-5 rounded-md border border-border"
          />
          <span className="text-sm font-medium">decochat</span>
        </div>
        <MainChatSkeleton />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Simple header with agent info */}
      <div className="flex h-10 items-center gap-3 border-b border-border pl-3">
        <img
          src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
          alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
          className="size-5 rounded-md border border-border"
        />
        <span className="text-sm font-medium">decochat</span>
      </div>

      {/* Single chat instance for current route */}
      <div className="flex-1 min-h-0">
        <Suspense fallback={<MainChatSkeleton />}>
          <AgenticChatProvider
            key={currentThread.id}
            agentId={agentId}
            threadId={currentThread.id}
            agent={agent}
            agentRoot={agentRoot}
            defaultModel={preferences.defaultModel}
            useOpenRouter={preferences.useOpenRouter}
            sendReasoning={preferences.sendReasoning}
            smoothStream={preferences.smoothStream}
            initialMessages={threadMessages}
            initialInput={threadState.initialMessage || undefined}
            autoSend={threadState.autoSend}
            onAutoSendComplete={clearThreadState}
            onToolCall={onToolCall}
            uiOptions={{
              showThreadTools: true,
              showModelSelector: true,
              showThreadMessages: true,
              showAgentVisibility: false,
              showEditAgent: false,
              showContextResources: true,
            }}
          >
            <MainChat className="h-[calc(100vh-88px)]" />
          </AgenticChatProvider>
        </Suspense>
      </div>
    </div>
  );
}
DecopilotChat.displayName = "DefaultChat";
