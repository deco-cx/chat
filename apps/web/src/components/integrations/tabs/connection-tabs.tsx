// deno-lint-ignore-file no-explicit-any
import {
  buildAddViewPayload,
  findPinnedView,
  listTools,
  useAddView,
  useConnectionViews,
  useRemoveView,
  useSDK,
  useToolCall,
  useTools,
  type Integration,
  type MCPConnection,
  type MCPTool,
} from "@deco/sdk";
import { Binding, WellKnownBindings } from "@deco/sdk/mcp/bindings";
import { Button } from "@deco/ui/components/button.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import { Form } from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Switch } from "@deco/ui/components/switch.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { ajvResolver } from "@hookform/resolvers/ajv";
import type { JSONSchema7 } from "json-schema";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { formatToolName } from "../../chat/utils/format-tool-name.ts";
import { EmptyState } from "../../common/empty-state.tsx";
import JSONSchemaForm from "../../json-schema/index.tsx";
import { generateDefaultValues } from "../../json-schema/utils/generate-default-values.ts";
import { useCurrentTeam } from "../../sidebar/team-selector.tsx";
import { useGroupedApp } from "../apps.ts";
import { ToolCallResult } from "../tool-call-result.tsx";
import type { MCPToolCallResult } from "../types.ts";
import { ResourcesV2UI } from "./resources.tsx";
import {
  resourcesV2Checker,
  useCompliance,
  viewsV2Checker,
  workflowsV2Checker,
} from "./utils.ts";
import { ViewsV2UI } from "./views.tsx";
import { WorkflowsV2UI } from "./workflows.tsx";

interface ToolProps {
  tool: MCPTool;
  params: MCPConnection | { id: string };
  readOnly?: boolean;
}

interface UnifiedToolInterfaceProps {
  tool: MCPTool;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  readOnly?: boolean;
  toolCallResponse: MCPToolCallResult | null;
}

function UnifiedToolInterface({
  tool,
  onSubmit,
  onCancel,
  isLoading,
  readOnly,
  toolCallResponse,
}: UnifiedToolInterfaceProps) {
  const [error, setError] = useState<string | null>(null);
  const [useFormMode, setUseFormMode] = useState(true);
  const [rawJson, setRawJson] = useState("{}");

  // Initialize form with default values based on the schema
  const form = useForm<Record<string, unknown>>({
    defaultValues: generateDefaultValues(tool.inputSchema as JSONSchema7),
    resolver: ajvResolver(tool.inputSchema as any),
  });

  const handleFormSubmit = form.handleSubmit(async (data) => {
    try {
      setError(null);
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting form");
    }
  });

  const handleRawSubmit = async () => {
    try {
      const parsedPayload = JSON.parse(rawJson);
      setError(null);
      await onSubmit(parsedPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON payload");
    }
  };

  const handleCancel = () => {
    form.reset();
    setError(null);
    onCancel();
  };

  return (
    <div className="space-y-6">
      {/* Mode Switcher */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="edit" size={16} className="text-muted-foreground" />
          <h3 className="text-sm font-medium">Execute Tool</h3>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={useFormMode} onCheckedChange={setUseFormMode} />
          <div className="flex items-center gap-2">
            <Icon name="lists" size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Form</span>
          </div>
        </div>
      </div>

      {/* Form or Raw JSON Input */}
      {useFormMode ? (
        <Form {...form}>
          <JSONSchemaForm
            schema={tool.inputSchema as JSONSchema7}
            form={form}
            disabled={isLoading}
            onSubmit={handleFormSubmit}
            error={error}
            submitButton={
              <div className="flex gap-2 mt-4">
                <Button
                  type="submit"
                  className="flex-1 gap-2"
                  disabled={isLoading || readOnly}
                >
                  {isLoading ? (
                    <>
                      <Spinner size="xs" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Icon name="play_arrow" size={16} />
                      Execute Tool
                    </>
                  )}
                </Button>
                {isLoading && (
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="flex items-center gap-2"
                  >
                    <Icon name="close" size={16} />
                    Cancel
                  </Button>
                )}
              </div>
            }
          />
        </Form>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Raw JSON Payload</label>
            <Textarea
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              placeholder="Enter JSON payload..."
              className="w-full h-32 font-mono text-sm resize-none"
              disabled={isLoading}
            />
            {error && <div className="text-sm text-destructive">{error}</div>}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleRawSubmit}
              className="flex-1 gap-2"
              disabled={isLoading || readOnly}
            >
              {isLoading ? (
                <>
                  <Spinner size="xs" />
                  Processing...
                </>
              ) : (
                <>
                  <Icon name="play_arrow" size={16} />
                  Execute Tool
                </>
              )}
            </Button>
            {isLoading && (
              <Button
                variant="outline"
                onClick={handleCancel}
                className="flex items-center gap-2"
              >
                <Icon name="close" size={16} />
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {toolCallResponse && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Icon name="check_circle" size={16} className="text-success" />
            <h3 className="text-sm font-medium">Execution Result</h3>
          </div>
          <Card className="p-4" data-tool-result>
            <ToolCallResult response={toolCallResponse} />
          </Card>
        </div>
      )}
    </div>
  );
}

function Tool({ tool, params: connection, readOnly }: ToolProps) {
  const { locator } = useSDK();
  const toolCall = useToolCall(connection, locator);
  const [toolCallResponse, setToolCallResponse] =
    useState<MCPToolCallResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleToolCall = async (payload: Record<string, unknown>) => {
    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    const startTime = performance.now();
    try {
      const response = await toolCall.mutateAsync({
        name: tool.name,
        arguments: payload,
      });
      const endTime = performance.now();
      if (abortControllerRef.current?.signal.aborted) return;
      setToolCallResponse({
        status: "ok",
        data: response,
        latency: endTime - startTime,
      });
      setTimeout(() => {
        const resultElement = document.querySelector("[data-tool-result]");
        resultElement?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (abortControllerRef.current?.signal.aborted) return;
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

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem
        value={tool.name}
        className="border border-border overflow-hidden !border-b rounded-xl p-0"
      >
        <AccordionTrigger className="p-4 hover:no-underline cursor-pointer hover:bg-accent rounded-t-xl rounded-b-none">
          <div className="flex items-start gap-3 w-full text-left">
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="font-medium text-sm truncate">
                {formatToolName(tool.name)}
              </div>
              {tool.description && (
                <div
                  className="text-sm font-normal text-muted-foreground line-clamp-2"
                  title={tool.description}
                >
                  {tool.description}
                </div>
              )}
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-secondary/50 p-4">
          <UnifiedToolInterface
            tool={tool}
            onSubmit={handleToolCall}
            onCancel={handleCancelToolCall}
            isLoading={isLoading}
            readOnly={readOnly}
            toolCallResponse={toolCallResponse}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function ToolsInspector({
  data,
  selectedConnectionId,
  startsWith,
  readOnly,
}: {
  data: ReturnType<typeof useGroupedApp>;
  selectedConnectionId?: string;
  startsWith?: string;
  readOnly?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(data.instances?.[0]?.id ?? null);

  const toolsRef = useRef<HTMLDivElement>(null);

  const selectedIntegration = useMemo(() => {
    return (
      data.instances?.find((i) => i.id === selectedIntegrationId) ??
      data.instances?.[0] ??
      null
    );
  }, [data.instances, selectedIntegrationId]);

  const connection =
    selectedIntegration?.connection || data?.info?.connection || {};

  const tools = useTools(connection as MCPConnection, true);

  useEffect(() => {
    if (selectedConnectionId) {
      setSelectedIntegrationId(selectedConnectionId);
      setTimeout(() => {
        toolsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 100);
    }
  }, [selectedConnectionId]);

  const filteredTools = tools.data.tools.filter(
    (tool) =>
      (tool.name.toLowerCase().includes(search.toLowerCase()) ||
        (tool.description &&
          tool.description.toLowerCase().includes(search.toLowerCase()))) &&
      (startsWith
        ? tool.name.toLowerCase().startsWith(startsWith.toLowerCase())
        : true),
  );

  return (
    <ScrollArea className="h-full min-h-0">
      <div ref={toolsRef} className="w-full flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-start">
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        </div>
        <div className="flex flex-col gap-4 w-full pb-4">
          {tools.isLoading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="rounded-lg w-full h-[76px]" />
            ))
          ) : tools.isError ? (
            "url" in (connection as MCPConnection) &&
            (connection as MCPConnection & { url?: string }).url?.includes(
              "example.com",
            ) ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
                  <Icon
                    name="tune"
                    size={24}
                    className="text-muted-foreground"
                  />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-medium text-foreground">
                    Configuration Required
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    This integration needs to be configured before tools can be
                    tested. Please update the integration details above.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <img
                  src="/img/error-state-connection-tools.svg"
                  className="h-64 mb-4"
                />
                <h3 className="text-2xl font-semibold text-foreground mb-2">
                  Unable to list integration tools
                </h3>
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-left mb-4">
                  <pre className="text-xs text-destructive whitespace-pre-wrap break-words">
                    Error: {tools.error?.message || "Unknown error occurred"}
                  </pre>
                </div>
              </div>
            )
          ) : (
            filteredTools.map((tool) => {
              if (selectedIntegrationId) {
                return (
                  <Tool
                    key={tool.name}
                    params={{ id: selectedIntegrationId }}
                    tool={tool}
                    readOnly={readOnly}
                  />
                );
              }
              return connection ? (
                <Tool
                  key={tool.name}
                  params={connection as MCPConnection}
                  tool={tool}
                  readOnly={readOnly}
                />
              ) : null;
            })
          )}
        </div>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}

function ViewBindingDetector({ integration }: { integration: Integration }) {
  const [isViewBinding, setIsViewBinding] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const checkViewBinding = async () => {
    if (!integration) return;
    setIsChecking(true);
    try {
      const toolsData = await listTools(integration.connection);
      const isViewBindingResult = Binding(
        WellKnownBindings.View,
      ).isImplementedBy(toolsData.tools);
      setIsViewBinding(isViewBindingResult);
    } catch (error) {
      console.error("Error checking view binding:", error);
      setIsViewBinding(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkViewBinding();
  }, [integration?.id]);

  if (!integration || isChecking) {
    return (
      <div className="w-full flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-center p-4">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (isViewBinding === null || isViewBinding === false) {
    return null;
  }

  return <ViewsList integration={integration} />;
}

function ViewsList({ integration }: { integration: Integration }) {
  const currentTeam = useCurrentTeam();
  const addViewMutation = useAddView();
  const removeViewMutation = useRemoveView();

  const { data: viewsData, isLoading: isLoadingViews } = useConnectionViews(
    integration,
    false,
  );
  const views = viewsData?.views || [];

  const viewsWithStatus = useMemo(() => {
    if (!views || views.length === 0 || !currentTeam.views) return [];
    return views.map((view) => {
      const existingView = findPinnedView(currentTeam.views, integration.id, {
        name: view.name,
        url: view.url,
      });
      return {
        ...view,
        isAdded: !!existingView,
        teamViewId: existingView?.id,
      } as typeof view & { isAdded: boolean; teamViewId?: string };
    });
  }, [views, currentTeam.views, integration.id]);

  const handleAddView = async (view: (typeof views)[0]) => {
    try {
      await addViewMutation.mutateAsync({
        view: buildAddViewPayload({
          view: {
            name: view.name,
            title: view.title,
            icon: view.icon,
            url: view.url,
          },
          integrationId: integration.id,
        }),
      });
      toast.success(`View "${view.title}" added successfully`);
    } catch (error) {
      console.error("Error adding view:", error);
      toast.error(`Failed to add view "${view.title}"`);
    }
  };

  const handleRemoveView = async (
    viewWithStatus: (typeof viewsWithStatus)[0],
  ) => {
    if (!viewWithStatus.teamViewId) {
      toast.error("No view to remove");
      return;
    }
    try {
      await removeViewMutation.mutateAsync({
        viewId: viewWithStatus.teamViewId,
      });
      toast.success(`View "${viewWithStatus.title}" removed successfully`);
    } catch (error) {
      console.error("Error removing view:", error);
      toast.error(`Failed to remove view "${viewWithStatus.title}"`);
    }
  };

  if (isLoadingViews) {
    return (
      <div className="w-full flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-center p-4">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center gap-4">
      <h6 className="text-sm text-muted-foreground font-medium w-full">
        Views available from this integration
      </h6>
      <div className="w-full p-4 border border-border rounded-xl bg-muted/30">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center">
            <Icon name="layers" size={20} className="text-success" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">
              {integration.name}
            </h3>
            <p className="text-sm text-muted-foreground">
              This integration provides custom views that can be added to your
              workspace.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="info" size={16} className="text-muted-foreground" />
            <span className="text-muted-foreground">
              Available views: {views.length}
            </span>
          </div>
          {viewsWithStatus.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-4">
              No views available from this integration
            </div>
          ) : (
            <div className="space-y-2">
              {viewsWithStatus.map((view) => (
                <div
                  key={view.name ?? view.url ?? view.title}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-background"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {view.icon && (
                      <Icon
                        name={view.icon}
                        size={24}
                        className="flex-shrink-0"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium truncate">
                        {view.title}
                      </h4>
                      {view.url && (
                        <p className="text-xs text-muted-foreground ">
                          {view.url}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {view.isAdded && (
                      <div className="flex items-center gap-1 text-xs text-success">
                        <Icon name="check_circle" size={14} />
                        <span>Added</span>
                      </div>
                    )}
                    {view.isAdded ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleRemoveView(view)}
                        disabled={removeViewMutation.isPending}
                      >
                        {removeViewMutation.isPending ? (
                          <Icon name="hourglass_empty" size={14} />
                        ) : (
                          <Icon name="remove" size={14} />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddView(view)}
                        disabled={addViewMutation.isPending}
                      >
                        {addViewMutation.isPending ? (
                          <Icon name="hourglass_empty" size={14} />
                        ) : (
                          <Icon name="add" size={14} />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ViewBindingSection({
  data,
  selectedConnectionId,
}: {
  data: ReturnType<typeof useGroupedApp>;
  selectedConnectionId?: string;
}) {
  const selectedIntegration = useMemo(() => {
    return (
      data.instances?.find((i) => i.id === selectedConnectionId) ??
      data.instances?.[0] ??
      null
    );
  }, [data.instances, selectedConnectionId]);

  if (!selectedIntegration) return null;
  return <ViewBindingDetector integration={selectedIntegration} />;
}

function V2Section({
  selectedIntegration,
  checker,
  uiComponent,
  featureName,
  emptyStateConfig,
}: {
  selectedIntegration: Integration;
  checker: (
    tools: {
      name: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
      outputSchema?: Record<string, unknown>;
    }[],
  ) => { compliant: boolean; missing?: string | null };
  uiComponent: React.ComponentType<{ integration: Integration }>;
  featureName: string;
  emptyStateConfig: {
    icon: string;
    title: string;
    description: string;
  };
}) {
  const { isLoading, isCompliant, missingMessage } = useCompliance(
    selectedIntegration.connection,
    checker,
  );

  if (isLoading) {
    return (
      <div className="w-full flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-center p-4">
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  }

  if (!isCompliant) {
    return (
      <EmptyState
        icon={emptyStateConfig.icon}
        title={emptyStateConfig.title}
        description={emptyStateConfig.description}
      />
    );
  }

  const UIComponent = uiComponent;
  return <UIComponent integration={selectedIntegration} />;
}

export function ConnectionTabs({
  data,
  selectedIntegrationId,
}: {
  data: ReturnType<typeof useGroupedApp>;
  selectedIntegrationId?: string | null;
}) {
  const selectedIntegration = useMemo(() => {
    return (
      data.instances?.find((i) => i.id === selectedIntegrationId) ??
      data.instances?.[0] ??
      null
    );
  }, [data.instances, selectedIntegrationId]);

  const readOnly = !data.instances || data.instances?.length === 0;

  const connection = selectedIntegration?.connection || data?.info?.connection;

  // Legacy availability checks
  const { data: toolsData, isLoading: isLoadingTools } = useTools(
    (connection || {}) as MCPConnection,
  );
  const hasLegacyViews = useMemo(() => {
    if (isLoadingTools) return false;
    try {
      return Binding(WellKnownBindings.View).isImplementedBy(toolsData.tools);
    } catch {
      return false;
    }
  }, [isLoadingTools, toolsData.tools]);
  const hasLegacyWorkflows = useMemo(() => {
    if (isLoadingTools) return false;
    return toolsData.tools.some((t) =>
      t.name.toLowerCase().startsWith("deco_chat_workflows"),
    );
  }, [isLoadingTools, toolsData.tools]);

  return (
    <Tabs
      defaultValue="tools"
      orientation="horizontal"
      className="w-full gap-4 h-[90%]"
    >
      <TabsList>
        <TabsTrigger value="tools" className="px-4">
          Tools
        </TabsTrigger>
        <TabsTrigger value="views" className="px-4">
          Views
        </TabsTrigger>
        <TabsTrigger value="workflows" className="px-4">
          Workflows
        </TabsTrigger>
        <TabsTrigger value="resources-v2" className="px-4">
          Resources
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tools">
        <ToolsInspector
          data={data}
          readOnly={readOnly}
          selectedConnectionId={selectedIntegrationId ?? undefined}
        />
      </TabsContent>

      <TabsContent value="views" className="h-full">
        {hasLegacyViews || selectedIntegration ? (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-4 pb-4">
              {hasLegacyViews ? (
                <>
                  <div className="text-xs text-muted-foreground font-medium">
                    Legacy
                  </div>
                  <ViewBindingSection
                    data={data}
                    selectedConnectionId={selectedIntegrationId ?? undefined}
                  />
                </>
              ) : null}
              {selectedIntegration ? (
                <>
                  {hasLegacyViews ? (
                    <div className="text-xs text-muted-foreground font-medium">
                      View
                    </div>
                  ) : null}
                  <V2Section
                    selectedIntegration={selectedIntegration}
                    checker={viewsV2Checker}
                    uiComponent={ViewsV2UI}
                    featureName="View"
                    emptyStateConfig={{
                      icon: "visibility",
                      title: "No Views Available",
                      description:
                        "This integration doesn't implement any view.",
                    }}
                  />
                </>
              ) : null}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        ) : (
          <EmptyState
            icon="visibility"
            title="No Views Available"
            description="This integration doesn't implement any view."
          />
        )}
      </TabsContent>

      <TabsContent value="workflows" className="h-full">
        {hasLegacyWorkflows || selectedIntegration ? (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-4 pb-4">
              {hasLegacyWorkflows ? (
                <>
                  <div className="text-xs text-muted-foreground font-medium">
                    Legacy
                  </div>
                  <ToolsInspector
                    data={data}
                    selectedConnectionId={selectedIntegrationId ?? undefined}
                    startsWith="DECO_CHAT_WORKFLOWS"
                  />
                </>
              ) : null}
              {selectedIntegration ? (
                <>
                  {hasLegacyWorkflows ? (
                    <div className="text-xs text-muted-foreground font-medium">
                      Workflow
                    </div>
                  ) : null}
                  <V2Section
                    selectedIntegration={selectedIntegration}
                    checker={workflowsV2Checker}
                    uiComponent={WorkflowsV2UI}
                    featureName="Workflow"
                    emptyStateConfig={{
                      icon: "flowchart",
                      title: "No Workflows Available",
                      description:
                        "This integration doesn't implement any workflow.",
                    }}
                  />
                </>
              ) : null}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        ) : (
          <EmptyState
            icon="flowchart"
            title="No Workflows Available"
            description="This integration doesn't implement any workflow."
          />
        )}
      </TabsContent>

      <TabsContent value="resources-v2" className="h-full">
        {selectedIntegration ? (
          <V2Section
            selectedIntegration={selectedIntegration}
            checker={resourcesV2Checker}
            uiComponent={ResourcesV2UI}
            featureName="Resources v2"
            emptyStateConfig={{
              icon: "folder",
              title: "No Resources Available",
              description: "This integration doesn't implement any resource.",
            }}
          />
        ) : (
          <EmptyState
            icon="folder"
            title="No Resources Available"
            description="This integration doesn't implement any resource."
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

// Accordion components used by Tool
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@deco/ui/components/accordion.tsx";
