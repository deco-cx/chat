import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { ReactNode } from "react";
import { useMemo } from "react";

interface ThreadDetailPanelProps {
  thread: {
    id: string;
    title?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  };
  onNavigate: (direction: "previous" | "next") => void;
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
  children: ReactNode;
}

export function ThreadDetailPanel({
  thread,
  onNavigate,
  canNavigatePrevious,
  canNavigateNext,
  children,
}: ThreadDetailPanelProps) {
  const title = useMemo(
    () => thread.title || "Untitled conversation",
    [thread.title],
  );

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-0 border-border px-4 py-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <p
            className="truncate text-sm font-semibold text-foreground"
            title={title}
          >
            {title}
          </p>
          {thread.resourceId && (
            <p
              className="truncate text-xs text-muted-foreground"
              title={thread.resourceId}
            >
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
            disabled={!canNavigatePrevious}
          >
            <Icon name="chevron_left" />
          </Button>
          <Button
            onClick={() => onNavigate("next")}
            size="icon"
            variant="ghost"
            aria-label="Next conversation"
            className="h-8 w-8"
            disabled={!canNavigateNext}
          >
            <Icon name="chevron_right" />
          </Button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
