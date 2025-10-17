import { useAgenticChat } from "../chat/provider.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";

export function ChatHeader() {
  const { agent, chat } = useAgenticChat();

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
      <span className="text-sm font-medium tracking-tight text-foreground">
        {agent.name}
      </span>
    </div>
  );
}
