import { NotFoundError, useAgent } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useChatContext } from "../chat/context.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";

export function ChatHeader() {
  return (
    <ErrorBoundary
      fallback={<ChatHeader.Fallback />}
      shouldCatch={(e) => e instanceof NotFoundError}
    >
      <Suspense fallback={<ChatHeader.Skeleton />}>
        <ChatHeader.UI />
      </Suspense>
    </ErrorBoundary>
  );
}

ChatHeader.Fallback = () => {
  return (
    <div className="flex items-center gap-3 h-10">
      <Icon name="smart_toy" size={16} className="opacity-50" />
      <h1 className="text-sm font-medium tracking-tight opacity-50">
        This agent has been deleted
      </h1>
    </div>
  );
};

ChatHeader.Skeleton = () => {
  return <div className="h-10 w-full" />;
};

ChatHeader.UI = () => {
  const { agentId, chat } = useChatContext();
  const { data: agent } = useAgent(agentId);

  if (chat.messages.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 h-10">
      <AgentAvatar
        url={agent.avatar}
        fallback={agent.name}
        size="xs"
        className="text-xs"
      />
      <h1 className="text-sm font-medium tracking-tight">{agent.name}</h1>
    </div>
  );
};
