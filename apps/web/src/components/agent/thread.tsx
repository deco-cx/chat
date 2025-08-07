import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgentProvider } from "./provider.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { ChatHeader } from "./chat-header.tsx";

interface Props {
  agentId?: string;
  threadId?: string;
}

function ThreadView({ agentId, threadId }: Props) {
  if (!agentId || !threadId) {
    throw new Error("Missing agentId or threadId");
  }

  return (
    <AgentProvider agentId={agentId} threadId={threadId}>
      <div className="flex items-center justify-between p-4">
        <ChatHeader />
      </div>
      <ScrollArea className="h-full w-full p-6 text-foreground">
        <ChatMessages />
      </ScrollArea>
    </AgentProvider>
  );
}

export default ThreadView;
