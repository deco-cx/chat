import {
  useTools,
  useUpdateIntegration,
  useWriteFile,
  type Integration,
  type MCPConnection,
  useAddView,
  buildAddViewPayload,
  listAvailableViewsForConnection,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Label } from "@deco/ui/components/label.tsx";
import { PasswordInput } from "@deco/ui/components/password-input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import {
  integrationNeedsApproval,
  useIntegrationInstallState,
} from "../../hooks/use-integration-install.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { type DecopilotContextValue } from "../decopilot/context.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import {
  AppKeys,
  getConnectionAppKey,
  isWellKnownApp,
  useGroupedApp,
} from "./apps.ts";
import { IntegrationIcon } from "./common.tsx";
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
  useUIInstallIntegration,
} from "./select-connection-dialog.tsx";
import { ConnectionTabs } from "./tabs/connection-tabs.tsx";

function ConnectionInstanceActions({
  onDelete,
  onEdit,
}: {
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Icon name="more_horiz" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem
          onSelect={onEdit}
          className="text-primary focus:bg-primary/10 focus:text-primary"
        >
          Edit
        </DropdownMenuItem>
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

const COMPLETION_DIALOG_DEFAULT_STATE = {
  open: false,
  url: "",
  integrationName: "",
  openIntegrationOnFinish: true,
  connection: null,
};

function ConfigureConnectionInstanceForm({
  instance,
  setDeletingId,
  defaultConnection,
  selectedIntegration,
  setSelectedIntegrationId,
  data,
  appKey,
  setOauthCompletionDialog,
  oauthCompletionDialog,
}: {
  instance?: Integration;
  setDeletingId: (id: string | null) => void;
  defaultConnection?: MCPConnection;
  selectedIntegration?: Integration;
  setSelectedIntegrationId: (id: string) => void;
  data: ReturnType<typeof useGroupedApp>;
  appKey: string;
  setOauthCompletionDialog: Dispatch<SetStateAction<OauthModalState>>;
  oauthCompletionDialog: OauthModalState;
}) {
  const [isEditing, setIsEditing] = useState(false);

  // @ts-ignore: @TODO: @tlgimenes will fix this
  const tools = useTools(selectedIntegration?.connection ?? {}, true);

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
      setIsEditing(false);
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

  const isWellKnown = isWellKnownApp(appKey);
  const navigateWorkspace = useNavigateWorkspace();
  const [installingIntegration, setInstallingIntegration] =
    useState<MarketplaceIntegration | null>(null);
  const hasBigDescription = useMemo(() => {
    return (
      data.info?.description &&
      data.info?.description.length > MAX_DESCRIPTION_LENGTH
    );
  }, [data.info?.description]);
  const [isExpanded, setIsExpanded] = useState(!hasBigDescription);

  const handleIntegrationInstalled = ({
    authorizeOauthUrl,
    connection,
  }: {
    authorizeOauthUrl: string | null;
    connection: Integration;
  }) => {
    function onSelect() {
      const key = getConnectionAppKey(connection);
      const appKey = AppKeys.build(key);
      navigateWorkspace(`/apps/${appKey}`);
    }

    async function onSelectWithViews() {
      try {
        const viewsResult = await listAvailableViewsForConnection(
          connection.connection,
        );
        const views = viewsResult.views || [];

        const viewsToPin = views.filter(
          (view) =>
            view.installBehavior === "autoPin" ||
            view.installBehavior === "open",
        );
        const viewToOpen = views.find(
          (view) => view.installBehavior === "open",
        );

        const promisesViewsToPin = viewsToPin.map((view) => {
          return addViewMutation.mutateAsync({
            view: buildAddViewPayload({
              view: view,
              integrationId: connection.id,
            }),
          });
        });

        await Promise.all(promisesViewsToPin);

        if (viewToOpen) {
          navigateWorkspace(`/views/${connection.id}/${viewToOpen.name}`);
        } else {
          // Fallback to original behavior if no views available
          onSelect();
        }
      } catch (error) {
        console.error("Error getting available views:", error);
        // Fallback to original behavior on error
        onSelect();
      }
    }

    if (authorizeOauthUrl) {
      const popup = globalThis.open(authorizeOauthUrl, "_blank");
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        setOauthCompletionDialog({
          openIntegrationOnFinish: true,
          open: true,
          url: authorizeOauthUrl,
          integrationName: installingIntegration?.name || "the service",
          connection: connection,
        });
      } else {
        onSelectWithViews();
      }
    } else {
      onSelectWithViews();
    }
  };

  const integrationState = useIntegrationInstallState(data.info?.name);
  const addViewMutation = useAddView();

  // Setup direct install functionality
  const { install, isLoading: isInstallingLoading } = useUIInstallIntegration({
    onConfirm: handleIntegrationInstalled,
    validate: () => form.trigger(),
  });

  const handleAddConnection = () => {
    const needsApproval = integrationNeedsApproval(integrationState);
    const integrationMarketplace = {
      id: data.info?.id ?? "",
      provider: data.info?.provider ?? "unknown",
      name: data.info?.name ?? "",
      description: data.info?.description ?? "",
      icon: data.info?.icon ?? "",
      verified: data.info?.verified ?? false,
      connection: data.info?.connection ?? { type: "HTTP", url: "" },
      friendlyName: data.info?.friendlyName ?? "",
    };
    if (!needsApproval) {
      install({
        integration: integrationMarketplace,
      });
      return;
    }

    setInstallingIntegration(integrationMarketplace);
  };

  const description = isExpanded
    ? data.info?.description
    : data.info?.description?.slice(0, MAX_DESCRIPTION_LENGTH) + "...";

  const deduplicatedInstances = useMemo(() => {
    return data.instances?.reduce((acc, instance) => {
      if (!acc.find((i) => i.id === instance.id)) {
        acc.push(instance);
      }
      return acc;
    }, [] as Integration[]);
  }, [data.instances]);

  const isInstalled = data?.instances?.length > 0;

  return (
    <>
      {!isEditing && (
        <div className="w-full flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                tools.refetch();
              }}
            >
              <Icon name="refresh" size={16} />
              {tools.isRefetching ? "Refreshing..." : "Refresh"}
            </Button>
            {!isWellKnown &&
            data.info?.provider !== "custom" &&
            (!data.instances || data.instances?.length === 0) ? (
              <Button
                variant="special"
                className="w-[250px] hidden md:flex"
                onClick={handleAddConnection}
                disabled={integrationState.isLoading || isInstallingLoading}
              >
                {isInstallingLoading ? (
                  <>
                    <Spinner /> Connecting...
                  </>
                ) : (
                  <>{integrationState.isLoading && <Spinner />} Connect app</>
                )}
              </Button>
            ) : null}
          </div>
          <OauthModalContextProvider.Provider
            value={{ onOpenOauthModal: setOauthCompletionDialog }}
          >
            <ConfirmMarketplaceInstallDialog
              integration={installingIntegration}
              setIntegration={setInstallingIntegration}
              onConfirm={({ authorizeOauthUrl, connection }) => {
                handleIntegrationInstalled({ authorizeOauthUrl, connection });

                data.refetch();
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
      )}

      {isInstalled && (
        <div className="w-full flex flex-col gap-6">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-6"
            >
              <div className="flex items-end gap-4">
                {isEditing && (
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
                )}
                {isEditing && (
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
                )}
                {/** Custom integrations can have multiple instances for now */}
                {!isEditing && (
                  <div className="flex flex-col items-start gap-1">
                    <Label className="text-sm text-muted-foreground">
                      Instances
                    </Label>
                    <Select
                      value={selectedIntegration?.id}
                      onValueChange={(value) => {
                        if (value === "create-new") {
                          handleAddConnection();
                          return;
                        }
                        setSelectedIntegrationId(value);
                      }}
                    >
                      <SelectTrigger className="w-[300px]">
                        <SelectValue
                          placeholder={
                            isInstallingLoading ? (
                              <>
                                <Spinner />
                                Installing...
                              </>
                            ) : (
                              "Select instance"
                            )
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {deduplicatedInstances?.map((instance) => (
                          <InstanceSelectItem
                            key={instance.id}
                            instance={instance}
                          />
                        ))}
                        <SelectItem
                          key="create-new"
                          value="create-new"
                          className="cursor-pointer"
                          disabled={
                            integrationState.isLoading || isInstallingLoading
                          }
                        >
                          <Icon
                            name="add"
                            size={16}
                            className="flex-shrink-0"
                          />
                          Create new account
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="ml-auto">
                  <ConnectionInstanceActions
                    onDelete={() => {
                      setDeletingId(instance?.id ?? null);
                    }}
                    onEdit={() => {
                      setIsEditing(!isEditing);
                    }}
                  />
                </div>
              </div>
              {isEditing && (
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
                                <SelectValue placeholder="Select an integration type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="HTTP">HTTP</SelectItem>
                              <SelectItem value="SSE">
                                Server-Sent Events (SSE)
                              </SelectItem>
                              <SelectItem value="Websocket">
                                WebSocket
                              </SelectItem>
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
              )}
              {isEditing && (
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving || numberOfChanges === 0}
                  >
                    Save
                  </Button>
                </div>
              )}
            </form>
          </Form>
        </div>
      )}
    </>
  );
}

const MAX_DESCRIPTION_LENGTH = 180;

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

export default function AppDetail() {
  const { appKey: _appKey } = useParams();
  const navigateWorkspace = useNavigateWorkspace();
  const appKey = _appKey!;
  const data = useGroupedApp({
    appKey,
  });
  const [oauthCompletionDialog, setOauthCompletionDialog] =
    useState<OauthModalState>(COMPLETION_DIALOG_DEFAULT_STATE);

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

  const decopilotContextValue: DecopilotContextValue = {
    additionalTools: {},
  };

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <div className="flex flex-col gap-6 p-6 h-full">
        <div className="w-full flex flex-col gap-4 border-b pb-6">
          <ConfigureConnectionInstanceForm
            appKey={appKey}
            key={selectedIntegration?.id}
            instance={selectedIntegration}
            defaultConnection={data.info?.connection}
            setDeletingId={setDeletingId}
            selectedIntegration={selectedIntegration}
            setSelectedIntegrationId={setSelectedIntegrationId}
            data={data}
            setOauthCompletionDialog={setOauthCompletionDialog}
            oauthCompletionDialog={oauthCompletionDialog}
          />

          {deletingId && (
            <RemoveConnectionAlert
              open={deletingId !== null}
              onOpenChange={() => setDeletingId(null)}
              isDeleting={isDeletionPending}
              onDelete={(arg) => {
                performDelete(arg);
                if (data.info.provider === "custom") {
                  navigateWorkspace("/store");
                }
              }}
            />
          )}
        </div>
        <div className="flex-grow w-full min-h-0">
          <ConnectionTabs
            data={data}
            selectedIntegrationId={selectedIntegrationId}
          />
        </div>
      </div>
    </DecopilotLayout>
  );
}
