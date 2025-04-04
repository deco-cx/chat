import type { Agent } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { togglePanel } from "../agent/index.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";

interface ChatHeaderProps {
  agent: Agent;
}

const DEFAULT_LAYOUT_SETTINGS = {
  initialWidth: 400,
  maximumWidth: 400,
  position: { direction: "right" },
};

export function ChatHeader({ agent }: ChatHeaderProps) {
  const handleSettings = () => {
    togglePanel({
      id: "settings",
      component: "settings",
      title: "Agent Settings",
      params: { agentId: agent.id },
      ...DEFAULT_LAYOUT_SETTINGS,
    });
  };

  const handleThreads = () => {
    togglePanel({
      id: "threads",
      component: "threads",
      title: "Agent Threads",
      params: { agentId: agent.id },
      ...DEFAULT_LAYOUT_SETTINGS,
    });
  };

  return (
    <header className="bg-background relative flex justify-between items-center pl-4 py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-[10px] overflow-hidden flex items-center justify-center">
          <AgentAvatar
            name={agent.name}
            avatar={agent.avatar}
            className="rounded-lg text-xs"
          />
        </div>
        <h1 className="text-sm font-medium tracking-tight">{agent.name}</h1>
      </div>
      <div className="ml-auto flex items-center gap-1.5 pr-1">
        <Button
          onClick={handleThreads}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted"
          aria-label="Threads"
        >
          <Icon
            name="manage_search"
            className="text-md text-muted-foreground"
          />
        </Button>
        <Button
          onClick={handleSettings}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted"
          aria-label="Start new chat"
        >
          <Icon name="settings" className="text-md text-muted-foreground" />
        </Button>
      </div>
    </header>
  );
}
