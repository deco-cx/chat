import { Button } from "@deco/ui/components/button.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Navigate, useParams, useSearchParams } from "react-router";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { isWellKnownApp, useGroupedApp } from "./apps.ts";
import { IntegrationIcon } from "./common.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  type Integration,
  type MCPConnection,
  type MCPTool,
  useToolCall,
  useTools,
} from "@deco/sdk";
import { useEffect, useRef, useState } from "react";

import {
  RemoveConnectionAlert,
  useRemoveConnection,
} from "./remove-connection.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { PasswordInput } from "@deco/ui/components/password-input.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { useForm } from "react-hook-form";
import { useUpdateIntegration, useWriteFile } from "@deco/sdk";
import { trackEvent } from "../../hooks/analytics.ts";
import { Card } from "@deco/ui/components/card.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@deco/ui/components/accordion.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
import { ToolCallForm } from "./tool-call-form.tsx";
import { ToolCallResult } from "./tool-call-result.tsx";
import type { MCPToolCallResult } from "./types.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import {
  ConfirmMarketplaceInstallDialog,
} from "./select-connection-dialog.tsx";
import type { MarketplaceIntegration } from "./marketplace.tsx";
import { OAuthCompletionDialog } from "./oauth-completion-dialog.tsx";

function ConnectionInstanceActions({
  onConfigure,
  onDelete,
  onTestTools,
}: {
  onConfigure: () => void;
  onTestTools: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="ml-2">
          <Icon name="more_horiz" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onConfigure}>Configure</DropdownMenuItem>
        <DropdownMenuItem onSelect={onTestTools}>Test tools</DropdownMenuItem>
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

function useStartConfiguringOpen() {
  const [searchParams] = useSearchParams();
  const connectionId = searchParams.get("edit");
  return { connectionId };
}

function useIconFilename() {
  function generate(originalFile: File) {
    const extension = originalFile.name.split(".").pop()?.toLowerCase() ||
      "png";
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

function ConfigureConnectionInstanceForm(
  { instance, closeForm }: { instance: Integration; closeForm: () => void },
) {
  const form = useForm<Integration>({
    defaultValues: {
      id: instance.id || crypto.randomUUID(),
      name: instance.name || "",
      description: instance.description || "",
      icon: instance.icon || "",
      connection: instance.connection || {
        type: "HTTP" as const,
        url: "https://example.com/messages",
        token: "",
      },
      access: instance.access || null,
    },
  });
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
      closeForm();
    } catch (error) {
      console.error(
        `Error updating integration:`,
        error,
      );

      trackEvent("integration_create", {
        success: false,
        error,
        data,
      });
    }
  };

  const handleConnectionTypeChange = (value: MCPConnection["type"]) => {
    const ec = instance.connection;
    form.setValue(
      "connection",
      value === "SSE" || value === "HTTP"
        ? {
          type: value,
          url: ec?.type === "SSE"
            ? ec.url || "https://example.com/sse"
            : "https://example.com/sse",
        }
        : value === "Websocket"
        ? {
          type: "Websocket",
          url: ec?.type === "Websocket"
            ? ec.url || "wss://example.com/ws"
            : "wss://example.com/ws",
        }
        : {
          type: "Deco",
          tenant: ec?.type === "Deco" ? ec.tenant || "tenant-id" : "tenant-id",
        },
    );
  };

  return (
    <div className="w-full p-6 bg-muted rounded-xl border border-border flex flex-col gap-6">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-6"
        >
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
                    {iconValue
                      ? (
                        <div onClick={triggerFileInput} className="w-14 h-14">
                          <IntegrationIcon
                            icon={iconValue}
                            className={cn(
                              "w-14 h-14 bg-background",
                              isUploading && "opacity-50",
                            )}
                          />
                        </div>
                      )
                      : (
                        <div
                          onClick={triggerFileInput}
                          className="w-14 h-14 flex flex-col items-center justify-center gap-1 border border-border bg-background rounded-xl"
                        >
                          <Icon
                            name="upload"
                            size={24}
                          />
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
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={triggerFileInput}
              disabled={isUploading}
            >
              <Icon name="upload" size={16} />
              Upload image
            </Button>
          </div>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
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
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FormLabel>MCP Settings</FormLabel>
            </div>
            <div className="space-y-4 p-4 border border-border rounded-xl bg-background">
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
                          <PasswordInput
                            placeholder="token"
                            {...field}
                          />
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
                        <Input
                          placeholder="wss://example.com/ws"
                          {...field}
                        />
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
                          <PasswordInput
                            placeholder="token"
                            {...field}
                          />
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
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={isSaving}
            >
              Discard changes
            </Button>
            <Button type="submit" disabled={isSaving || numberOfChanges === 0}>
              Save
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

function ConnectionInstanceItem(
  { instance, onTestTools }: {
    instance: Integration;
    onTestTools: (connectionId: string) => void;
  },
) {
  const { connectionId: queryStringConnectionId } = useStartConfiguringOpen();
  const [isConfiguring, setIsConfiguring] = useState(
    queryStringConnectionId === instance.id,
  );
  const { deletingId, performDelete, setDeletingId, isDeletionPending } =
    useRemoveConnection();
  const instanceRef = useRef<HTMLDivElement>(null);
  // Smooth scroll to this instance when connectionId matches
  useEffect(() => {
    setTimeout(() => {
      if (queryStringConnectionId === instance.id && instanceRef.current) {
        instanceRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 100);
  }, [queryStringConnectionId, instance.id]);

  // todo: make a useIntegrationAgents() hook
  const agentsUsedBy: {
    id: string;
    avatar: string;
    name: string;
  }[] = [];
  const extraCount = 0;

  if (isConfiguring) {
    return (
      <div
        ref={instanceRef}
        className="w-full"
        id={`connection-${instance.id}`}
      >
        <ConfigureConnectionInstanceForm
          instance={instance}
          closeForm={() => setIsConfiguring(false)}
        />
      </div>
    );
  }

  return (
    <div
      ref={instanceRef}
      id={`connection-${instance.id}`}
      className="w-full p-4 flex items-center gap-2 rounded-xl border border-border"
      key={instance.id}
    >
      <IntegrationIcon
        icon={instance.icon}
        name={instance.name}
      />
      <div className="h-12 flex flex-col gap-1 flex-1 min-w-0">
        <h5 className="text-sm font-medium truncate">{instance.name}</h5>
        <p className="text-sm text-muted-foreground truncate">
          {instance.description}
        </p>
      </div>
      <div className="flex items-center gap-[-8px] ml-2">
        {agentsUsedBy.map((agent) => (
          <AgentAvatar
            key={agent.id}
            className="border-2 border-background -ml-2 first:ml-0"
            url={agent.avatar}
            fallback={agent.name || "Unknown agent"}
            size="base"
          />
        ))}
        {extraCount > 0 && (
          <span className="ml-2 text-xs font-medium bg-muted rounded-full px-2 py-0.5">
            +{extraCount}
          </span>
        )}
      </div>
      <ConnectionInstanceActions
        onConfigure={() => setIsConfiguring(true)}
        onTestTools={() => onTestTools(instance.id)}
        onDelete={() => setDeletingId(instance.id)}
      />
      {deletingId && (
        <RemoveConnectionAlert
          open={deletingId !== null}
          onOpenChange={() => setDeletingId(null)}
          isDeleting={isDeletionPending}
          onDelete={performDelete}
        />
      )}
    </div>
  );
}

function Instances({ data, onTestTools }: {
  data: ReturnType<typeof useGroupedApp>;
  onTestTools: (connectionId: string) => void;
}) {
  return (
    <div className="w-full p-4 flex flex-col items-center gap-4">
      <h6 className="text-sm text-muted-foreground font-medium w-full">
        Instances
      </h6>
      {data.instances.map((instance) => (
        <ConnectionInstanceItem
          key={instance.id}
          instance={instance}
          onTestTools={onTestTools}
        />
      ))}
    </div>
  );
}

function Overview({ data, appKey }: {
  data: ReturnType<typeof useGroupedApp>;
  appKey: string;
}) {
  const isWellKnown = isWellKnownApp(appKey);
  const [installingIntegration, setInstallingIntegration] = useState<
    MarketplaceIntegration | null
  >(null);
  const [oauthCompletionDialog, setOauthCompletionDialog] = useState<{
    open: boolean;
    url: string;
    integrationName: string;
  }>({ open: false, url: "", integrationName: "" });

  const handleAddConnection = () => {
    setInstallingIntegration({
      id: data.info?.id ?? "",
      provider: data.info?.provider ?? "unknown",
      name: data.info?.name ?? "",
      description: data.info?.description ?? "",
      icon: data.info?.icon ?? "",
    });
  };

  return (
    <div className="w-full p-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-4 h-12">
        <IntegrationIcon
          icon={data.info?.icon}
          name={data.info?.name}
          size="lg"
        />
        <div className="h-12 flex flex-col gap-1">
          <h5 className="text-xl font-medium">{data.info?.name}</h5>
          <p className="text-sm text-muted-foreground">
            {data.info?.description}
          </p>
        </div>
      </div>
      {(!isWellKnown && data.info?.provider !== "custom")
        ? (
          <Button variant="special" onClick={handleAddConnection}>
            <span className="hidden md:inline">Add Instance</span>
          </Button>
        )
        : null}

      <ConfirmMarketplaceInstallDialog
        integration={installingIntegration}
        setIntegration={setInstallingIntegration}
        onConfirm={({ authorizeOauthUrl }) => {
          if (authorizeOauthUrl) {
            const popup = globalThis.open(
              authorizeOauthUrl,
              "_blank",
            );
            if (
              !popup || popup.closed || typeof popup.closed === "undefined"
            ) {
              setOauthCompletionDialog({
                open: true,
                url: authorizeOauthUrl,
                integrationName: installingIntegration?.name || "the service",
              });
            }
          }
        }}
      />

      <OAuthCompletionDialog
        open={oauthCompletionDialog.open}
        onOpenChange={(open) =>
          setOauthCompletionDialog((prev) => ({ ...prev, open }))}
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
    const properties = schema.properties as Record<string, any> || {};
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
      {parameters.length > 0
        ? (
          parameters.map((param) => (
            <div className="flex flex-col gap-2">
              <div key={param.name} className="flex items-center gap-2">
                <Icon
                  name={param.type === "string" ? "text_fields" : "category"}
                  size={16}
                />
                <span className="text-sm pl-1">
                  {formatToolName(param.name)}
                </span>
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
        )
        : (
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
}

function Tool({ tool, connection }: ToolProps) {
  const toolCall = useToolCall(connection);
  const [toolCallResponse, setToolCallResponse] = useState<
    MCPToolCallResult | null
  >(null);
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

function ToolsInspector({ data, selectedConnectionId }: {
  data: ReturnType<typeof useGroupedApp>;
  selectedConnectionId?: string;
}) {
  const [search, setSearch] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<
    Integration | null
  >(data.instances[0] ?? null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const connection = selectedIntegration?.connection;
  const tools = useTools(connection as MCPConnection);

  // Create a helper component for displaying instance names
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

  // Update selected integration when selectedConnectionId changes
  useEffect(() => {
    if (selectedConnectionId) {
      const instance = data.instances.find((i) =>
        i.id === selectedConnectionId
      );
      if (instance) {
        setSelectedIntegration(instance);
        // Scroll to tools section
        setTimeout(() => {
          toolsRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 100);
      }
    }
  }, [selectedConnectionId, data.instances]);

  const filteredTools = tools.data.tools.filter((tool) =>
    tool.name.toLowerCase().includes(search.toLowerCase()) ||
    (tool.description &&
      tool.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={toolsRef} className="w-full p-4 flex flex-col items-center gap-4">
      <h6 className="text-sm text-muted-foreground font-medium w-full">
        Tools
      </h6>
      <div className="w-full flex items-center justify-between">
        <Select
          value={selectedIntegration?.id}
          onValueChange={(value) => {
            const instance = data.instances.find((i) =>
              i.id === value
            );
            setSelectedIntegration(instance ?? null);
          }}
        >
          <SelectTrigger className="max-w-[300px] w-full">
            <SelectValue placeholder="Select connection" />
          </SelectTrigger>
          <SelectContent>
            {data.instances.map((instance) => (
              <InstanceSelectItem key={instance.id} instance={instance} />
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search tools..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <div className="flex flex-col gap-4 w-full min-h-[80vh]">
        {tools.isLoading
          ? (
            Array.from({ length: 8 }).map((_, idx) => (
              <Skeleton key={idx} className="rounded-lg w-full h-[76px]" />
            ))
          )
          : tools.isError
          ? (
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
                  Error: {tools.error?.message || 'Unknown error occurred'}
                </pre>
              </div>
              <Button onClick={() => tools.refetch()}>
                <Icon name="refresh" size={16} />
                Refresh
              </Button>
            </div>
          )
          : (
            filteredTools.map((tool) =>
              connection
                ? <Tool key={tool.name} connection={connection} tool={tool} />
                : null
            )
          )}
      </div>
    </div>
  );
}

function AppDetail({ appKey }: {
  appKey: string;
}) {
  const workspaceLink = useWorkspaceLink();
  const app = useGroupedApp({
    appKey,
  });
  const [
    selectedToolInspectorConnectionId,
    setSelectedToolInspectorConnectionId,
  ] = useState<string>();

  if (!app.instances) {
    return <Navigate to={workspaceLink("/connections")} replace />;
  }

  return (
    <div className="w-full flex flex-col items-center h-full overflow-y-scroll">
      <div className="w-full max-w-[850px] flex flex-col gap-4 mt-6">
        <Overview data={app} appKey={appKey} />
        <Instances
          data={app}
          onTestTools={(connectionId) =>
            setSelectedToolInspectorConnectionId(connectionId)}
        />
        <ToolsInspector
          data={app}
          selectedConnectionId={selectedToolInspectorConnectionId}
        />
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

  const { info } = app;

  return (
    <PageLayout
      hideViewsButton
      tabs={{
        main: {
          Component: () => <AppDetail appKey={appKey} />,
          title: "Overview",
          initialOpen: true,
        },
      }}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Integrations", link: "/connections" },
            ...(info?.name
              ? [{
                label: (
                  <div className="flex items-center gap-2">
                    <IntegrationIcon
                      icon={info.icon}
                      name={info.name}
                      size="xs"
                    />
                    <span>{info.name}</span>
                  </div>
                ),
              }]
              : []),
          ]}
        />
      }
    />
  );
}
