import {
  buildAddViewPayload,
  findPinnedView,
  type Integration,
  listTools,
  type MCPConnection,
  type MCPTool,
  useAddView,
  useConnectionViews,
  useRemoveView,
  useToolCall,
  useTools,
} from "@deco/sdk";
import { Binding, WellKnownBindings } from "@deco/sdk/mcp/bindings";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import {
  AppKeys,
  getConnectionAppKey,
  isWellKnownApp,
  useGroupedApp,
} from "./apps.ts";
import { IntegrationIcon } from "./common.tsx";

import { useUpdateIntegration, useWriteFile } from "@deco/sdk";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@deco/ui/components/accordion.tsx";
import { Card } from "@deco/ui/components/card.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { PasswordInput } from "@deco/ui/components/password-input.tsx";
import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useForm } from "react-hook-form";
import { trackEvent } from "../../hooks/analytics.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
import type { MarketplaceIntegration } from "./marketplace.tsx";
import { OAuthCompletionDialog } from "./oauth-completion-dialog.tsx";
import {
  RemoveConnectionAlert,
  useRemoveConnection,
} from "./remove-connection.tsx";
import {
  ConfirmMarketplaceInstallDialog,
  OauthModalContextProvider,
  OauthModalState,
} from "./select-connection-dialog.tsx";
import { ToolCallForm } from "./tool-call-form.tsx";
import { ToolCallResult } from "./tool-call-result.tsx";
import type { MCPToolCallResult } from "./types.ts";

function ConnectionInstanceActions({ onDelete }: { onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Icon name="more_horiz" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onSelect={onDelete}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ICON_FILE_PATH = "assets/integrations";

function useIconFilename() {
  function generate(originalFile: File) {
    const extension =
      originalFile.name.split(".").pop()?.toLowerCase() || "png";
    return `icon-${crypto.randomUUID()}.${extension}`;
  }
  return { generate };
}

function useIconUpload(form: ReturnType<typeof useForm<Integration>>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const writeFileMutation = useWriteFile();
  const { generate: generateIconFilename } = useIconFilename();
  const [isUploading, setIsUploading] = useState(false);
  const iconValue = form.watch("icon");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }
    try {
      setIsUploading(true);
      const filename = generateIconFilename(file);
      const path = `${ICON_FILE_PATH}/${filename}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });
      form.setValue("icon", path, {
        shouldValidate: true,
        shouldDirty: true,
        shouldTouch: true,
      });
    } catch (error) {
      console.error("Failed to upload icon:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return {
    fileInputRef,
    isUploading,
    iconValue,
    handleFileChange,
    triggerFileInput,
  };
}

function ConfigureConnectionInstanceForm({
  instance,
  setDeletingId,
  defaultConnection,
}: {
  instance?: Integration;
  setDeletingId: (id: string | null) => void;
  defaultConnection?: MCPConnection;
}) {
  const isReadOnly = !instance;

  const form = useForm<Integration>({
    defaultValues: {
      id: instance?.id || crypto.randomUUID(),
      name: instance?.name || "",
      description: instance?.description || "",
      icon: instance?.icon || "",
      connection: instance?.connection ||
        defaultConnection || {
          type: "HTTP" as const,
          url: "https://example.com/messages",
          token: "",
        },
      access: instance?.access || null,
    },
  });

  useEffect(() => {
    form.reset(instance);
  }, [instance]);

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const updateIntegration = useUpdateIntegration();
  const isSaving = updateIntegration.isPending;
  const connection = form.watch("connection");

  const {
    fileInputRef,
    isUploading,
    iconValue,
    handleFileChange,
    triggerFileInput,
  } = useIconUpload(form);

  const onSubmit = async (data: Integration) => {
    try {
      await updateIntegration.mutateAsync(data);

      trackEvent("integration_update", {
        success: true,
        data,
      });

      form.reset(data);
    } catch (error) {
      console.error(`Error updating integration:`, error);

      trackEvent("integration_create", {
        success: false,
        error,
        data,
      });
    }
  };

  const handleConnectionTypeChange = (value: MCPConnection["type"]) => {
    const ec = instance?.connection;
    form.setValue(
      "connection",
      value === "SSE" || value === "HTTP"
        ? {
            type: value,
            url:
              ec?.type === "SSE"
                ? ec.url || "https://example.com/sse"
                : "https://example.com/sse",
          }
        : value === "Websocket"
          ? {
              type: "Websocket",
              url:
                ec?.type === "Websocket"
                  ? ec.url || "wss://example.com/ws"
                  : "wss://example.com/ws",
            }
          : {
              type: "Deco",
              tenant:
                ec?.type === "Deco" ? ec.tenant || "tenant-id" : "tenant-id",
            },
    );
  };

  return (
    <div className="w-full flex flex-col gap-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
          {!isReadOnly && (
            <div className="flex items-end gap-4">
              <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                  <FormItem>
                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Input type="hidden" {...field} />
                    <FormControl>
                      {iconValue ? (
                        <div
                          onClick={triggerFileInput}
                          className="w-10 h-10 relative group"
                        >
                          <IntegrationIcon
                            icon={iconValue}
                            className={cn(
                              "w-10 h-10 bg-background",
                              isUploading && "opacity-50",
                            )}
                          />
                          <div className="rounded-xl cursor-pointer transition-all absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-90 flex items-center justify-center bg-accent">
                            <Icon name="upload" size={24} />
                          </div>
                        </div>
                      ) : (
                        <div
                          onClick={triggerFileInput}
                          className="w-14 h-14 flex flex-col items-center justify-center gap-1 border border-border bg-background rounded-xl"
                        >
                          <Icon name="upload" size={24} />
                          <span className="text-xs text-muted-foreground/70 text-center px-1">
                            Select an icon
                          </span>
                        </div>
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="w-full">
                    <FormControl>
                      <Input
                        className="bg-background"
                        placeholder="Integration name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="ml-auto">
                <ConnectionInstanceActions
                  onDelete={() => {
                    setDeletingId(instance?.id);
                  }}
                />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="connection.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Connection Type</FormLabel>
                    <Select
                      onValueChange={(value: MCPConnection["type"]) => {
                        field.onChange(value);
                        handleConnectionTypeChange(value);
                      }}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a connection type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="HTTP">HTTP</SelectItem>
                        <SelectItem value="SSE">
                          Server-Sent Events (SSE)
                        </SelectItem>
                        <SelectItem value="Websocket">WebSocket</SelectItem>
                        <SelectItem value="Deco">Deco</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {["SSE", "HTTP"].includes(connection.type) && (
                <>
                  <FormField
                    control={form.control}
                    name="connection.url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{connection.type} URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://example.com/messages"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="connection.token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token</FormLabel>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          optional
                        </span>
                        <FormControl>
                          <PasswordInput placeholder="token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}

              {connection.type === "Websocket" && (
                <FormField
                  control={form.control}
                  name="connection.url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WebSocket URL</FormLabel>
                      <FormControl>
                        <Input placeholder="wss://example.com/ws" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {connection.type === "Deco" && (
                <>
                  <FormField
                    control={form.control}
                    name="connection.tenant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tenant ID</FormLabel>
                        <FormControl>
                          <Input placeholder="tenant-id" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="connection.token"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Token</FormLabel>
                        <span className="text-[10px] text-muted-foreground ml-1">
                          optional
                        </span>
                        <FormControl>
                          <PasswordInput placeholder="token" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </>
              )}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit" disabled={isSaving || numberOfChanges === 0}>
              Save
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

const MAX_DESCRIPTION_LENGTH = 180;

function Overview({
  data,
  appKey,
  showInstallButton,
}: {
  data: ReturnType<typeof useGroupedApp>;
  appKey: string;
  showInstallButton: boolean;
}) {
  const isWellKnown = isWellKnownApp(appKey);
  const navigateWorkspace = useNavigateWorkspace();
  const [installingIntegration, setInstallingIntegration] =
    useState<MarketplaceIntegration | null>(null);
  const [oauthCompletionDialog, setOauthCompletionDialog] =
    useState<OauthModalState>({
      open: false,
      url: "",
      integrationName: "",
      openIntegrationOnFinish: true,
      connection: null,
    });
  const hasBigDescription = useMemo(() => {
    return (
      data.info?.description &&
      data.info?.description.length > MAX_DESCRIPTION_LENGTH
    );
  }, [data.info?.description]);
  const [isExpanded, setIsExpanded] = useState(!hasBigDescription);

  const handleAddConnection = () => {
    setInstallingIntegration({
      id: data.info?.id ?? "",
      provider: data.info?.provider ?? "unknown",
      name: data.info?.name ?? "",
      description: data.info?.description ?? "",
      icon: data.info?.icon ?? "",
      verified: data.info?.verified ?? false,
      connection: data.info?.connection ?? { type: "HTTP", url: "" },
      friendlyName: data.info?.friendlyName ?? "",
    });
  };

  const description = isExpanded
    ? data.info?.description
    : data.info?.description?.slice(0, MAX_DESCRIPTION_LENGTH) + "...";

  return (
    <div className="w-full flex flex-col-reverse items-start justify-between gap-4">
      <div className="flex flex-col items-start gap-4 order-1">
        <IntegrationIcon
          icon={data.info?.icon}
          name={data.info?.name}
          size="xl"
        />
        <div className="flex flex-col gap-1">
          <h5 className="text-xl font-medium">
            {data.info?.friendlyName || data.info?.name}
          </h5>
          <p className="text-sm text-muted-foreground whitespace-pre-line">
            {description}
          </p>
          {hasBigDescription && (
            <Button
              className="w-fit mt-2"
              variant="special"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? "Show less" : "Show more"}
            </Button>
          )}
        </div>
      </div>
      {!isWellKnown && data.info?.provider !== "custom" && showInstallButton ? (
        <Button
          variant="special"
          className="w-full"
          onClick={handleAddConnection}
        >
          <span className="hidden md:inline">Install app</span>
        </Button>
      ) : null}
      <OauthModalContextProvider.Provider
        value={{ onOpenOauthModal: setOauthCompletionDialog }}
      >
        <ConfirmMarketplaceInstallDialog
          integration={installingIntegration}
          setIntegration={setInstallingIntegration}
          onConfirm={({ authorizeOauthUrl, connection }) => {
            function onSelect() {
              const key = getConnectionAppKey(connection);
              const appKey = AppKeys.build(key);
              navigateWorkspace(`/connection/${appKey}`);
            }

            if (authorizeOauthUrl) {
              const popup = globalThis.open(authorizeOauthUrl, "_blank");
              if (
                !popup ||
                popup.closed ||
                typeof popup.closed === "undefined"
              ) {
                setOauthCompletionDialog({
                  openIntegrationOnFinish: true,
                  open: true,
                  url: authorizeOauthUrl,
                  integrationName: installingIntegration?.name || "the service",
                  connection: connection,
                });
              } else {
                onSelect();
              }
            } else {
              onSelect();
            }
          }}
        />
      </OauthModalContextProvider.Provider>

      <OAuthCompletionDialog
        open={oauthCompletionDialog.open}
        onOpenChange={(open) =>
          setOauthCompletionDialog((prev) => ({ ...prev, open }))
        }
        authorizeOauthUrl={oauthCompletionDialog.url}
        integrationName={oauthCompletionDialog.integrationName}
      />
    </div>
  );
}

function ParametersViewer({ tool }: Pick<ToolProps, "tool">) {
  const getParameters = (schema: Record<string, unknown>) => {
    if (!schema || typeof schema !== "object") return [];

    // deno-lint-ignore no-explicit-any
    const properties = (schema.properties as Record<string, any>) || {};
    const required = (schema.required as string[]) || [];

    return Object.entries(properties).map(([name, prop]) => ({
      name,
      type: prop.type || "string",
      description: prop.description || "",
      required: required.includes(name),
    }));
  };

  const parameters = getParameters(tool.inputSchema);

  return (
    <div className="flex flex-col gap-2">
      {parameters.length > 0 ? (
        parameters.map((param) => (
          <div className="flex flex-col gap-2">
            <div key={param.name} className="flex items-center gap-2">
              <Icon
                name={param.type === "string" ? "text_fields" : "category"}
                size={16}
              />
              <span className="text-sm pl-1">{formatToolName(param.name)}</span>
              <span
                className={cn(
                  "text-xs text-muted-foreground",
                  param.required && "font-medium",
                )}
              >
                {param.required ? "Required" : "Optional"}
              </span>
            </div>
            {param.description && (
              <span className="px-7 text-sm text-muted-foreground font-normal">
                {param.description}
              </span>
            )}
          </div>
        ))
      ) : (
        <div className="text-sm text-muted-foreground">
          No parameters required
        </div>
      )}
    </div>
  );
}

interface ToolProps {
  tool: MCPTool;
  connection: MCPConnection;
  readOnly?: boolean;
}

function Tool({ tool, connection, readOnly }: ToolProps) {
  const toolCall = useToolCall(connection);
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

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem
        value={tool.name}
        className="border border-border overflow-hidden !border-b rounded-xl p-0"
      >
        <AccordionTrigger className="p-4 hover:no-underline cursor-pointer hover:bg-accent rounded-t-xl rounded-b-none">
          <div className="flex items-start gap-3 w-full text-left">
            <Icon name="build" filled size={16} />
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
          <Tabs defaultValue="parameters" className="w-full">
            <TabsList>
              <TabsTrigger value="parameters" className="px-4">
                Parameters
              </TabsTrigger>
              <TabsTrigger value="test-form" className="px-4">
                Test form
              </TabsTrigger>
              <TabsTrigger value="test-raw" className="px-4">
                Test raw
              </TabsTrigger>
            </TabsList>
            <TabsContent value="parameters" className="mt-4">
              <ParametersViewer tool={tool} />
            </TabsContent>
            <TabsContent value="test-form" className="mt-4">
              <ToolCallForm
                tool={tool}
                onSubmit={handleToolCall}
                onCancel={handleCancelToolCall}
                isLoading={isLoading}
                rawMode={false}
                readOnly={readOnly}
              />
              {toolCallResponse && (
                <Card className="p-4 mt-4" data-tool-result>
                  <ToolCallResult response={toolCallResponse} />
                </Card>
              )}
            </TabsContent>
            <TabsContent value="test-raw" className="mt-4">
              <ToolCallForm
                tool={tool}
                onSubmit={handleToolCall}
                onCancel={handleCancelToolCall}
                isLoading={isLoading}
                rawMode
                readOnly={readOnly}
              />
              {toolCallResponse && (
                <Card className="p-4 mt-4" data-tool-result>
                  <ToolCallResult response={toolCallResponse} />
                </Card>
              )}
            </TabsContent>
          </Tabs>
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
  const ignoreCache = useRef(false);

  const selectedIntegration = useMemo(() => {
    return (
      data.instances?.find((i) => i.id === selectedIntegrationId) ??
      data.instances?.[0] ??
      null
    );
  }, [data.instances, selectedIntegrationId]);

  const connection = selectedIntegration?.connection || data?.info?.connection;

  const tools = useTools(connection as MCPConnection, ignoreCache.current);

  // Update selected integration when selectedConnectionId changes
  useEffect(() => {
    if (selectedConnectionId) {
      setSelectedIntegrationId(selectedConnectionId);
      // Scroll to tools section
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
    <ScrollArea className="h-[calc(100vh-10rem)]">
      <div ref={toolsRef} className="w-full flex flex-col items-center gap-4">
        <div className="w-full flex items-center justify-between">
          <Input
            placeholder="Search tools..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Button
            variant="outline"
            onClick={() => {
              ignoreCache.current = true;
              tools.refetch();
              ignoreCache.current = false;
            }}
          >
            Refresh
          </Button>
        </div>

        <div className="flex flex-col gap-4 w-full min-h-[80vh]">
          {tools.isLoading ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="rounded-lg w-full h-[76px]" />
            ))
          ) : tools.isError ? (
            "url" in connection && connection.url.includes("example.com") ? (
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
                    This connection needs to be configured before tools can be
                    tested. Please update the connection details above.
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
                  Unable to list connection tools
                </h3>
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg text-left mb-4">
                  <pre className="text-xs text-destructive whitespace-pre-wrap break-words">
                    Error: {tools.error?.message || "Unknown error occurred"}
                  </pre>
                </div>
                <Button
                  onClick={() => {
                    ignoreCache.current = true;
                    tools.refetch();
                    ignoreCache.current = false;
                  }}
                >
                  <Icon name="refresh" size={16} />
                  Refresh
                </Button>
              </div>
            )
          ) : (
            filteredTools.map((tool) =>
              connection ? (
                <Tool
                  key={tool.name}
                  connection={connection}
                  tool={tool}
                  readOnly={readOnly}
                />
              ) : null,
            )
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

  // Check which views are already added to the team (by integrationId + name)
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
    <ScrollArea className="h-[calc(100vh-10rem)]">
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
    </ScrollArea>
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

  if (!selectedIntegration) {
    return null;
  }

  return <ViewBindingDetector integration={selectedIntegration} />;
}

const InstanceSelectItem = ({ instance }: { instance: Integration }) => {
  return (
    <SelectItem key={instance.id} value={instance.id}>
      <IntegrationIcon
        icon={instance.icon}
        name={instance.name}
        size="xs"
        className="flex-shrink-0"
      />
      {instance.name}
    </SelectItem>
  );
};

function AppDetail() {
  const { appKey: _appKey } = useParams();
  const navigateWorkspace = useNavigateWorkspace();
  const appKey = _appKey!;
  const data = useGroupedApp({
    appKey,
  });

  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | null
  >(data.instances?.[0]?.id ?? null);

  const selectedIntegration = useMemo(() => {
    return (
      data.instances?.find((i) => i.id === selectedIntegrationId) ??
      data.instances?.[0] ??
      null
    );
  }, [data.instances, selectedIntegrationId]);

  const { setDeletingId, deletingId, isDeletionPending, performDelete } =
    useRemoveConnection();

  return (
    <div className="grid grid-cols-6 gap-6 p-6 h-full">
      <div className="col-span-2 bg-card rounded-xl p-4 flex flex-col gap-4 h-full">
        <Overview
          key={appKey}
          data={data}
          appKey={appKey}
          showInstallButton={!data.instances || data.instances?.length === 0}
        />
        {data.instances?.length > 1 && (
          <Select
            value={selectedIntegration?.id}
            onValueChange={(value) => {
              setSelectedIntegrationId(value);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select connection" />
            </SelectTrigger>
            <SelectContent>
              {data.instances?.map((instance) => (
                <InstanceSelectItem key={instance.id} instance={instance} />
              ))}
            </SelectContent>
          </Select>
        )}
        <ConfigureConnectionInstanceForm
          key={selectedIntegration?.id}
          instance={selectedIntegration}
          defaultConnection={data.info?.connection}
          setDeletingId={setDeletingId}
        />
        {deletingId && (
          <RemoveConnectionAlert
            open={deletingId !== null}
            onOpenChange={() => setDeletingId(null)}
            isDeleting={isDeletionPending}
            onDelete={(arg) => {
              performDelete(arg);
              if (data.info.provider === "custom") {
                navigateWorkspace("/discover");
              }
            }}
          />
        )}
      </div>
      <div className="col-span-4 h-full">
        <Tabs
          defaultValue="tools"
          orientation="horizontal"
          className="w-full h-full gap-4"
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
          </TabsList>

          <TabsContent value="tools">
            <ToolsInspector
              data={data}
              readOnly={!data.instances || data.instances?.length === 0}
              selectedConnectionId={selectedIntegrationId ?? undefined}
            />
          </TabsContent>
          <TabsContent value="views">
            <ViewBindingSection
              data={data}
              selectedConnectionId={selectedIntegrationId ?? undefined}
            />
          </TabsContent>
          <TabsContent value="workflows">
            <ToolsInspector
              data={data}
              selectedConnectionId={selectedIntegrationId ?? undefined}
              startsWith="DECO_CHAT_WORKFLOWS"
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function Page() {
  const { appKey: _appKey } = useParams();
  const appKey = _appKey!;
  const app = useGroupedApp({
    appKey,
  });

  const isInstalled = app.instances?.length > 0;

  const { info } = app;

  return (
    <PageLayout
      hideViewsButton
      tabs={{
        main: {
          Component: () => <AppDetail />,
          title: "Overview",
          initialOpen: true,
        },
      }}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            // This behavior is strange, it will be fixed once we have different pages for discover and integrations
            isInstalled
              ? { label: "My Apps", link: "/connections" }
              : { label: "Discover", link: "/discover" },
            ...(info?.name
              ? [
                  {
                    label: (
                      <div className="flex items-center gap-2">
                        <IntegrationIcon
                          icon={info.icon}
                          name={info.name}
                          size="xs"
                        />
                        <span>{info.friendlyName || info.name}</span>
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      }
    />
  );
}
