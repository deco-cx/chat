import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useState } from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";

interface ReasoningPartProps {
  part: {
    type: "reasoning";
    text: string;
    state?: "streaming" | "done";
  };
  messageId: string;
  index: number;
}

export function ReasoningPart({ part, index, messageId }: ReasoningPartProps) {
  const { state } = part;
  const isPartStreaming = state === "streaming";
  const [isExpanded, setIsExpanded] = useState(false);
  const [wasManuallyExpanded, setWasManuallyExpanded] = useState(false);

  // Handle automatic expansion/collapse based on streaming states
  useEffect(() => {
    if (wasManuallyExpanded) return; // Don't auto-collapse if user manually expanded

    if (isPartStreaming) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isPartStreaming, wasManuallyExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    setWasManuallyExpanded(!isExpanded);
  };

  return (
    <div className="flex flex-col border border-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex items-center justify-between p-4 transition-colors",
          isPartStreaming ? "bg-muted animate-pulse" : "hover:bg-muted",
        )}
      >
        <div className="flex items-center gap-2">
          <Icon name="psychology" className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Agent thinking
          </span>
        </div>
        <Icon
          name={isExpanded ? "expand_less" : "expand_more"}
          className="text-muted-foreground transition-transform duration-200"
        />
      </button>
      <div
        className={cn(
          "transition-all duration-200 ease-in-out",
          isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className={cn("p-4 border-t", isPartStreaming && "bg-muted")}>
          <div
            className={cn(
              "prose prose-sm max-w-none text-sm",
              isPartStreaming && "text-xs text-muted-foreground",
            )}
          >
            <MemoizedMarkdown
              key={index}
              messageId={`${messageId}-${index}-reasoning`}
              part={
                "details" in part && Array.isArray(part.details)
                  ? part.details[0]
                  : { type: "text", text: part.text }
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}
