import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgenticChatProvider } from "../chat/provider.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { ChatHeader } from "./chat-header.tsx";
import { useAgentData, useAgentRoot, useThreadMessages } from "@deco/sdk";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";

interface Props {
  agentId?: string;
  threadId?: string;
}

function ThreadView({ agentId, threadId }: Props) {
  if (!agentId || !threadId) {
    throw new Error("Missing agentId or threadId");
  }

  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();
  const { data: { messages: threadMessages } = { messages: [] } } = useThreadMessages(
    threadId,
    { enabled: true }
  );

  if (!agent) {
    return <div>Loading...</div>;
  }

  return (
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
        showThreadTools: false,
        showThreadMessages: true,
        readOnly: true,
        showModelSelector: false,
        showAgentVisibility: false,
        showEditAgent: false,
        showContextResources: false,
      }}
    >
      <div className="flex items-center justify-between p-4">
        <ChatHeader />
      </div>
      <ScrollArea className="h-full w-full p-6 text-foreground">
        <ChatMessages />
      </ScrollArea>
    </AgenticChatProvider>
  );
}

export default ThreadView;
