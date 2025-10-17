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
import type { UploadedFile } from "../../hooks/use-file-upload.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useAgent } from "../agent/provider.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { formatToolName } from "./utils/format-tool-name.ts";
// Rules now derived from the agent context

interface ContextResourcesProps {
  uploadedFiles: UploadedFile[];
  isDragging: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeFile: (index: number) => void;
  enableFileUpload: boolean;
}

export function ContextResources({
  uploadedFiles,
  isDragging,
  fileInputRef,
  handleFileChange,
  removeFile,
  enableFileUpload,
}: ContextResourcesProps) {
  const { agent, rules, setRules } = useAgent();
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
        (item.integration as Integration).tools?.length ||
        item.enabledTools.length;
      return {
        ...item,
        totalTools,
      };
    });
  }, [integrationsWithTools]);

  const handleRemoveIntegration = useCallback(
    (integrationId: string) => {
      if (!agent) return;

      try {
        // Use the disableAllTools function from useAgentSettingsToolsSet
        disableAllTools(integrationId);
      } catch (error) {
        console.error("Failed to remove integration:", error);
        // You could add a toast notification here if needed
      }
    },
    [agent, disableAllTools],
  );

  const handleToggleTool = useCallback(
    (integrationId: string, toolName: string, isEnabled: boolean) => {
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
    },
    [agent, setIntegrationTools],
  );

  // Convert rules to persistedRules format for display
  const persistedRules = useMemo(
    () =>
      rules.map((text: string, idx: number) => ({
        id: `agent-rule-${idx}`,
        text,
      })),
    [rules],
  );

  const removeRule = useCallback(
    (id: string) => {
      const ruleIndex = parseInt(id.replace("agent-rule-", ""));
      const newRules = rules.filter(
        (_: string, idx: number) => idx !== ruleIndex,
      );
      setRules(newRules);
    },
    [rules, setRules],
  );

  return (
    <div className="w-full mx-auto">
      <FileDropOverlay display={isDragging} />
      <div className="flex flex-wrap gap-2 overflow-visible">
        {/* File Upload Button */}
        {enableFileUpload && (
          <>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              className="hidden"
              accept={getAcceptedFileTypes()}
            />
          </>
        )}

        {persistedRules.length > 0 && (
          <div className="relative group">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Show prompts"
                  className="flex items-center justify-center size-10 rounded-lg bg-muted"
                >
                  <Icon name="rule" size={20} className="text-foreground" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-md p-0" align="start">
                <div className="max-h-[300px] overflow-y-auto">
                  {persistedRules.map((rule, index) => (
                    <div
                      key={rule.id}
                      className="group/rule p-3 text-sm border-b border-border/15 last:border-0 hover:bg-accent/10 transition-colors relative"
                    >
                      <div className="flex items-start gap-2 pr-6">
                        <span className="text-xs text-muted-foreground font-medium flex-shrink-0 mt-0.5">
                          {index + 1}.
                        </span>
                        <p className="text-xs leading-relaxed break-words flex-1 line-clamp-4">
                          {rule.text}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeRule(rule.id);
                        }}
                        className="absolute top-2 right-2 h-5 w-5 opacity-0 group-hover/rule:opacity-100 transition-opacity rounded-full bg-background/10 text-background hover:bg-background/40 hover:text-background"
                        title="Remove this prompt"
                      >
                        <Icon name="close" size={12} />
                      </Button>
                    </div>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => {
                // Remove all rules
                setRules([]);
              }}
              className="absolute -top-1 -right-1 h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm bg-primary text-primary-foreground hover:bg-primary/50 hover:text-sidebar"
              title="Remove all prompts"
            >
              <Icon name="close" size={10} />
            </Button>
          </div>
        )}

        {/* Integration Items */}
        {integrationsWithTotalTools.map(
          ({ integration, enabledTools, integrationId, totalTools }) => (
            <IntegrationResourceItemWrapper
              key={integrationId}
              integration={integration}
              enabledTools={enabledTools}
              totalTools={totalTools}
              integrationId={integrationId}
              onRemove={handleRemoveIntegration}
              onToggleTool={handleToggleTool}
            />
          ),
        )}

        {/* File Preview Items */}
        {uploadedFiles.map((uf, index) => (
          <FilePreviewItem
            key={uf.file.name + uf.file.size}
            uploadedFile={uf}
            removeFile={() => removeFile(index)}
          />
        ))}
      </div>
    </div>
  );
}

interface IntegrationResourceItemWrapperProps {
  integration: Integration;
  enabledTools: string[];
  totalTools: number;
  integrationId: string;
  onRemove: (integrationId: string) => void;
  onToggleTool: (
    integrationId: string,
    toolName: string,
    isEnabled: boolean,
  ) => void;
}

function IntegrationResourceItemWrapper({
  integration,
  enabledTools,
  totalTools,
  integrationId,
  onRemove,
  onToggleTool,
}: IntegrationResourceItemWrapperProps) {
  const handleRemove = useCallback(
    () => onRemove(integrationId),
    [onRemove, integrationId],
  );
  const handleToggleTool = useCallback(
    (toolName: string, isEnabled: boolean) =>
      onToggleTool(integrationId, toolName, isEnabled),
    [onToggleTool, integrationId],
  );

  return (
    <IntegrationResourceItem
      integration={integration}
      enabledTools={enabledTools}
      totalTools={totalTools}
      onRemove={handleRemove}
      onToggleTool={handleToggleTool}
    />
  );
}

interface IntegrationResourceItemProps {
  integration: Integration;
  enabledTools: string[];
  totalTools: number;
  onRemove: () => void;
  onToggleTool: (toolName: string, isEnabled: boolean) => void;
}

const IntegrationResourceItem = memo(function IntegrationResourceItem({
  integration,
  enabledTools,
  totalTools,
  onRemove,
  onToggleTool,
}: IntegrationResourceItemProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  return (
    <div className="relative group flex items-center gap-2 p-1 pr-2.5 bg-muted rounded-lg h-10">
      <Popover>
        <PopoverTrigger asChild>
          <div className="flex items-center gap-2.5 cursor-pointer rounded flex-1">
            <div className="flex items-center justify-center size-8 rounded overflow-hidden flex-shrink-0">
              <IntegrationIcon
                icon={integration.icon}
                name={integration.name}
                className="size-full"
              />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="text-xs font-normal truncate leading-4">
                {integration.name}
              </div>
              <div className="text-xs text-muted-foreground leading-4">
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
            {(integration as Integration).tools && (
              <div className="space-y-1">
                <div className="text-xs font-medium">Tools:</div>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {(integration as Integration).tools!.map(
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
});

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
    <div className="relative group flex items-center gap-2 p-1 pr-2.5 bg-muted rounded-lg h-10">
      <div className="flex items-center justify-center size-8 rounded overflow-hidden flex-shrink-0">
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
        <div className="text-xs font-normal truncate leading-4">
          {file.name}
        </div>
        <div className="text-xs text-muted-foreground leading-4">
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
