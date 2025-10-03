import { ToolDefinitionSchema, useToolByUriV2, useToolCallV2 } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import Form from "@rjsf/shadcn";
import validator from "@rjsf/validator-ajv8";
import { useCallback, useState } from "react";
import { z } from "zod/v3";
import { EmptyState } from "../common/empty-state.tsx";
import { ToolCallResultV2 } from "@deco/sdk/hooks";

// Tool type inferred from the Zod schema
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// Extended tool type for display (includes optional metadata)
export interface DisplayTool extends ToolDefinition {
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ToolDisplayCanvasProps {
  resourceUri: string;
}

/**
 * Read-only tool display canvas that shows tool details
 * No interactions - just visual representation
 */
export function ToolDetail({ resourceUri }: ToolDisplayCanvasProps) {
  const {
    data: resource,
    isLoading: isLoading,
    refetch,
  } = useToolByUriV2(resourceUri);
  const effectiveTool = resource?.data;

  // Local loading state for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Tool execution state
  const [executionResult, setExecutionResult] =
    useState<ToolCallResultV2 | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStats, setExecutionStats] = useState<{
    latency?: number;
    byteSize?: number;
    estimatedTokens?: number;
  }>({});

  // Form data state to prevent clearing after submission
  const [formData, setFormData] = useState<Record<string, unknown>>({});

  // Tool call hook
  const toolCallMutation = useToolCallV2();

  // Token estimation function
  const estimateTokens = useCallback((text: string): number => {
    if (!text || typeof text !== "string") return 0;

    // Split by whitespace to get words
    const words = text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
    const wordCount = words.length;

    // Count punctuation marks and special characters
    const punctuationCount = (text.match(/[.,!?;:"'()]/g) || []).length;

    // Estimate tokens: ~1.3 tokens per word + 1 token per punctuation
    const estimatedTokens = Math.ceil(wordCount * 1.3 + punctuationCount);

    return estimatedTokens;
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    try {
      setIsRefreshing(true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refetch]);

  const handleFormSubmit = useCallback(
    async (formData: Record<string, unknown>) => {
      if (!effectiveTool || !resourceUri) return;

      try {
        setIsExecuting(true);
        setExecutionResult(null);
        setExecutionStats({});

        const startTime = performance.now();
        const inputByteSize = new Blob([JSON.stringify(formData)]).size;
        const inputText = JSON.stringify(formData);
        const inputTokens = estimateTokens(inputText);

        const result = await toolCallMutation.mutateAsync({
          params: {
            uri: resourceUri,
            input: formData,
          },
        });

        const endTime = performance.now();
        const latency = endTime - startTime;
        const resultByteSize = new Blob([JSON.stringify(result)]).size;
        const resultText = JSON.stringify(result);
        const resultTokens = estimateTokens(resultText);

        setExecutionResult(result);
        setExecutionStats({
          latency: Math.round(latency),
          byteSize: inputByteSize + resultByteSize,
          estimatedTokens: inputTokens + resultTokens,
        });
      } catch (error) {
        console.error("Tool execution failed:", error);
        setExecutionResult({
          error:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      } finally {
        setIsExecuting(false);
      }
    },
    [effectiveTool, resourceUri, toolCallMutation],
  );

  if (isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="text-center">
          <Icon
            name="refresh"
            size={24}
            className="animate-spin mx-auto mb-2"
          />
          <p className="text-muted-foreground">Loading tool...</p>
        </div>
      </div>
    );
  }

  if (!effectiveTool) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <EmptyState
          icon="error"
          title="Tool not found"
          description="The requested tool could not be found or is not available."
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold">
            {effectiveTool?.name || resourceUri || "Tool"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {effectiveTool?.description}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          variant="outline"
          size="sm"
          className="min-w-[100px]"
        >
          <Icon
            name="refresh"
            size={16}
            className={`mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 space-y-6 overflow-auto">
        {/* Execute Tool Form */}
        {effectiveTool.inputSchema && (
          <Card className="p-4">
            <CardHeader className="px-0">
              <CardTitle className="flex items-center gap-2">
                <Icon name="play_arrow" size={20} />
                Execute Tool
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form
                schema={effectiveTool.inputSchema}
                validator={validator}
                formData={formData}
                onChange={({ formData }) => setFormData(formData)}
                onSubmit={({ formData }) => handleFormSubmit(formData)}
                showErrorList={false}
                noHtml5Validate
                liveValidate={false}
              >
                <div className="flex justify-end gap-2 mt-4">
                  <Button
                    type="submit"
                    disabled={isExecuting}
                    className="min-w-[100px]"
                  >
                    {isExecuting ? (
                      <>
                        <Icon
                          name="refresh"
                          size={16}
                          className="animate-spin mr-2"
                        />
                        Executing...
                      </>
                    ) : (
                      <>
                        <Icon name="play_arrow" size={16} className="mr-2" />
                        Execute
                      </>
                    )}
                  </Button>
                </div>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Execution Result */}
        {executionResult && (
          <Card className="p-4">
            <CardHeader className="px-0">
              <CardTitle className="flex items-center gap-2">
                <Icon name="check_circle" size={20} />
                Execution Result
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Stats */}
              {executionStats.latency && (
                <div className="mb-4 flex gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Icon name="schedule" size={14} />
                    <span>{executionStats.latency}ms</span>
                  </div>
                  {executionStats.byteSize && (
                    <div className="flex items-center gap-1">
                      <Icon name="storage" size={14} />
                      <span>{executionStats.byteSize} bytes</span>
                    </div>
                  )}
                  {executionStats.estimatedTokens && (
                    <div className="flex items-center gap-1">
                      <Icon name="token" size={14} />
                      <span>~{executionStats.estimatedTokens} tokens</span>
                    </div>
                  )}
                </div>
              )}

              {/* Error Display */}
              {executionResult.error ? (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-destructive text-sm font-medium">Error:</p>
                  <p className="text-destructive text-sm">
                    {JSON.stringify(executionResult.error)}
                  </p>
                </div>
              ) : (
                <>
                  {/* Logs */}
                  {executionResult.logs && executionResult.logs.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">
                        Console Logs:
                      </h4>
                      <div className="bg-muted p-3 rounded-md max-h-32 overflow-auto">
                        {executionResult.logs.map((log, index) => (
                          <div
                            key={index}
                            className={`text-xs font-mono ${
                              log.type === "error"
                                ? "text-destructive"
                                : log.type === "warn"
                                  ? "text-yellow-600"
                                  : "text-muted-foreground"
                            }`}
                          >
                            [{log.type.toUpperCase()}] {log.content}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Result */}
                  <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-96">
                    {JSON.stringify(
                      executionResult.result || executionResult,
                      null,
                      2,
                    )}
                  </pre>
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
