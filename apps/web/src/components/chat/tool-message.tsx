import { Button } from "@deco/ui/components/button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { ToolUIPart } from "ai";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { JsonViewer } from "./json-viewer.tsx";
import {
  HostingAppDeploy,
  HostingAppToolLike,
} from "./tools/hosting-app-deploy.tsx";
import { Preview } from "./tools/render-preview.tsx";

// Map ToolUIPart state to ToolLike state for custom UI components
const mapToToolLikeState = (
  state: ToolUIPart["state"],
): "call" | "result" | "error" | "partial-call" => {
  switch (state) {
    case "input-streaming":
    case "input-available":
      return "call";
    case "output-available":
      return "result";
    case "output-error":
      return "error";
    default:
      return "call";
  }
};

interface ToolMessageProps {
  part: ToolUIPart;
}

// Tools that have custom UI rendering and shouldn't show in the timeline
const CUSTOM_UI_TOOLS = new Set([
  "HOSTING_APP_DEPLOY",
  "RENDER",
  "GENERATE_IMAGE",
]);

// Helper to extract toolName from ToolUIPart (handles both static and dynamic tools)
function getToolName(part: ToolUIPart): string {
  if ("toolName" in part && typeof part.toolName === "string") {
    return part.toolName;
  }
  // Extract from type: "tool-TOOL_NAME" -> "TOOL_NAME"
  if (part.type.startsWith("tool-")) {
    return part.type.substring(5);
  }
  return "UNKNOWN_TOOL";
}

// Hook to memoize tool name extraction
function useToolName(part: ToolUIPart): string {
  const toolNameProp = "toolName" in part ? part.toolName : undefined;
  return useMemo(() => getToolName(part), [part.type, toolNameProp]);
}

function isCustomUITool(toolName: string): boolean {
  return CUSTOM_UI_TOOLS.has(toolName);
}

// Hook to memoize custom UI tool check
function useIsCustomUITool(part: ToolUIPart): boolean {
  const toolName = useToolName(part);
  return useMemo(() => isCustomUITool(toolName), [toolName]);
}

const ToolStatus = memo(function ToolStatus({
  part,
  isLast,
  isSingle,
}: {
  part: ToolUIPart;
  isLast: boolean;
  isSingle: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { state, input, output, errorText } = part;

  const toolName = useToolName(part);
  const isLoading = state === "input-streaming" || state === "input-available";
  const hasOutput = state === "output-available";
  const hasError = state === "output-error";

  const statusConfig = useMemo(() => {
    switch (state) {
      case "input-streaming":
        return {
          icon: <Icon name="arrow_downward" className="text-muted-foreground" />,
          iconBg: "bg-muted/30",
        };
      case "input-available":
        return {
          icon: <Icon name="arrow_upward" className="text-muted-foreground" />,
          iconBg: "bg-muted/30",
        };
      case "output-available":
        return {
          icon: <Icon name="check" className="text-primary-dark" />,
          iconBg: "bg-primary-light",
        };
      case "output-error":
        return {
          icon: <Icon name="close" className="text-destructive" />,
          iconBg: "bg-destructive/10",
        };
      default:
        return {
          icon: "•",
          iconBg: "bg-muted/30",
        };
    }
  }, [state]);

  const onClick = useCallback(() => {
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
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col relative",
        isSingle && "p-2.5 hover:bg-accent/25 rounded-2xl",
      )}
      onClick={isSingle ? onClick : undefined}
    >
      <div className="flex items-start gap-2">
        <button
          type="submit"
          onClick={isSingle ? undefined : onClick}
          className={cn(
            "w-full flex items-start gap-2 py-2 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors",
            !isSingle && "hover:bg-accent rounded-lg p-2",
          )}
        >
          <div className="relative flex flex-col items-center min-h-[20px]">
            <div
              className={cn(
                "size-5 rounded-full flex items-center justify-center",
                statusConfig.iconBg,
              )}
            >
              {statusConfig.icon}
            </div>
            {!isLast && !isExpanded && (
              <div className="w-[1px] h-[150%] bg-muted absolute top-5 left-1/2 transform -translate-x-1/2" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "font-medium truncate max-w-[60vw] md:max-w-full",
                  isLoading &&
                    "bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent",
                )}
              >
                {toolName}
              </div>
              <Icon
                className={cn("text-sm ml-auto", isExpanded && "rotate-90")}
                name="chevron_right"
              />
            </div>
          </div>
        </button>
      </div>

      {isExpanded && (
        <div
          ref={contentRef}
          className="text-left mt-2 space-y-3 w-full min-w-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Input Section */}
          {input !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_downward" className="size-3" />
                Input
              </div>
              <JsonViewer data={input} defaultView="tree" maxHeight="300px" />
            </div>
          )}

          {/* Output Section */}
          {hasOutput && output !== undefined && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1 flex items-center gap-2">
                <Icon name="arrow_upward" className="size-3" />
                Output
              </div>
              <JsonViewer data={output} defaultView="tree" maxHeight="300px" />
            </div>
          )}

          {/* Error Section */}
          {hasError && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-destructive px-1 flex items-center gap-2">
                <Icon name="error_outline" className="size-3" />
                Error
              </div>
              {errorText && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20 text-sm text-destructive">
                  {errorText}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

function ImagePrompt({
  prompt,
  isCollapsible = true,
}: {
  prompt: string;
  isCollapsible?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isCollapsible || prompt.length <= 60) {
    return (
      <p className="text-sm text-muted-foreground/80 leading-relaxed break-words whitespace-pre-wrap">
        {prompt}
      </p>
    );
  }

  const truncatedPrompt = prompt.slice(0, 60) + "...";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="space-y-2 w-full">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-sm text-muted-foreground/80 hover:text-muted-foreground font-normal justify-start w-full text-left"
          >
            <span className="leading-relaxed break-words flex-1 min-w-0">
              {truncatedPrompt}
            </span>
            <Icon
              name="chevron_right"
              className={cn(
                "ml-2 h-3 w-3 flex-shrink-0 transition-transform",
                isOpen && "rotate-90",
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="text-sm text-muted-foreground/80 leading-relaxed pl-4 border-l-2 border-muted break-words whitespace-pre-wrap">
            {prompt}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function GeneratingStatus() {
  return (
    <span className="font-medium bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent">
      Generating image...
    </span>
  );
}

function GenerateImageToolUI({ part }: { part: ToolUIPart }) {
  const state = part.state;
  const prompt =
    typeof part.input === "object" && part.input && "prompt" in part.input
      ? part.input.prompt
      : null;

  if (!prompt || typeof prompt !== "string") {
    return (
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/10 w-full max-w-full overflow-hidden">
        <p className="text-muted-foreground">Missing image prompt</p>
      </div>
    );
  }

  // Extract image URL from output.structuredContent.image
  const image =
    part.output &&
    typeof part.output === "object" &&
    "structuredContent" in part.output &&
    part.output.structuredContent &&
    typeof part.output.structuredContent === "object" &&
    "image" in part.output.structuredContent &&
    typeof part.output.structuredContent.image === "string"
      ? part.output.structuredContent.image
      : null;

  const isGenerating =
    state === "input-streaming" || state === "input-available";
  const isGenerated = state === "output-available" && image;
  const hasError = state === "output-error";

  if (hasError) {
    return (
      <div className="space-y-3 p-4 border border-destructive/20 rounded-lg bg-destructive/5 w-full max-w-full overflow-hidden">
        <div className="flex items-center gap-2 text-destructive">
          <Icon name="close" className="h-4 w-4" />
          <span className="font-medium">Failed to generate image</span>
        </div>
        <ImagePrompt prompt={prompt} />
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/20 w-full max-w-full overflow-hidden">
        <GeneratingStatus />
        <ImagePrompt prompt={prompt} />
      </div>
    );
  }

  if (isGenerated) {
    return (
      <div className="space-y-3 w-full max-w-full overflow-hidden">
        <ImagePrompt prompt={prompt} />
        <div className="rounded-lg overflow-hidden border border-border">
          <img
            src={image}
            alt={prompt}
            className="w-full max-h-[400px] object-cover"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-4 border border-border rounded-lg bg-muted/10 w-full max-w-full overflow-hidden">
      <p className="text-muted-foreground">No image generated</p>
      <ImagePrompt prompt={prompt} />
    </div>
  );
}

function CustomToolUI({ part }: { part: ToolUIPart }) {
  const result = (part.output ?? {}) as Record<string, unknown>;
  const toolName = useToolName(part);

  if (toolName === "HOSTING_APP_DEPLOY") {
    const toolLike: HostingAppToolLike = {
      toolCallId: part.toolCallId,
      toolName: toolName,
      state: mapToToolLikeState(part.state),
      args: part.input as HostingAppToolLike["args"],
    };
    return <HostingAppDeploy tool={toolLike} />;
  }

  if (part.state !== "output-available" || !part.output) return null;

  switch (toolName) {
    case "GENERATE_IMAGE": {
      return <GenerateImageToolUI part={part} />;
    }
    case "RENDER": {
      return (
        <Preview
          content={result.content as "url" | "html"}
          title={result.title as string}
        />
      );
    }
    default: {
      return null;
    }
  }
}

export const ToolMessage = memo(function ToolMessage({
  part,
}: ToolMessageProps) {
  const isCustomUI = useIsCustomUITool(part);

  return (
    <div className="w-full space-y-4">
      {isCustomUI ? (
        <CustomToolUI part={part} />
      ) : (
        <div className="flex flex-col gap-2 w-full border border-border rounded-2xl">
          <ToolStatus part={part} isLast={true} isSingle={true} />
        </div>
      )}
    </div>
  );
});
