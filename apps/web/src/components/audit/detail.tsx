import { useThread, useAgentData, useAgentRoot } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useParams } from "react-router";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgenticChatProvider } from "../chat/provider.tsx";

const useThreadId = () => {
  const { id } = useParams();

  if (!id) {
    throw new Error("No id provided");
  }

  return id;
};

function Page() {
  const id = useThreadId();
  const { data: thread } = useThread(id);
  const agentId = thread?.metadata?.agentId ?? id;
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);

  if (!agent) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <AgenticChatProvider
      agentId={agentId}
      threadId={id}
      agent={agent}
      agentRoot={agentRoot}
    >
      <ScrollArea className="h-full py-6">
        <ChatMessages />
      </ScrollArea>
    </AgenticChatProvider>
  );
}

export default Page;
