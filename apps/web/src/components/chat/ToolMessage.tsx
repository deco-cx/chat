import type { Message } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useRef, useState } from "react";
import { openPanel } from "../dock/index.tsx";
import { useChatContext } from "./context.tsx";
import { Picker } from "./Picker.tsx";
import { AgentCard } from "./tools/AgentCard.tsx";
import { HandoffResponse } from "./tools/HandoffResponse.tsx";
import { Preview } from "./tools/Preview.tsx";
import { parseHandoffTool } from "./utils/parse.ts";

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
  "HANDOFF_",
] as const;
type CustomUITool = typeof CUSTOM_UI_TOOLS[number];

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state: "call" | "result" | "error" | "partial-call";
  args?: Record<string, unknown>;
  result?: {
    data?: Record<string, unknown>;
  };
  error?: unknown;
}

function isCustomUITool(toolName: string): toolName is CustomUITool {
  return CUSTOM_UI_TOOLS.some((tool) => toolName.startsWith(tool));
}

function ToolStatus({
  tool,
  isLast,
  isSingle,
}: { tool: ToolInvocation; isLast: boolean; isSingle: boolean }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const getIcon = (state: string) => {
    switch (state) {
      case "call":
        return <Spinner size="xs" variant="default" />;
      case "result":
        return <Icon name="check" className="text-slate-500" />;
      case "error":
        return <Icon name="close" className="text-slate-500" />;
      default:
        return "•";
    }
  };

  const getToolName = () => {
    if (tool.toolName.startsWith("HANDOFF_")) {
      return `Delegating to ${parseHandoffTool(tool.toolName)}`;
    }
    return tool.toolName;
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

  useEffect(() => {
    if (
      tool.state === "result" &&
      tool.result?.data &&
      tool.toolName.startsWith("HANDOFF_")
    ) {
      const { threadId, agentId } = tool.result.data as {
        threadId: string;
        agentId: string;
      };

      const panelId = `chat-${threadId}`;

      openPanel({
        id: panelId,
        component: "chatView",
        title: "Agent chat",
        params: {
          threadId,
          agentId,
          key: `${panelId}-${Date.now()}`,
        },
        initialWidth: 420,
        position: {
          direction: "right",
        },
      });
    }
  }, [tool.state]);

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
        isSingle && "p-4 hover:bg-slate-50 rounded-2xl",
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
            !isSingle && "hover:bg-slate-50 rounded-lg p-2",
          )}
        >
          <div className="relative flex flex-col items-center min-h-[20px]">
            <div
              className={cn(
                "w-5 h-5 rounded-full border flex items-center justify-center bg-slate-200",
              )}
            >
              {getIcon(tool.state)}
            </div>
            {!isLast && !isExpanded && (
              <div className="w-[1px] h-[150%] bg-slate-200 absolute top-5 left-1/2 transform -translate-x-1/2" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="font-medium truncate max-w-3xs md:max-w-full">
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
                className="text-left mt-2 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden w-full relative"
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
                    className="absolute top-2 right-2 p-1 rounded-full hover:bg-zinc-800 transition-colors"
                    title="Copy tool details"
                  >
                    <Icon
                      name="content_copy"
                      className="w-4 h-4 text-zinc-400"
                    />
                  </Button>
                )}
                <pre
                  className="p-4 text-xs whitespace-pre-wrap break-all overflow-y-auto max-h-[500px]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <code className="text-zinc-100 select-text cursor-auto">
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

function CustomToolUI({ tool, isLastMessage }: {
  tool: ToolInvocation;
  isLastMessage?: boolean;
}) {
  const { select } = useChatContext();

  if (tool.toolName.startsWith("HANDOFF_") && tool.state !== "result") {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border border-slate-200 rounded-2xl">
        <Spinner size="xs" variant="default" />
        <span>Delegating to {parseHandoffTool(tool.toolName)}</span>
      </div>
    );
  }

  if (tool.state !== "result" || !tool.result?.data) return null;
  switch (tool.toolName) {
    case "RENDER": {
      return (
        <Preview
          content={tool.result.data.content as "url" | "html"}
          title={tool.result.data.title as string}
        />
      );
    }
    case "HOSTING_APP_DEPLOY": {
      return (
        <Preview
          content={tool.result.data.content as "url" | "html"}
          title={tool.result.data.title as string}
        />
      );
    }
    case "CONFIGURE":
    case "AGENT_CREATE": {
      return (
        <div className="animate-in slide-in-from-bottom duration-300">
          <AgentCard
            id={tool.result.data.id as string}
            name={tool.result.data.name as string}
            description={tool.result.data.description as string}
            avatar={tool.result.data.avatar as string}
            displayLink={tool.toolName === "AGENT_CREATE"}
          />
        </div>
      );
    }
    case "SHOW_PICKER":
    case "CONFIRM": {
      const options = (tool.result.data.options as ConfirmOption[]).map((
        option,
      ) => ({
        id: option.value,
        ...option,
      }));

      return (
        <Picker
          question={tool.result.data.question as string}
          options={options}
          onSelect={(value) => select(tool.toolCallId, value)}
          disabled={!isLastMessage}
        />
      );
    }
    default: {
      if (tool.toolName.startsWith("HANDOFF_")) {
        const { threadId, agentId } = tool.result.data as {
          threadId: string;
          agentId: string;
        };
        return <HandoffResponse agentId={agentId} threadId={threadId} />;
      }
      return null;
    }
  }
}

export function ToolMessage({
  toolInvocations,
  isLastMessage,
}: ToolMessageProps) {
  // Separate tools into timeline tools and custom UI tools
  const timelineTools: ToolInvocation[] = [];
  const customUITools: ToolInvocation[] = [];

  toolInvocations.forEach((tool: ToolInvocation) => {
    if (isCustomUITool(tool.toolName)) {
      customUITools.push(tool);
    } else {
      timelineTools.push(tool);
    }
  });

  return (
    <div className="w-full space-y-4">
      {/* Timeline tools */}
      {timelineTools.length > 0 && (
        <div
          className={cn(
            "flex flex-col gap-2 w-full border border-slate-200 rounded-2xl",
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
