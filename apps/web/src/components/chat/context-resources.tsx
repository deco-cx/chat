import {
  applyDisplayNameToIntegration,
  formatFileSize,
  useAgents,
  useIntegrations,
  useTools,
  type Integration,
} from "@deco/sdk";
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
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useAgentSettingsToolsSet } from "../../hooks/use-agent-settings-tools-set.ts";
import type { UploadedFile } from "../../hooks/use-file-upload.ts";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
import { useThreadContext } from "../decopilot/thread-context-provider.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import type {
  FileContextItem,
  ResourceContextItem,
  RuleContextItem,
  ToolsetContextItem,
} from "./types.ts";

interface ContextResourcesProps {
  uploadedFiles?: UploadedFile[];
  isDragging?: boolean;
  removeFile?: (index: number) => void;
  enableFileUpload?: boolean;
  rightNode?: React.ReactNode;
}

// Shared styling for all resource items
const RESOURCE_ITEM_CLASSES =
  "bg-muted pl-0.5 py-0.5 pr-2 h-8 gap-1.5 hover:bg-muted/80 rounded-lg";

// Reusable remove button component
interface RemoveButtonProps {
  onClick: () => void;
  ariaLabel?: string;
  title?: string;
}

function RemoveButton({
  onClick,
  ariaLabel = "Remove",
  title,
}: RemoveButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute p-0 m-0 -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100 transition-opacity bg-background border shadow-sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={ariaLabel}
      title={title ?? ariaLabel}
    >
      <Icon name="close" size={12} aria-hidden="true" />
    </Button>
  );
}

// Helper to get file icon based on file type
function getFileIcon(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "pdf":
      return "picture_as_pdf";
    case "doc":
    case "docx":
      return "description";
    case "xls":
    case "xlsx":
      return "table_chart";
    case "ppt":
    case "pptx":
      return "slideshow";
    case "zip":
    case "rar":
    case "7z":
      return "folder_zip";
    case "txt":
      return "text_snippet";
    case "csv":
      return "grid_on";
    default:
      return "insert_drive_file";
  }
}

// Helper to check if file is an image
function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

// File Preview Card Component
interface FilePreviewCardProps {
  file: File;
  status: "uploading" | "done" | "error";
  onRemove: () => void;
}

function FilePreviewCard({ file, status, onRemove }: FilePreviewCardProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = isImageFile(file);

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file, isImage]);

  return (
    <div className="relative group h-8">
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              RESOURCE_ITEM_CLASSES,
              status === "uploading" && "opacity-60",
              status === "error" && "border-destructive text-destructive",
            )}
          >
            {status === "uploading" && <Spinner size="sm" />}
            {status === "error" && <Icon name="error" className="size-7" />}
            {isImage && previewUrl ? (
              <div className="size-7 rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="size-7 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center bg-background">
                <Icon
                  name={getFileIcon(file.name)}
                  size={16}
                  className="text-muted-foreground"
                />
              </div>
            )}
            <span className="max-w-[100px] truncate text-xs">{file.name}</span>
            <span className="text-xs text-muted-foreground">
              {formatFileSize(file.size)}
            </span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="p-2 max-w-xs">
          <div className="space-y-2">
            {/* Preview */}
            {isImage && previewUrl ? (
              <div className="relative w-48 h-48 rounded overflow-hidden bg-muted">
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center w-48 h-32 rounded bg-muted">
                <Icon
                  name={getFileIcon(file.name)}
                  className="h-12 w-12 text-muted-foreground"
                />
              </div>
            )}
            {/* File Details */}
            <div className="space-y-1">
              <p className="text-xs font-medium break-all">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)} • {file.type || "Unknown type"}
              </p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>

      <RemoveButton onClick={onRemove} />
    </div>
  );
}

export function ContextResources({
  uploadedFiles = [],
  removeFile,
  rightNode,
}: ContextResourcesProps) {
  // Read context from ThreadContextProvider instead of contextItems
  const { contextItems, removeContextItem, updateContextItem } =
    useThreadContext();

  const { data: integrations = [] } = useIntegrations();
  const { data: agents = [] } = useAgents();
  const { disableAllTools, setIntegrationTools } = useAgentSettingsToolsSet();

  // Filter context items by type
  const ruleItems = useMemo<RuleContextItem[]>(() => {
    return contextItems.filter(
      (item): item is RuleContextItem => item.type === "rule",
    );
  }, [contextItems]);

  const toolsetItems = useMemo<ToolsetContextItem[]>(() => {
    return contextItems.filter(
      (item): item is ToolsetContextItem => item.type === "toolset",
    );
  }, [contextItems]);

  const fileItems = useMemo<FileContextItem[]>(() => {
    return contextItems.filter(
      (item): item is FileContextItem => item.type === "file",
    );
  }, [contextItems]);

  const resourceItems = useMemo<ResourceContextItem[]>(() => {
    return contextItems.filter(
      (item): item is ResourceContextItem => item.type === "resource",
    );
  }, [contextItems]);

  const integrationsWithTools = useMemo(() => {
    return toolsetItems
      .map((item) => {
        const integration = integrations.find(
          (i) => i.id === item.integrationId,
        );
        if (!integration) return null;

        const integrationWithBetterName = applyDisplayNameToIntegration(
          integration,
          agents,
        );

        return {
          integration: integrationWithBetterName,
          enabledTools: item.enabledTools,
          integrationId: item.integrationId,
          contextItemId: item.id,
        };
      })
      .filter((x) => !!x);
  }, [toolsetItems, integrations, agents]);

  const integrationsWithTotalTools = useMemo(() => {
    return integrationsWithTools.map((item) => {
      const totalTools =
        (item.integration as Integration).tools?.length ||
        item.enabledTools.length;
      return {
        ...item,
        totalTools,
      };
    });
  }, [integrationsWithTools]);

  const handleRemoveIntegration = useCallback(
    (integrationId: string, contextItemId: string) => {
      try {
        // Remove the context item
        removeContextItem(contextItemId);

        // Also disable in agent settings
        disableAllTools(integrationId);
      } catch (error) {
        console.error("Failed to remove integration:", error);
      }
    },
    [disableAllTools, removeContextItem],
  );

  const handleToggleTool = useCallback(
    (
      integrationId: string,
      toolName: string,
      isEnabled: boolean,
      contextItemId: string,
    ) => {
      try {
        // Find the context item to get current tools
        const contextItem = contextItems.find(
          (item) => item.id === contextItemId,
        ) as ToolsetContextItem | undefined;
        if (!contextItem) return;

        const currentTools = contextItem.enabledTools || [];
        let newTools: string[];

        if (isEnabled) {
          newTools = currentTools.filter((tool) => tool !== toolName);
        } else {
          newTools = [...currentTools, toolName];
        }

        // Update context item
        updateContextItem(contextItemId, {
          enabledTools: newTools,
        });

        // Also update agent settings
        setIntegrationTools(integrationId, newTools);
      } catch (error) {
        console.error("Failed to toggle tool:", error);
      }
    },
    [updateContextItem, contextItems, setIntegrationTools],
  );

  const handleToggleRule = useCallback(
    (index: number, currentlyEnabled: boolean) => {
      if (currentlyEnabled) {
        // Find the rule item at this index and remove it
        const ruleItem = ruleItems[index];
        if (ruleItem) {
          removeContextItem(ruleItem.id);
        }
      } else {
        // This shouldn't happen in the current implementation
        // because we only show rules that are already enabled
        console.warn("Cannot enable a rule that doesn't exist");
      }
    },
    [removeContextItem, ruleItems],
  );

  const handleRemoveAllRules = useCallback(() => {
    // Remove all rule context items
    ruleItems.forEach((item) => {
      removeContextItem(item.id);
    });
  }, [removeContextItem, ruleItems]);

  const handleRemoveFile = useCallback(
    (id: string) => {
      try {
        if (!removeContextItem) {
          console.warn("removeContextItem is not available");
          return;
        }
        removeContextItem(id);
      } catch (error) {
        console.warn("Failed to remove file:", error);
      }
    },
    [removeContextItem],
  );

  return (
    <div className="w-full mx-auto relative">
      <div className="flex justify-between items-end gap-2 overflow-visible">
        <div className="flex flex-wrap gap-1.5 overflow-visible">
          {/* Display Rules */}
          {ruleItems.length > 0 && (
            <RulesDisplay
              rules={ruleItems}
              onRemove={handleRemoveAllRules}
              onToggleRule={handleToggleRule}
            />
          )}

          {/* Display Files from context */}
          {fileItems.map((fileItem) => (
            <div key={fileItem.id} className="relative group h-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={RESOURCE_ITEM_CLASSES}
                  >
                    {fileItem.status === "uploading" && <Spinner size="sm" />}
                    {fileItem.status === "success" && (
                      <Icon name="check" className="size-7" />
                    )}
                    {fileItem.status === "error" && (
                      <Icon name="error" className="size-7 text-destructive" />
                    )}
                    <span className="max-w-[100px] truncate text-xs">
                      {fileItem.file.name}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {fileItem.file.name} ({(fileItem.file.size / 1024).toFixed(1)}{" "}
                  KB)
                </TooltipContent>
              </Tooltip>
              <RemoveButton onClick={() => handleRemoveFile(fileItem.id)} />
            </div>
          ))}

          {/* Display uploaded files from props (used by chat-input) */}
          {uploadedFiles.map((fileItem, index) => (
            <FilePreviewCard
              key={`uploaded-${index}`}
              file={fileItem.file}
              status={fileItem.status}
              onRemove={() => removeFile?.(index)}
            />
          ))}

          {/* Display Integration Toolsets */}
          {integrationsWithTotalTools.map((item) => (
            <IntegrationToolsetDisplay
              key={item.contextItemId}
              integration={item.integration}
              enabledTools={item.enabledTools}
              totalTools={item.totalTools}
              integrationId={item.integrationId}
              contextItemId={item.contextItemId}
              onRemove={handleRemoveIntegration}
              onToggleTool={handleToggleTool}
            />
          ))}

          {/* Display Resources */}
          {resourceItems.map((resource) => (
            <div key={resource.id} className="relative group h-8">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    className={RESOURCE_ITEM_CLASSES}
                  >
                    {resource.icon && (
                      <Icon name={resource.icon} className="size-7" />
                    )}
                    <span className="max-w-[100px] text-xs truncate">
                      {resource.name || resource.uri.split("/").pop()}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {resource.resourceType}: {resource.uri}
                </TooltipContent>
              </Tooltip>
              <RemoveButton
                ariaLabel={`Remove resource ${resource.name ?? resource.uri}`}
                onClick={() => removeContextItem(resource.id)}
              />
            </div>
          ))}
        </div>

        {rightNode && <div className="flex-shrink-0">{rightNode}</div>}
      </div>
    </div>
  );
}

interface IntegrationToolsetDisplayProps {
  integration: Integration;
  enabledTools: string[];
  totalTools: number;
  integrationId: string;
  contextItemId: string;
  onRemove: (integrationId: string, contextItemId: string) => void;
  onToggleTool: (
    integrationId: string,
    toolName: string,
    isEnabled: boolean,
    contextItemId: string,
  ) => void;
}

const IntegrationToolsetDisplay = memo(function IntegrationToolsetDisplay({
  integration,
  enabledTools,
  totalTools,
  integrationId,
  contextItemId,
  onRemove,
  onToggleTool,
}: IntegrationToolsetDisplayProps) {
  const [open, setOpen] = useState(false);
  const { data: toolsData, isLoading } = useTools(integration.connection);

  const tools = toolsData?.tools || [];
  const actualTotalTools = tools.length || totalTools;

  return (
    <div className="relative group h-8">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={RESOURCE_ITEM_CLASSES}
          >
            <IntegrationIcon
              icon={integration.icon}
              name={integration.name}
              className="size-7 rounded-lg"
            />
            <span className="text-xs">{integration.name}</span>
            <span className="text-xs text-muted-foreground">
              {enabledTools.length}/{actualTotalTools}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IntegrationIcon
                  icon={integration.icon}
                  name={integration.name}
                  size="base"
                />
                <div>
                  <h4 className="font-medium text-xs">{integration.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {enabledTools.length} of {actualTotalTools} tools enabled
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              {isLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {tools.map((tool) => {
                    const isEnabled = enabledTools.includes(tool.name);
                    return (
                      <div
                        key={tool.name}
                        className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={isEnabled}
                          onCheckedChange={() =>
                            onToggleTool(
                              integrationId,
                              tool.name,
                              isEnabled,
                              contextItemId,
                            )
                          }
                          className="mt-0.5"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">
                            {formatToolName(tool.name)}
                          </p>
                          {tool.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {tool.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <RemoveButton onClick={() => onRemove(integrationId, contextItemId)} />
    </div>
  );
});

interface RulesDisplayProps {
  rules: RuleContextItem[];
  onRemove: () => void;
  onToggleRule: (index: number, currentlyEnabled: boolean) => void;
}

const RulesDisplay = memo(function RulesDisplay({
  rules,
  onRemove,
  onToggleRule,
}: RulesDisplayProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative group h-8">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={RESOURCE_ITEM_CLASSES}
          >
            <div className="size-7 rounded-lg overflow-hidden flex-shrink-0 flex items-center justify-center">
              <Icon name="rule" size={16} />
            </div>
            <span className="text-xs text-muted-foreground">
              {rules.length}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="rule" className="h-5 w-5" />
                <div>
                  <h4 className="font-medium text-sm">Context Rules</h4>
                  <p className="text-xs text-muted-foreground">
                    {rules.length} {rules.length === 1 ? "rule" : "rules"}{" "}
                    active
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {rules.map((rule, index) => {
                  return (
                    <div
                      key={rule.id}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={true}
                        onCheckedChange={() => onToggleRule(index, true)}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap line-clamp-6">
                          {rule.text}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <RemoveButton onClick={onRemove} />
    </div>
  );
});
