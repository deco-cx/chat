import type { Message } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useMemo, useRef, useState } from "react";
import { Picker } from "./chat-picker.tsx";
import { useChatContext } from "./context.tsx";
import { AgentCard } from "./tools/agent-card.tsx";
import { Preview } from "./tools/render-preview.tsx";
import { formatToolName } from "./utils/format-tool-name.ts";

interface ConfirmOption {
  value: string;
  label: string;
}

interface ToolMessageProps {
  toolInvocations: NonNullable<Message["toolInvocations"]>;
  isLastMessage?: boolean;
}

// Tools that have custom UI rendering and shouldn't show in the timeline
const CUSTOM_UI_TOOLS = [
  "HOSTING_APP_DEPLOY",
  "RENDER",
  "SHOW_PICKER",
  "CONFIRM",
  "CONFIGURE",
  "AGENT_CREATE",
] as const;
type CustomUITool = (typeof CUSTOM_UI_TOOLS)[number];

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "call" | "result" | "error" | "partial-call";
  args?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: unknown;
}

function isCustomUITool(toolName: string): toolName is CustomUITool {
  return CUSTOM_UI_TOOLS.includes(toolName as CustomUITool);
}

function ToolStatus({
  tool,
  isLast,
  isSingle,
}: {
  tool: ToolInvocation;
  isLast: boolean;
  isSingle: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const getIcon = (state: string) => {
    switch (state) {
      case "call":
        return <Spinner size="xs" variant="default" />;
      case "result":
        return <Icon name="check" className="text-muted-foreground" />;
      case "error":
        return <Icon name="close" className="text-muted-foreground" />;
      default:
        return "•";
    }
  };

  const getToolName = () => {
    if (tool.toolName.startsWith("AGENT_GENERATE_")) {
      return `Delegating to agent`;
    }
    return formatToolName(tool.toolName);
  };

  const getToolJson = () => {
    return JSON.stringify(
      {
        toolName: tool.toolName,
        state: tool.state,
        args: tool.args,
        result: tool.result,
        error: tool.error,
      },
      null,
      2,
    ).replace(/"(\w+)":/g, '"$1":');
  };

  const onClick = () => {
    setIsExpanded((prev) => {
      const newState = !prev;

      setTimeout(() => {
        if (newState && contentRef.current) {
          contentRef.current.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }
      }, 100);

      return newState;
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getToolJson());
  };

  return (
    <div
      className={cn(
        "flex flex-col relative",
        isSingle && "p-4 hover:bg-accent rounded-2xl",
      )}
      onClick={isSingle ? onClick : undefined}
      onMouseEnter={() => setShowCopyButton(true)}
      onMouseLeave={() => setShowCopyButton(false)}
    >
      <div className="flex items-start gap-2">
        <button
          type="submit"
          onClick={isSingle ? undefined : onClick}
          className={cn(
            "w-full flex items-start gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors",
            !isSingle && "hover:bg-accent rounded-lg p-2",
          )}
        >
          <div className="relative flex flex-col items-center min-h-[20px]">
            <div
              className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center bg-muted",
              )}
            >
              {getIcon(tool.state)}
            </div>
            {!isLast && !isExpanded && (
              <div className="w-[1px] h-[150%] bg-muted absolute top-5 left-1/2 transform -translate-x-1/2" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium truncate max-w-[60vw] md:max-w-full">
                {getToolName()}
              </div>
              <Icon
                className={cn("text-sm ml-auto", isExpanded && "rotate-90")}
                name="chevron_right"
              />
            </div>

            {isExpanded && (
              <div
                ref={contentRef}
                className="text-left mt-2 rounded-lg bg-primary border border-border overflow-hidden w-full relative"
                onClick={(e) => e.stopPropagation()}
              >
                {showCopyButton && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy();
                    }}
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted transition-colors"
                    title="Copy tool details"
                  >
                    <Icon
                      name="content_copy"
                      className="w-4 h-4 text-muted-foreground"
                    />
                  </Button>
                )}
                <pre
                  className="p-4 text-xs whitespace-pre-wrap break-all overflow-y-auto max-h-[500px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <code className="text-primary-foreground select-text cursor-auto">
                    {getToolJson()}
                  </code>
                </pre>
              </div>
            )}
          </div>
        </button>
      </div>
    </div>
  );
}

function CustomToolUI({
  tool,
  isLastMessage,
}: {
  tool: ToolInvocation;
  isLastMessage?: boolean;
}) {
  const { select } = useChatContext();

  if (tool.state !== "result" || !tool.result) return null;

  switch (tool.toolName) {
    case "RENDER": {
      return (
        <Preview
          content={tool.result.content as "url" | "html"}
          title={tool.result.title as string}
        />
      );
    }
    case "HOSTING_APP_DEPLOY": {
      return (
        <Preview
          content={tool.result.content as "url" | "html"}
          title={tool.result.title as string}
        />
      );
    }
    case "CONFIGURE":
    case "AGENT_CREATE": {
      return (
        <div className="animate-in slide-in-from-bottom duration-300">
          <AgentCard
            id={tool.result.id as string}
            name={tool.result.name as string}
            description={tool.result.description as string}
            avatar={tool.result.avatar as string}
            displayLink={tool.toolName === "AGENT_CREATE"}
          />
        </div>
      );
    }
    case "SHOW_PICKER":
    case "CONFIRM": {
      const options = (tool.result.options as ConfirmOption[]).map(
        (option) => ({
          id: option.value,
          ...option,
        }),
      );

      return (
        <Picker
          question={tool.result.question as string}
          options={options}
          onSelect={(value) => select(tool.toolCallId, value)}
          disabled={!isLastMessage}
        />
      );
    }
    default: {
      return null;
    }
  }
}

export function ToolMessage({
  toolInvocations,
  isLastMessage,
}: ToolMessageProps) {
  // Separate tools into timeline tools and custom UI tools using memoization
  const { timelineTools, customUITools } = useMemo(() => {
    const timeline: ToolInvocation[] = [];
    const customUI: ToolInvocation[] = [];

    toolInvocations.forEach((tool: ToolInvocation) => {
      if (isCustomUITool(tool.toolName)) {
        customUI.push(tool);
      } else {
        timeline.push(tool);
      }
    });

    return { timelineTools: timeline, customUITools: customUI };
  }, [toolInvocations]);

  return (
    <div className="w-full space-y-4">
      {/* Timeline tools */}
      {timelineTools.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-2 w-full border border-border rounded-2xl",
            timelineTools.length > 1 && "p-2",
          )}
        >
          {timelineTools.map((tool, index) => (
            <ToolStatus
              key={tool.toolCallId}
              tool={tool}
              isLast={index === timelineTools.length - 1}
              isSingle={timelineTools.length === 1}
            />
          ))}
        </div>
      )}

      {/* Custom UI tools */}
      {customUITools.map((tool) => (
        <CustomToolUI
          key={tool.toolCallId}
          tool={tool}
          isLastMessage={isLastMessage}
        />
      ))}
    </div>
  );
}
