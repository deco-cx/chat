// deno-lint-ignore-file no-explicit-any
import type { Message } from "@ai-sdk/react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useState } from "react";
import { Picker } from "./Picker.tsx";
import { AgentCard } from "./tools/AgentCard.tsx";
import { Preview } from "./tools/Preview.tsx";

interface ToolInvocationsProps {
  toolInvocations?: Message["toolInvocations"];
  handlePickerSelect: (
    toolCallId: string,
    selectedValue: string,
  ) => Promise<void>;
}

function ToolStatus(
  { tool }: { tool: NonNullable<Message["toolInvocations"]>[0] },
) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getIcon = (state: string) => {
    switch (state) {
      case "call":
        return "⚡";
      case "result":
        return "✓";
      case "error":
        return "✕";
      default:
        return "•";
    }
  };

  const getStatusText = (state: string) => {
    switch (state) {
      case "call":
        return "Running";
      case "result":
        return "Complete";
      case "error":
        return "Failed";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="submit"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="w-4 inline-flex justify-center">
          {tool.state === "call"
            ? <Spinner variant="special" size="xs" />
            : getIcon(tool.state)}
        </span>
        <span className="font-medium">
          {tool.toolName}
        </span>
        <span className="text-xs opacity-70">
          {getStatusText(tool.state)}
        </span>
        <span className="text-xs opacity-50 py-0.5 px-1 border border-border rounded-lg">
          {isExpanded ? "Hide details" : "Show details"}
        </span>
      </button>

      {isExpanded && (
        <div className="mt-2 rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden w-full">
          <pre className="p-4 text-xs whitespace-pre-wrap break-all">
            <code className="text-zinc-100">
              {JSON.stringify(
                {
                  toolName: tool.toolName,
                  state: tool.state,
                  args: tool.args,
                  result: (tool as any).result,
                  error: (tool as any).error,
                },
                null,
                2
              ).replace(/"(\w+)":/g, '"$1":')}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

const HIDE_STATUS_TOOLS = ["RENDER", "SHOW_PICKER", "CONFIRM"];

export function ToolInvocations({
  toolInvocations,
  handlePickerSelect,
}: ToolInvocationsProps) {
  if (!toolInvocations?.length) return null;

  return (
    <div className="relative z-20 flex flex-col gap-4">
      {toolInvocations.map((tool) => (
        <div key={tool.toolCallId} className="flex flex-col gap-2">
          {/* Show tool execution status for all tools except RENDER */}
          {!HIDE_STATUS_TOOLS.includes(tool.toolName) && (
            <ToolStatus tool={tool} />
          )}

          {/* Custom UI components */}
          {tool.state === "result" && (
            <>
              {tool.toolName === "RENDER" && tool.result?.data?.type && (
                <Preview
                  type={tool.result.data.type}
                  content={tool.result.data.content}
                  title={tool.result.data.title}
                />
              )}

              {(tool.toolName === "CONFIGURE" ||
                tool.toolName === "AGENT_CREATE") && tool.result && (
                <div className="animate-in slide-in-from-bottom duration-300">
                  <AgentCard
                    id={tool.result.data?.id}
                    name={tool.result.data?.name}
                    description={tool.result.data?.description}
                    avatar={tool.result.data?.avatar}
                    displayLink={tool.toolName === "AGENT_CREATE"}
                  />
                </div>
              )}

              {(tool.toolName === "SHOW_PICKER" ||
                tool.toolName === "CONFIRM") && tool.result && (
                <Picker
                  question={tool.result.data.question}
                  options={tool.result.data.options}
                  onSelect={(value) =>
                    handlePickerSelect(tool.toolCallId, value)}
                />
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
