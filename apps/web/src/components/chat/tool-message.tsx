import { Button } from "@deco/ui/components/button.tsx";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@deco/ui/components/collapsible.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { lazy, memo, Suspense, useMemo, useRef, useState } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useAgent } from "../agent/provider.tsx";
import { Picker } from "./chat-picker.tsx";
import { AgentCard } from "./tools/agent-card.tsx";

const LazyHighlighter = lazy(() => import("./lazy-highlighter.tsx"));
import {
  HostingAppDeploy,
  HostingAppToolLike,
} from "./tools/hosting-app-deploy.tsx";
import { Preview } from "./tools/render-preview.tsx";
import { formatToolName } from "./utils/format-tool-name.ts";

interface ConfirmOption {
  value: string;
  label: string;
}

// Map ToolInvocation state to ToolLike state for custom UI components
const mapToToolLikeState = (
  state: ToolInvocation["state"],
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
  part: {
    type: string;
    toolCallId: string;
    state?: string;
    input?: unknown;
    output?: unknown;
    errorText?: string;
  };
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
  "GENERATE_IMAGE",
] as const;
type CustomUITool = (typeof CUSTOM_UI_TOOLS)[number];

interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  input?: unknown;
  output?: unknown;
  errorText?: string;
}

function isCustomUITool(toolName: string): toolName is CustomUITool {
  return CUSTOM_UI_TOOLS.includes(toolName as CustomUITool);
}

const MAX_TREE_DEPTH = 10;

const TreeNode = memo(function TreeNode({
  nodeKey,
  value,
  level = 0,
}: {
  nodeKey?: string;
  value: unknown;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const indent = level * 16;

  const getValueType = (val: unknown): string => {
    if (val === null) return "null";
    if (Array.isArray(val)) return "array";
    if (typeof val === "object") return "object";
    return typeof val;
  };

  const getCount = (val: unknown): number | null => {
    if (Array.isArray(val)) return val.length;
    if (val && typeof val === "object") return Object.keys(val).length;
    return null;
  };

  const isExpandable = (val: unknown): boolean => {
    return (
      (Array.isArray(val) && val.length > 0) ||
      (val !== null &&
        typeof val === "object" &&
        Object.keys(val as object).length > 0)
    );
  };

  const valueType = getValueType(value);
  const count = getCount(value);
  const canExpand = isExpandable(value);

  // Check for max depth - prevents infinite recursion and excessive nesting
  if (level >= MAX_TREE_DEPTH && canExpand) {
    return (
      <div
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 text-sm leading-normal"
      >
        <div className="w-4 flex-shrink-0" />
        {nodeKey && (
          <span className="text-[#82AAFF] flex-shrink-0">{nodeKey}:</span>
        )}
        <span className="text-[#546E7A] break-words">[Max Depth Reached]</span>
      </div>
    );
  }

  // Render primitive values
  if (!canExpand) {
    return (
      <div
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 text-sm leading-normal"
      >
        <div className="w-4 flex-shrink-0" />{" "}
        {/* Space for chevron alignment */}
        {nodeKey && (
          <span className="text-[#82AAFF] flex-shrink-0">{nodeKey}:</span>
        )}
        {value === null ? (
          <span className="text-[#C792EA] break-words">null</span>
        ) : typeof value === "boolean" ? (
          <span className="text-[#C792EA] break-words">{value.toString()}</span>
        ) : typeof value === "number" ? (
          <span className="text-[#F78C6C] break-words">{value}</span>
        ) : typeof value === "string" ? (
          <span className="text-[#C3E88D] break-words">{value}</span>
        ) : (
          <span className="text-[#EEFFFF] break-words">{String(value)}</span>
        )}
      </div>
    );
  }

  // Render expandable objects/arrays
  const entries = useMemo(
    () =>
      Array.isArray(value)
        ? value.map((item, index) => [index.toString(), item] as const)
        : Object.entries(value as Record<string, unknown>),
    [value],
  );

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 w-full text-left hover:bg-white/5 transition-colors rounded leading-normal"
      >
        <Icon
          name="chevron_right"
          className={cn(
            "w-4 h-4 text-[#546E7A] transition-transform flex-shrink-0 mt-0.5",
            isOpen && "rotate-90",
          )}
        />
        {nodeKey && (
          <span className="text-[#82AAFF] flex-shrink-0">{nodeKey}</span>
        )}
        <span className="text-[#546E7A]">
          {valueType}{" "}
          {count !== null && (
            <span className="text-[#89DDFF]">{`{${count}}`}</span>
          )}
        </span>
      </button>
      {isOpen && (
        <div>
          {entries.map(([key, val]) => (
            <TreeNode key={key} nodeKey={key} value={val} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
});

function JsonTreeView({ data }: { data: unknown }) {
  return (
    <div
      className="p-4 text-sm overflow-auto rounded-lg max-h-[500px]"
      style={{ background: "#263238" }}
    >
      <TreeNode value={data} level={0} />
    </div>
  );
}

const ToolStatus = memo(function ToolStatus({
  tool,
  isLast,
  isSingle,
}: {
  tool: ToolInvocation;
  isLast: boolean;
  isSingle: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showButtons, setShowButtons] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "tree">("code");
  const contentRef = useRef<HTMLDivElement>(null);

  const isLoading =
    tool.state === "input-streaming" || tool.state === "input-available";

  const getIcon = (state: string) => {
    switch (state) {
      case "input-streaming":
      case "input-available":
        return (
          <div className="[&>div>svg]:!animate-[spin_0.7s_linear_infinite]">
            <Spinner size="xs" variant="default" />
          </div>
        );
      case "output-available":
        return <Icon name="check" className="text-primary-dark" />;
      case "output-error":
        return <Icon name="close" className="text-destructive" />;
      default:
        return "•";
    }
  };

  const toolName = useMemo(() => {
    if (!tool.toolName) {
      return "Unknown tool";
    }
    if (tool.toolName.startsWith("AGENT_GENERATE_")) {
      return `Delegating to agent`;
    }
    return formatToolName(tool.toolName);
  }, [tool.toolName]);

  // Only compute expensive data when expanded to avoid lag during streaming
  const toolData = useMemo(() => {
    if (!isExpanded) return null;
    return {
      toolName: tool.toolName,
      state: tool.state,
      input: tool.input,
      output: tool.output,
      errorText: tool.errorText,
    };
  }, [
    isExpanded,
    tool.toolName,
    tool.state,
    tool.input,
    tool.output,
    tool.errorText,
  ]);

  const toolJson = useMemo(() => {
    if (!isExpanded || !toolData) return "";
    return JSON.stringify(toolData, null, 2).replace(/"(\w+)":/g, '"$1":');
  }, [isExpanded, toolData]);

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
    // Compute on-demand if not already computed
    const jsonToCopy =
      toolJson ||
      JSON.stringify(
        {
          toolName: tool.toolName,
          state: tool.state,
          input: tool.input,
          output: tool.output,
          errorText: tool.errorText,
        },
        null,
        2,
      ).replace(/"(\w+)":/g, '"$1":');
    navigator.clipboard.writeText(jsonToCopy);
  };

  return (
    <div
      className={cn(
        "flex flex-col relative",
        isSingle && "p-2.5 hover:bg-accent/25 rounded-2xl",
      )}
      onClick={isSingle ? onClick : undefined}
      onMouseEnter={() => setShowButtons(true)}
      onMouseLeave={() => setShowButtons(false)}
      onFocus={() => setShowButtons(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setShowButtons(false);
        }
      }}
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
                "size-5 rounded-full flex items-center justify-center bg-primary-light",
              )}
            >
              {getIcon(tool.state)}
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
          className="text-left mt-2 rounded-lg overflow-hidden w-full relative min-w-0 grid"
          onClick={(e) => e.stopPropagation()}
        >
          {showButtons && (
            <div className="absolute top-2 right-2 flex items-center bg-background gap-0.5 shadow-sm rounded-md z-10">
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode((prev) => (prev === "code" ? "tree" : "code"));
                }}
                className="size-8 rounded-none rounded-l-md hover:bg-accent/50 transition-colors"
                title={
                  viewMode === "code" ? "Show tree view" : "Show code view"
                }
              >
                <Icon
                  name={viewMode === "code" ? "account_tree" : "code"}
                  className="w-4 h-4 text-muted-foreground"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                }}
                className="size-8 rounded-none rounded-r-md hover:bg-accent/50 transition-colors"
                title="Copy tool details"
              >
                <Icon
                  name="content_copy"
                  className="w-4 h-4 text-muted-foreground"
                />
              </Button>
            </div>
          )}
          <div
            className="overflow-x-auto overflow-y-auto max-h-[500px] min-w-0"
            onClick={(e) => e.stopPropagation()}
          >
            {viewMode === "code" ? (
              <ErrorBoundary
                fallback={
                  <pre
                    className="p-4 text-xs whitespace-pre-wrap break-all rounded-lg m-0"
                    style={{ background: "#263238", color: "#EEFFFF" }}
                  >
                    <code className="select-text cursor-auto">
                      {toolJson || "Loading..."}
                    </code>
                  </pre>
                }
              >
                <Suspense
                  fallback={
                    <pre
                      className="p-4 text-xs whitespace-pre-wrap break-all rounded-lg m-0"
                      style={{ background: "#263238", color: "#EEFFFF" }}
                    >
                      <code className="select-text cursor-auto">
                        {toolJson || "Loading..."}
                      </code>
                    </pre>
                  }
                >
                  <LazyHighlighter language="json" content={toolJson || "{}"} />
                </Suspense>
              </ErrorBoundary>
            ) : toolData ? (
              <JsonTreeView data={toolData} />
            ) : null}
          </div>
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
    <div className="flex items-center gap-3">
      <span className="font-medium bg-gradient-to-r from-foreground via-foreground/50 to-foreground bg-[length:200%_100%] animate-shimmer bg-clip-text text-transparent">
        Generating image...
      </span>
      <Spinner size="xs" variant="default" />
    </div>
  );
}

function GenerateImageToolUI({ tool }: { tool: ToolInvocation }) {
  const state = tool.state;
  const prompt =
    typeof tool.input === "object" && tool.input && "prompt" in tool.input
      ? tool.input.prompt
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
    tool.output &&
    typeof tool.output === "object" &&
    "structuredContent" in tool.output &&
    tool.output.structuredContent &&
    typeof tool.output.structuredContent === "object" &&
    "image" in tool.output.structuredContent &&
    typeof tool.output.structuredContent.image === "string"
      ? tool.output.structuredContent.image
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

function CustomToolUI({
  tool,
  isLastMessage,
}: {
  tool: ToolInvocation;
  isLastMessage?: boolean;
}) {
  const { select } = useAgent();
  const result = (tool.output ?? {}) as Record<string, unknown>;

  if (tool.toolName === "HOSTING_APP_DEPLOY") {
    const toolLike: HostingAppToolLike = {
      toolCallId: tool.toolCallId,
      toolName: tool.toolName,
      state: mapToToolLikeState(tool.state),
      args: tool.input as HostingAppToolLike["args"],
    };
    return <HostingAppDeploy tool={toolLike} />;
  }

  if (tool.state !== "output-available" || !tool.output) return null;

  switch (tool.toolName) {
    case "GENERATE_IMAGE": {
      return <GenerateImageToolUI tool={tool} />;
    }
    case "RENDER": {
      return (
        <Preview
          content={result.content as "url" | "html"}
          title={result.title as string}
        />
      );
    }

    case "CONFIGURE":
    case "AGENT_CREATE": {
      return (
        <div className="animate-in slide-in-from-bottom duration-300">
          <AgentCard
            id={result.id as string}
            name={result.name as string}
            description={result.description as string}
            avatar={result.avatar as string}
            displayLink={tool.toolName === "AGENT_CREATE"}
          />
        </div>
      );
    }
    case "SHOW_PICKER":
    case "CONFIRM": {
      const options = (result.options as ConfirmOption[]).map((option) => ({
        id: option.value,
        ...option,
      }));

      return (
        <Picker
          question={result.question as string}
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

export function ToolMessage({ part, isLastMessage }: ToolMessageProps) {
  // Extract tool name from part type
  const toolName = part.type.startsWith("tool-")
    ? part.type.substring(5)
    : "UNKNOWN_TOOL";

  // Create tool invocation from part
  const toolInvocations: ToolInvocation[] = [
    {
      toolCallId: part.toolCallId,
      toolName: toolName,
      state: (part.state as ToolInvocation["state"]) || "input-available",
      input: part.input,
      output: part.output,
      errorText: part.errorText,
    },
  ];
  // Separate tools into timeline tools and custom UI tools using memoization
  const { timelineTools, customUITools } = useMemo(() => {
    const timeline: ToolInvocation[] = [];
    const customUI: ToolInvocation[] = [];

    toolInvocations.forEach((tool: ToolInvocation) => {
      // Extract tool name from the tool object - it should have a toolName property
      const toolName = tool.toolName || "Unknown tool";
      if (isCustomUITool(toolName)) {
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
