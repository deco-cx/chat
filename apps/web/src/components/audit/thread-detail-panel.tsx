import type { Thread } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useMemo } from "react";
import { AgentProvider } from "../agent/provider.tsx";
import { MainChat } from "../agent/chat.tsx";

interface ThreadDetailPanelProps {
  thread: Thread;
  onNavigate: (direction: "previous" | "next") => void;
}

export function ThreadDetailPanel({ thread, onNavigate }: ThreadDetailPanelProps) {
  const metadata = useMemo(() => thread.metadata ?? {}, [thread.metadata]);
  const agentId = metadata.agentId ?? thread.id;

  const title = useMemo(() => thread.title || "Untitled conversation", [thread.title]);

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-0 border-border px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-semibold text-foreground" title={title}>
            {title}
          </p>
          {thread.resourceId && (
            <p className="truncate text-xs text-muted-foreground" title={thread.resourceId}>
              {thread.resourceId}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            onClick={() => onNavigate("previous")}
            size="icon"
            variant="ghost"
            aria-label="Previous conversation"
            className="h-8 w-8"
          >
            <Icon name="chevron_left" />
          </Button>
          <Button
            onClick={() => onNavigate("next")}
            size="icon"
            variant="ghost"
            aria-label="Next conversation"
            className="h-8 w-8"
          >
            <Icon name="chevron_right" />
          </Button>
        </div>
      </header>
      <AgentProvider
        agentId={agentId}
        threadId={thread.id}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: false,
          showThreadMessages: true,
          showAgentVisibility: false,
          showEditAgent: false,
          showContextResources: false,
        }}
        readOnly
      >
        <MainChat
          showInput={false}
          initialScrollBehavior="top"
          className="flex-1 min-w-0"
          contentClassName="flex flex-col min-w-0"
        />
      </AgentProvider>
    </div>
  );
}
