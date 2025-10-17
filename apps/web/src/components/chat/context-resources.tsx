import {
  DEFAULT_MODEL,
  applyDisplayNameToIntegration,
  useAgents,
  useIntegrations,
  useModels,
  type Integration,
  type Model,
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
import { memo, useCallback, useMemo, useState } from "react";
import { useAgentSettingsToolsSet } from "../../hooks/use-agent-settings-tools-set.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import type { UploadedFile } from "../../hooks/use-file-upload.ts";
import { useAgenticChat } from "./provider.tsx";
import type { FileContextItem, RuleContextItem, ToolsetContextItem, ResourceContextItem } from "./types.ts";
import { IntegrationIcon } from "../integrations/common.tsx";
import { formatToolName } from "../chat/utils/format-tool-name.ts";

interface ContextResourcesProps {
  uploadedFiles?: UploadedFile[];
  isDragging?: boolean;
  removeFile?: (index: number) => void;
  enableFileUpload?: boolean;
  rightNode?: React.ReactNode;
}

export function ContextResources({
  uploadedFiles = [],
  isDragging = false,
  removeFile,
  enableFileUpload = true,
  rightNode,
}: ContextResourcesProps) {
  const { 
    agent, 
    contextItems, 
    addContextItem, 
    removeContextItem, 
    updateContextItem,
    updateAgent 
  } = useAgenticChat();
  
  const { data: integrations = [] } = useIntegrations();
  const { data: agents = [] } = useAgents();
  const { data: models } = useModels({
    excludeDisabled: true,
  });
  const { preferences } = useUserPreferences();
  const { disableAllTools, setIntegrationTools } = useAgentSettingsToolsSet();

  const selectedModel =
    models.find((m: Model) => m.id === preferences.defaultModel) ||
    DEFAULT_MODEL;

  // Extract different types of context items
  const ruleItems = useMemo(
    () => contextItems.filter((item): item is RuleContextItem => item.type === "rule"),
    [contextItems]
  );

  const fileItems = useMemo(
    () => contextItems.filter((item): item is FileContextItem => item.type === "file"),
    [contextItems]
  );

  const toolsetItems = useMemo(
    () => contextItems.filter((item): item is ToolsetContextItem => item.type === "toolset"),
    [contextItems]
  );

  const resourceItems = useMemo(
    () => contextItems.filter((item): item is ResourceContextItem => item.type === "resource"),
    [contextItems]
  );

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
    return toolsetItems
      .map((item) => {
        const integration = integrations.find((i) => i.id === item.integrationId);
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
        disableAllTools(integrationId);
        removeContextItem(contextItemId);
      } catch (error) {
        console.error("Failed to remove integration:", error);
      }
    },
    [disableAllTools, removeContextItem],
  );

  const handleToggleTool = useCallback(
    (integrationId: string, toolName: string, isEnabled: boolean, contextItemId: string) => {
      try {
        const toolsetItem = toolsetItems.find(item => item.id === contextItemId);
        if (!toolsetItem) return;

        const currentTools = toolsetItem.enabledTools;
        let newTools: string[];

        if (isEnabled) {
          newTools = currentTools.filter((tool) => tool !== toolName);
        } else {
          newTools = [...currentTools, toolName];
        }

        setIntegrationTools(integrationId, newTools);
        updateContextItem(contextItemId, { enabledTools: newTools });
      } catch (error) {
        console.error("Failed to toggle tool:", error);
      }
    },
    [toolsetItems, setIntegrationTools, updateContextItem],
  );

  const handleRemoveRule = useCallback(
    (id: string) => {
      removeContextItem(id);
    },
    [removeContextItem],
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      removeContextItem(id);
    },
    [removeContextItem],
  );

  return (
    <div className="w-full mx-auto relative">
      <div className="flex justify-between items-end gap-2 mb-4 overflow-visible">
        <div className="flex flex-wrap gap-2 overflow-visible">
          {/* Display Rules */}
          {ruleItems.map((rule) => (
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
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm"
                onClick={() => handleRemoveRule(rule.id)}
              >
                <Icon name="close" className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* Display Files from context */}
          {fileItems.map((fileItem) => (
            <div key={fileItem.id} className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    {fileItem.status === "uploading" && <Spinner size="xs" />}
                    {fileItem.status === "success" && <Icon name="check" className="h-3 w-3" />}
                    {fileItem.status === "error" && <Icon name="error" className="h-3 w-3 text-destructive" />}
                    <span className="max-w-[100px] truncate">{fileItem.file.name}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {fileItem.file.name} ({(fileItem.file.size / 1024).toFixed(1)} KB)
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm"
                onClick={() => handleRemoveFile(fileItem.id)}
              >
                <Icon name="close" className="h-3 w-3" />
              </Button>
            </div>
          ))}
          
          {/* Display uploaded files from props (used by chat-input) */}
          {uploadedFiles.map((fileItem, index) => (
            <div key={`uploaded-${index}`} className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    {fileItem.status === "uploading" && <Spinner size="xs" />}
                    {fileItem.status === "done" && <Icon name="check" className="h-3 w-3" />}
                    {fileItem.status === "error" && <Icon name="error" className="h-3 w-3 text-destructive" />}
                    <span className="max-w-[100px] truncate">{fileItem.file.name}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {fileItem.file.name} ({(fileItem.file.size / 1024).toFixed(1)} KB)
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm"
                onClick={() => removeFile?.(index)}
              >
                <Icon name="close" className="h-3 w-3" />
              </Button>
            </div>
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
            <div key={resource.id} className="relative group">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                  >
                    {resource.icon && <Icon name={resource.icon} className="h-3 w-3" />}
                    <span className="max-w-[100px] truncate">
                      {resource.name || resource.uri.split("/").pop()}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {resource.resourceType}: {resource.uri}
                </TooltipContent>
              </Tooltip>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm"
                onClick={() => removeContextItem(resource.id)}
              >
                <Icon name="close" className="h-3 w-3" />
              </Button>
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
  onToggleTool: (integrationId: string, toolName: string, isEnabled: boolean, contextItemId: string) => void;
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

  return (
    <div className="relative group">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
          >
            <IntegrationIcon icon={integration.icon} name={integration.name} size="sm" />
            <span>{integration.name}</span>
            <span className="text-xs text-muted-foreground">
              {enabledTools.length}/{totalTools}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IntegrationIcon icon={integration.icon} name={integration.name} size="base" />
                <div>
                  <h4 className="font-medium text-sm">{integration.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {enabledTools.length} of {totalTools} tools enabled
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {integration.tools?.map((tool) => {
                  const isEnabled = enabledTools.includes(tool.name);
                  return (
                    <div
                      key={tool.name}
                      className="flex items-start gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={isEnabled}
                        onCheckedChange={() =>
                          onToggleTool(integrationId, tool.name, isEnabled, contextItemId)
                        }
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{formatToolName(tool.name)}</p>
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
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute -top-2 -right-2 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-background border shadow-sm"
        onClick={() => onRemove(integrationId, contextItemId)}
      >
        <Icon name="close" className="h-3 w-3" />
      </Button>
    </div>
  );
});
