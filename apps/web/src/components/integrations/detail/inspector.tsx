import type { MCPConnection } from "@deco/sdk";
import { useToolCall, useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary, useError } from "../../../error-boundary.tsx";
import { EmptyState } from "../../common/empty-state.tsx";
import { ConnStatus } from "./conn-status.tsx";
import { useFormContext } from "./context.ts";
import { ToolCallForm } from "./tool-call-form.tsx";
import { ToolCallResult } from "./tool-call-result.tsx";
import type { MCPToolCallResult } from "./types.ts";
import { formatToolName } from "../../chat/utils/format-tool-name.ts";
interface InspectorProps {
  connection: MCPConnection;
}

export function Inspector() {
  const { form } = useFormContext();

  const connection = form.watch("connection");

  return (
    <ErrorBoundary fallback={<Inspector.ErrorFallback />}>
      <Suspense fallback={<Inspector.Skeleton />}>
        <ScrollArea className="h-full w-full p-6 text-foreground">
          <Inspector.UI connection={connection} />
        </ScrollArea>
      </Suspense>
    </ErrorBoundary>
  );
}

Inspector.ErrorFallback = () => {
  const error = useError();

  return (
    <EmptyState
      icon="error"
      title="Error loading tools"
      description={error.state.error?.message ?? "An unknown error occurred"}
      buttonProps={{
        onClick: () => error.reset(),
        children: "Try Again",
      }}
    />
  );
};

Inspector.Skeleton = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <Spinner />
    </div>
  );
};

Inspector.UI = ({ connection }: InspectorProps) => {
  const tools = useTools(connection);
  const toolCall = useToolCall(connection);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [toolCallResponse, setToolCallResponse] = useState<
    MCPToolCallResult | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toolCallCardRef = useRef<HTMLDivElement>(null);
  const [instructionsExpanded, setInstructionsExpanded] = useState(false);

  // Filter tools based on search query
  const filteredTools = tools.data.tools.filter((tool) => {
    const query = searchQuery.toLowerCase();
    return (
      tool.name.toLowerCase().includes(query) ||
      (tool.description && tool.description.toLowerCase().includes(query))
    );
  });

  // Get the selected tool object
  const selectedToolObject = selectedTool
    ? tools.data.tools.find((t) => t.name === selectedTool)
    : null;

  // Scroll to tool call card when a tool is selected
  useEffect(() => {
    if (selectedTool && toolCallCardRef.current) {
      toolCallCardRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [selectedTool]);

  const handleToolCall = async (payload: Record<string, unknown>) => {
    if (!selectedTool) return;

    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    const startTime = performance.now();

    try {
      const response = await toolCall.mutateAsync({
        name: selectedTool,
        arguments: payload,
      });

      const endTime = performance.now();

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      setToolCallResponse({
        status: "ok",
        data: response,
        latency: endTime - startTime,
      });

      // Scroll to results automatically
      setTimeout(() => {
        const resultElement = document.querySelector("[data-tool-result]");
        resultElement?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      // Check if this was a cancellation
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      if (abortControllerRef.current?.signal.aborted) {
        return;
      }

      const endTime = performance.now();
      setToolCallResponse({
        status: "error",
        data: error,
        latency: endTime - startTime,
      });
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancelToolCall = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const handleSelectTool = (toolName: string) => {
    // If selecting a different tool, clear the previous response
    if (selectedTool !== toolName) {
      setToolCallResponse(null);
    }
    setSelectedTool(toolName);
  };

  const handleRefreshTools = () => {
    tools.refetch();
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between gap-2">
        <div className="text-2xl font-bold">
          Inspector
        </div>
      </div>

      {/* Tool Stats and Server Info Card */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          {/* Tool and Server Stats */}
          <div className="flex items-center flex-wrap gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Tools</div>
              <div className="text-2xl font-bold">
                {tools.data.tools.length}
              </div>
            </div>
            <Separator orientation="vertical" className="h-8" />
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="text-2xl font-bold">
                {tools.isLoading
                  ? "Loading..."
                  : tools.error
                  ? "Error"
                  : "Ready"}
              </div>
            </div>
            {tools.data.version && (
              <>
                <Separator orientation="vertical" className="h-8" />
                <div>
                  <div className="text-sm text-muted-foreground">Server</div>
                  <div className="text-lg font-medium">
                    {tools.data.version.name}
                    {tools.data.version.version && (
                      <span className="text-xs ml-2 text-muted-foreground">
                        v{tools.data.version.version}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
            <div className="flex-grow" />
            <ConnStatus tools={tools} />
          </div>

          {/* Capabilities section */}
          {tools.data.capabilities &&
            Object.values(tools.data.capabilities).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              <div className="text-sm text-muted-foreground mr-1">
                Capabilities:
              </div>
              {Object.keys(tools.data.capabilities).map((capability) => (
                <div
                  key={capability}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                >
                  {capability}
                </div>
              ))}
            </div>
          )}

          {/* Server Instructions section */}
          {tools.data.instructions && (
            <div className="mt-2">
              <Separator className="mb-3" />
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm font-medium text-muted-foreground">
                  Server Instructions
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                >
                  <Icon
                    name={instructionsExpanded ? "expand_less" : "expand_more"}
                    className="h-4 w-4"
                  />
                  <span className="sr-only">
                    {instructionsExpanded ? "Collapse" : "Expand"} instructions
                  </span>
                </Button>
              </div>
              <div
                className={cn(
                  "text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 p-3 rounded-md transition-all overflow-hidden",
                  instructionsExpanded
                    ? "max-h-[300px] overflow-y-auto"
                    : "max-h-16",
                )}
              >
                {tools.data.instructions}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Error state */}
      {tools.error
        ? (
          <Card className="p-6 border-destructive">
            <div className="flex flex-col items-center text-center mb-4">
              <div className="inline-flex items-center justify-center bg-destructive/10 text-destructive rounded-full h-12 w-12 p-3 mb-4">
                <Icon name="error" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                Failed to Load Tools
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                There was an error loading the available tools. This might be
                due to connection issues or server problems.
              </p>
              <div className="text-xs text-destructive bg-destructive/10 p-3 rounded-md mb-4 max-w-md mx-auto overflow-auto text-left">
                <pre className="whitespace-pre-wrap break-words">
                {tools.error.message || String(tools.error)}
                </pre>
              </div>
            </div>
            <div className="flex justify-center">
              <Button
                onClick={handleRefreshTools}
                disabled={tools.isLoading}
                className="gap-2"
              >
                {tools.isLoading
                  ? (
                    <>
                      <Spinner size="xs" /> Refreshing...
                    </>
                  )
                  : (
                    <>
                      <Icon name="refresh" /> Try Again
                    </>
                  )}
              </Button>
            </div>
          </Card>
        )
        : (
          /* Main content with search and tool call */
          <div
            className={cn(
              "grid grid-cols-1 gap-4",
              tools.isLoading && "invisible",
            )}
          >
            {/* Tool Search Section */}
            <Card className="p-4">
              <div className="text-lg font-semibold mb-4">Available Tools</div>

              {/* Search input */}
              <div className="relative mb-4">
                <Icon
                  name="search"
                  className="absolute top-1/2 left-3 -translate-y-1/2 text-lg text-muted-foreground"
                />
                <Input
                  type="text"
                  placeholder="Search tools by name or description..."
                  className="pl-8 pr-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground inline-flex items-center"
                  >
                    <Icon name="close" className="text-lg" />
                  </button>
                )}
              </div>

              {/* Tools list */}
              <div className="space-y-2 overflow-y-auto pr-2">
                {filteredTools.length > 0
                  ? (
                    filteredTools.map((tool) => (
                      <div
                        key={tool.name}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-colors",
                          selectedTool === tool.name
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-muted/50 border-border",
                        )}
                        onClick={() => handleSelectTool(tool.name)}
                      >
                        <div className="truncate font-medium">
                          {formatToolName(tool.name)}
                        </div>
                        <p
                          className="text-sm text-muted-foreground mt-2 line-clamp-2"
                          title={tool.description}
                        >
                          {tool.description}
                        </p>
                      </div>
                    ))
                  )
                  : (
                    <div className="p-8 text-center text-muted-foreground">
                      No tools found matching "{searchQuery}"
                    </div>
                  )}
              </div>
            </Card>

            {/* Tool Call Form or Empty State */}
            <div className="flex flex-col gap-4">
              <Card className="p-4" ref={toolCallCardRef}>
                {selectedToolObject
                  ? (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-semibold truncate">
                            {selectedToolObject.name}
                          </h3>
                        </div>
                        {selectedToolObject.description && (
                          <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">
                            {selectedToolObject.description}
                          </p>
                        )}
                        <Separator />
                      </div>
                      <ToolCallForm
                        rawMode={false}
                        key={selectedToolObject.name}
                        tool={selectedToolObject}
                        onSubmit={handleToolCall}
                        onCancel={handleCancelToolCall}
                        isLoading={isLoading}
                      />
                    </>
                  )
                  : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="inline-flex items-center justify-center bg-muted rounded-full mb-4 h-14 w-14">
                        <Icon name="code" className="text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">
                        No Tool Selected
                      </h3>
                      <p className="text-sm text-muted-foreground max-w-xs mx-auto mb-6">
                        Select a tool from the list to view its details and
                        execute tool calls
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Icon name="west" className="md:block hidden" />
                        <Icon name="north" className="md:hidden" />
                        <span>Choose a tool to get started</span>
                      </div>
                    </div>
                  )}
              </Card>
              {/* Tool Call Result */}
              {toolCallResponse && (
                <Card className="p-4" data-tool-result>
                  <ToolCallResult response={toolCallResponse} />
                </Card>
              )}
            </div>
          </div>
        )}
    </div>
  );
};
