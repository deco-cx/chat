import { WELL_KNOWN_AGENTS } from "@deco/sdk";
import { useState } from "react";
import { MainChat } from "../agent/chat.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { useViewAdditionalTools } from "./use-view-additional-tools.ts";
import { useAppAdditionalTools } from "./use-app-additional-tools.ts";
import { useSearchParams } from "react-router";

export const NO_DROP_TARGET = "no-drop-target";

export const useDecopilotParams = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const clearAutoSendParams = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("autoSend");
    newParams.delete("initialInput");
    setSearchParams(newParams, { replace: true });
  };

  return {
    initialInput: searchParams.get("initialInput"),
    autoSend: searchParams.get("autoSend") === "true",
    clearAutoSendParams,
  };
};

export function DecopilotChat() {
  const [threadId, _setThreadId] = useState(() => crypto.randomUUID());
  const { initialInput, autoSend, clearAutoSendParams } = useDecopilotParams();
  const viewAdditionalTools = useViewAdditionalTools();
  const appAdditionalTools = useAppAdditionalTools();

  return (
    <div className="flex h-full w-full flex-col">
      <AgentProvider
        key={WELL_KNOWN_AGENTS.decopilotAgent.id}
        agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
        threadId={threadId}
        additionalTools={{
          ...viewAdditionalTools,
          ...appAdditionalTools,
        }}
        chatOverrides={{}}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: true,
          showThreadMessages: false,
          showAgentVisibility: false,
          showEditAgent: false,
        }}
        initialInput={initialInput ?? undefined}
        autoSend={autoSend}
        onAutoSendComplete={clearAutoSendParams}
      >
        <MainChat />
      </AgentProvider>
    </div>
  );
}
DecopilotChat.displayName = "DefaultChat";
