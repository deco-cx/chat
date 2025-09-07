import {
  applyDisplayNameToIntegration,
  DEFAULT_MODEL,
  type Integration,
  type Model,
  useAgents,
  useIntegrations,
  useModels,
  useSDK,
  useWriteFile,
} from "@deco/sdk";
import { Hosts } from "@deco/sdk/hosts";
import { Button } from "@deco/ui/components/button.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAgentSettingsToolsSet } from "../../hooks/use-agent-settings-tools-set.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { formatFilename } from "../../utils/format.ts";
import { useAgent } from "../agent/provider.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { SelectConnectionDialog } from "../integrations/select-connection-dialog.tsx";
import { formatToolName } from "./utils/format-tool-name.ts";
import {
  onResourceError,
  onResourceLoaded,
  onResourceLoading,
} from "../../utils/events.ts";
import type { IntegrationViewItem } from "../decopilot/use-view.ts";
import { useViewRoute } from "../views/view-route-context.tsx";
// Rules now derived from the current integration view item

interface IntegrationWithTools extends Integration {
  tools?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface UploadedFile {
  file: File;
  url?: string;
  status: "uploading" | "done" | "error";
  error?: string;
  clientId?: string;
}

const useGlobalDrop = (handleFileDrop: (e: DragEvent) => void) => {
  const [isDragging, setIsDragging] = useState(false);

  /** Global file drop handler */
  useEffect(() => {
    /**
     * These drag events conflict with the ones from dockview.
     * This variable is drue when dragging elements from dockview, preventing
     * us setting the dragging state to true.
     */
    let skip = false;

    function handleDrop(e: Event) {
      setIsDragging(false);
      skip = false;
      const dragEvent = e as unknown as DragEvent;
      handleFileDrop(dragEvent);
    }
    function handleDragOver(e: Event) {
      if (skip) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
    }
    function handleDragEnd() {
      skip = false;
      setIsDragging(false);
    }
    /**
     * This is fired when dragging elements from dockview. Dragging files
     * do not fire this event
     */
    function handleDrag() {
      skip = true;
    }

    globalThis.addEventListener("drop", handleDrop);
    globalThis.addEventListener("drag", handleDrag);
    globalThis.addEventListener("dragover", handleDragOver);
    globalThis.addEventListener("dragend", handleDragEnd);

    return () => {
      globalThis.removeEventListener("drop", handleDrop);
      globalThis.removeEventListener("drag", handleDrag);
      globalThis.removeEventListener("dragover", handleDragOver);
      globalThis.removeEventListener("dragend", handleDragEnd);
    };
  }, [handleFileDrop]);

  return isDragging;
};

interface ContextResourcesProps {
  uploadedFiles: UploadedFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>;
}

export function ContextResources({
  uploadedFiles,
  setUploadedFiles,
}: ContextResourcesProps) {
  const { agent } = useAgent();
  const { workspace } = useSDK();
  const { data: integrations = [] } = useIntegrations();
  const { data: agents = [] } = useAgents();
  const { data: models } = useModels({
    excludeDisabled: true,
  });
  const { preferences } = useUserPreferences();
  const { disableAllTools, enableAllTools, setIntegrationTools } =
    useAgentSettingsToolsSet();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const writeFileMutation = useWriteFile();

  const selectedModel =
    models.find((m: Model) => m.id === preferences.defaultModel) ||
    DEFAULT_MODEL;

  const getAcceptedFileTypes = () => {
    const acceptTypes: string[] = [];
    if (selectedModel.capabilities.includes("image-upload")) {
      acceptTypes.push("image/jpeg", "image/png", "image/gif", "image/webp");
    }
    if (selectedModel.capabilities.includes("file-upload")) {
      acceptTypes.push("text/*", "application/pdf");
    }
    return acceptTypes.join(",");
  };

  const integrationsWithTools = useMemo(() => {
    if (!agent?.tools_set) return [];

    return Object.entries(agent.tools_set)
      .map(([integrationId, enabledTools]) => {
        const integration = integrations.find((i) => i.id === integrationId);
        if (!integration) return null;

        // Apply better display names to the integration
        const integrationWithBetterName = applyDisplayNameToIntegration(
          integration,
          agents,
        );

        return {
          integration: integrationWithBetterName,
          enabledTools: Array.isArray(enabledTools) ? enabledTools : [],
          integrationId,
        };
      })
      .filter((x) => !!x);
  }, [agent?.tools_set, integrations, agents]);

  // Get total tools for each integration
  const integrationsWithTotalTools = useMemo(() => {
    return integrationsWithTools.map((item) => {
      // Use integration.tools?.length for total tools count, handle nullable field
      const totalTools =
        (item.integration as IntegrationWithTools).tools?.length ||
        item.enabledTools.length;
      return {
        ...item,
        totalTools,
      };
    });
  }, [integrationsWithTools]);

  const handleRemoveIntegration = (integrationId: string) => {
    if (!agent) return;

    try {
      // Use the disableAllTools function from useAgentSettingsToolsSet
      disableAllTools(integrationId);
    } catch (error) {
      console.error("Failed to remove integration:", error);
      // You could add a toast notification here if needed
    }
  };

  const handleToggleTool = (
    integrationId: string,
    toolName: string,
    isEnabled: boolean,
  ) => {
    if (!agent) return;

    try {
      const currentTools = agent.tools_set?.[integrationId] || [];
      let newTools: string[];

      if (isEnabled) {
        // Remove tool
        newTools = currentTools.filter((tool) => tool !== toolName);
      } else {
        // Add tool
        newTools = [...currentTools, toolName];
      }

      // Use setIntegrationTools to update the tools for this integration
      setIntegrationTools(integrationId, newTools);
    } catch (error) {
      console.error("Failed to toggle tool:", error);
    }
  };

  const handleAddIntegration = (integration: Integration) => {
    // Use the enableAllTools function from useAgentSettingsToolsSet
    enableAllTools(integration.id);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;

    if (fileList?.length) {
      uploadFileList(fileList);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();

    const fileList = e.dataTransfer?.files;
    if (fileList?.length) {
      uploadFileList(fileList);
    }
  }

  async function uploadFileList(fileList: FileList) {
    const newFiles = Array.from(fileList);

    // Prevent duplicates and limit to 5 files
    const allFiles = [...uploadedFiles.map((uf) => uf.file), ...newFiles].slice(
      0,
      5,
    );

    const uniqueFiles = Array.from(
      new Map(allFiles.map((f) => [f.name + f.size, f])).values(),
    );

    const filesToUpload = uniqueFiles
      .filter(
        (file) =>
          !uploadedFiles.some(
            (uf) => uf.file.name === file.name && uf.file.size === file.size,
          ),
      )
      .map((file): UploadedFile => ({ file, status: "uploading" }));

    setUploadedFiles((prev) => [...prev, ...filesToUpload]);
    await Promise.all(filesToUpload.map(({ file }) => uploadFile(file)));
  }

  async function uploadFile(file: File) {
    try {
      const path = `uploads/${formatFilename(file.name)}-${Date.now()}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });

      const url = `https://${Hosts.API_LEGACY}/files/${workspace}/${path}`; // does not work when running locally

      setUploadedFiles((prev) =>
        prev.map((uf) =>
          uf.file === file
            ? { ...uf, url: url || undefined, status: "done" }
            : uf,
        ),
      );
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((uf) =>
          uf.file === file
            ? {
                ...uf,
                status: "error",
                error: error instanceof Error ? error.message : "Upload failed",
              }
            : uf,
        ),
      );
    }
  }

  const isDragging = useGlobalDrop(handleFileDrop);

  // Rules for the chat now come from the current route context.
  // Context provider dispatches rules; we only display and allow removal locally.
  const { view } = useViewRoute();
  const viewRules = (view as IntegrationViewItem | undefined)?.rules ?? [];
  const [persistedRules, setPersistedRules] = useState<
    Array<{ id: string; text: string }>
  >(
    (viewRules as string[]).map((text: string, idx: number) => ({
      id: `view-rule-initial-${idx}`,
      text,
    })),
  );

  const removeRule = (id: string) => {
    setPersistedRules((prev) => prev.filter((r) => r.id !== id));
  };

  // Expose rules to rest of app via custom event (AgentProvider listens)
  useEffect(() => {
    const rules = persistedRules.map((r) => r.text);
    // Avoid dispatch storms: minimal debounce not necessary here; list is small
    import("../../utils/events.ts").then(({ dispatchRulesUpdated }) =>
      dispatchRulesUpdated({ rules }),
    );
  }, [persistedRules]);

  // Listen for resource lifecycle events from mentions and manage uploadedFiles
  useEffect(() => {
    const offLoading = onResourceLoading(({ detail }) => {
      if (!detail?.clientId) return;
      const file = new File([new Blob()], detail.name || "resource", {
        type: detail.contentType || "application/octet-stream",
      });
      setUploadedFiles((prev) => [
        ...prev,
        { file, status: "uploading", clientId: detail.clientId },
      ]);
    });

    const offLoaded = onResourceLoaded(async ({ detail }) => {
      if (!detail?.clientId || !detail?.url) return;
      try {
        const res = await fetch(detail.url);
        const blob = await res.blob();
        const file = new File([blob], detail.name || "resource", {
          type: detail.contentType || blob.type || "application/octet-stream",
        });
        setUploadedFiles((prev) =>
          prev.map((uf) =>
            uf.clientId === detail.clientId
              ? { ...uf, file, url: detail.url, status: "done" }
              : uf,
          ),
        );
      } catch (err) {
        setUploadedFiles((prev) =>
          prev.map((uf) =>
            uf.clientId === detail.clientId
              ? {
                  ...uf,
                  status: "error",
                  error: err instanceof Error ? err.message : "Failed to load",
                }
              : uf,
          ),
        );
      }
    });

    const offError = onResourceError(({ detail }) => {
      if (!detail?.clientId) return;
      setUploadedFiles((prev) =>
        prev.map((uf) =>
          uf.clientId === detail.clientId
            ? {
                ...uf,
                status: "error",
                error: detail.error || "Failed to read",
              }
            : uf,
        ),
      );
    });

    return () => {
      offLoading();
      offLoaded();
      offError();
    };
  }, [setUploadedFiles]);

  return (
    <div className="w-full mx-auto">
      <FileDropOverlay display={isDragging} />
      <div className="flex flex-wrap gap-2 mb-4 overflow-visible">
        {/* rules now rendered after add button below */}
        {/* File Upload Button */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          className="hidden"
          accept={getAcceptedFileTypes()}
        />
        {(selectedModel.capabilities.includes("file-upload") ||
          selectedModel.capabilities.includes("image-upload")) && (
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Upload files"
            onClick={() => fileInputRef.current?.click()}
          >
            <Icon name="file_upload" />
          </Button>
        )}
        <SelectConnectionDialog
          onSelect={handleAddIntegration}
          trigger={
            <Button
              type="button"
              variant="outline"
              size="icon"
              title="Add files or integrations"
            >
              <Icon name="alternate_email" />
            </Button>
          }
        />

        {persistedRules.map((rule) => (
          <div key={rule.id} className="relative group">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="View rule"
                >
                  <Icon name="rule" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs break-words">
                {rule.text.length > 160
                  ? `${rule.text.slice(0, 160)}…`
                  : rule.text}
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeRule(rule.id)}
              className="absolute -top-1 -right-1 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/50 hover:text-sidebar"
              title="Remove rule"
            >
              <Icon name="close" size={10} />
            </Button>
          </div>
        ))}

        {/* Integration Items */}
        {integrationsWithTotalTools.map(
          ({ integration, enabledTools, integrationId, totalTools }) => (
            <IntegrationResourceItem
              key={integrationId}
              integration={integration}
              enabledTools={enabledTools}
              totalTools={totalTools}
              onRemove={() => handleRemoveIntegration(integrationId)}
              onToggleTool={(toolName, isEnabled) =>
                handleToggleTool(integrationId, toolName, isEnabled)
              }
            />
          ),
        )}

        {/* File Preview Items */}
        {uploadedFiles.map((uf, index) => (
          <FilePreviewItem
            key={uf.file.name + uf.file.size}
            uploadedFile={uf}
            removeFile={() => {
              setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
            }}
          />
        ))}
      </div>
    </div>
  );
}

interface IntegrationResourceItemProps {
  integration: Integration;
  enabledTools: string[];
  totalTools: number;
  onRemove: () => void;
  onToggleTool: (toolName: string, isEnabled: boolean) => void;
}

function IntegrationResourceItem({
  integration,
  enabledTools,
  totalTools,
  onRemove,
  onToggleTool,
}: IntegrationResourceItemProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  return (
    <div className="relative group flex items-center gap-1.5 px-1.5 py-1 bg-muted/50 rounded-xl border border-border h-10">
      <Popover>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded p-1 flex-1">
            <div className="flex items-center justify-center size-6 rounded overflow-hidden bg-muted flex-shrink-0">
              <IntegrationIcon
                icon={integration.icon}
                name={integration.name}
                className="h-6 w-6"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-medium truncate leading-tight">
                {integration.name}
              </div>
              <div className="text-xs text-muted-foreground leading-tight">
                {enabledTools.length}/{totalTools}
              </div>
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start" side="top">
          <div className="space-y-2">
            <div className="font-medium text-sm">{integration.name}</div>
            <div className="text-xs text-muted-foreground">
              {enabledTools.length} of {totalTools} tools enabled
            </div>
            {(integration as IntegrationWithTools).tools && (
              <div className="space-y-1">
                <div className="text-xs font-medium">Tools:</div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(integration as IntegrationWithTools).tools!.map(
                    (tool, index: number) => {
                      const isEnabled = enabledTools.includes(tool.name);
                      return (
                        <div
                          key={index}
                          className="flex items-center justify-between text-xs px-2 py-1 bg-muted rounded hover:bg-muted/80"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">
                              {formatToolName(tool.name)}
                            </div>
                            {tool.description && (
                              <div className="text-muted-foreground text-xs truncate">
                                {tool.description}
                              </div>
                            )}
                          </div>
                          <Checkbox
                            checked={isEnabled}
                            onCheckedChange={() =>
                              onToggleTool(tool.name, isEnabled)
                            }
                            className="ml-2 flex-shrink-0"
                          />
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={async () => {
          setIsRemoving(true);
          try {
            await onRemove();
          } finally {
            setIsRemoving(false);
          }
        }}
        disabled={isRemoving}
        className="absolute -top-1 -right-1 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/50 hover:text-sidebar flex-shrink-0"
        title={`Remove ${integration.name} integration`}
      >
        {isRemoving ? <Spinner size="xs" /> : <Icon name="close" size={10} />}
      </Button>
    </div>
  );
}

function FileDropOverlay({ display }: { display: boolean }) {
  if (!display) {
    return null;
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "absolute bottom-2 left-0 right-0 z-50",
          "flex flex-col items-center justify-center gap-2",
          "pointer-events-none animate-fade-in",
          "p-8 shadow-2xl rounded-2xl border border-border bg-background/95",
        )}
      >
        <Icon name="upload" size={48} className="text-foreground" />
        <span className="text-lg font-semibold text-foreground">
          Drop files to upload
        </span>
        <span className="text-sm text-muted-foreground">
          (Max 5 files, images or PDFs)
        </span>
      </div>
    </div>
  );
}

interface FilePreviewItemProps {
  uploadedFile: UploadedFile;
  removeFile: () => void;
}

function FilePreviewItem({ uploadedFile, removeFile }: FilePreviewItemProps) {
  const { file, status, error, url } = uploadedFile;

  return (
    <div className="relative group flex items-center gap-1.5 px-1.5 py-1 bg-muted/50 rounded-xl border border-border h-10">
      <div className="flex items-center justify-center size-6 rounded overflow-hidden bg-muted flex-shrink-0">
        {status === "uploading" ? (
          <Spinner size="xs" />
        ) : status === "error" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Icon name="error" size={16} className="text-destructive" />
            </TooltipTrigger>
            <TooltipContent className="flex flex-col items-center">
              Error uploading file {error?.toString()}
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            {file.type.startsWith("image/") && url ? (
              <img src={url} className="h-full w-full object-cover" />
            ) : (
              <Icon name="draft" size={16} />
            )}
          </>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        <div className="text-xs font-medium truncate leading-tight">
          {file.name}
        </div>
        <div className="text-xs text-muted-foreground leading-tight">
          {(file.size / 1024).toFixed(1)}KB
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute -top-1 -right-1 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/50 hover:text-sidebar flex-shrink-0"
        onClick={removeFile}
        title="Remove file"
      >
        <Icon name="close" size={10} />
      </Button>
    </div>
  );
}
