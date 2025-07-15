import { type Integration, type MCPTool, useTools } from "@deco/sdk";
import { useProfile } from "@deco/sdk/hooks";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { IntegrationIcon } from "../integrations/common.tsx";
import { ExpandableDescription } from "./description.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";

interface ToolsMap {
  [integrationId: string]: string[];
}

function IntegrationListItemActions({
  integration,
  onConfigure,
  onRemove,
}: {
  integration: Integration;
  onConfigure: () => void;
  onRemove: (integrationId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <Icon name="more_horiz" className="text-foreground" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={onConfigure}
          className="text-foreground focus:bg-primary/10"
        >
          Configure
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onRemove(integration.id)}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          Remove
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function IntegrationListItem({
  toolsSet,
  setIntegrationTools,
  integration,
  onRemove,
  onConfigure,
  hideTools,
  hideActions,
  searchTerm = "",
}: {
  toolsSet: ToolsMap;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  integration: Integration;
  onConfigure: (integration: Integration) => void;
  onRemove: (integrationId: string) => void;
  hideTools?: boolean;
  hideActions?: boolean;
  searchTerm?: string;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const { data: toolsData, isLoading } = useTools(integration.connection);

  const total = toolsData?.tools?.length ?? 0;

  const allTools = toolsData?.tools || [];
  const enabledCount =
    allTools.filter((tool) => toolsSet[integration.id]?.includes(tool.name))
      .length;
  const isAll = enabledCount === total && total > 0;
  const isEmpty = !isLoading && allTools.length === 0;

  // Helper function to check if a tool matches the search term
  const toolMatchesSearch = (tool: MCPTool, lowerSearchTerm: string) => {
    if (!lowerSearchTerm) return true;

    const toolNameFormatted = beautifyToolName(tool.name).toLowerCase();
    const toolNameOriginal = tool.name.toLowerCase();
    const toolDescription = tool.description?.toLowerCase() || "";

    return toolNameFormatted.includes(lowerSearchTerm) ||
      toolNameOriginal.includes(lowerSearchTerm) ||
      toolDescription.includes(lowerSearchTerm);
  };

  // Filter tools based on search term
  const filteredTools = allTools.filter((tool) =>
    toolMatchesSearch(tool, searchTerm)
  );

  // Hide integration if searching and no tools match
  if (searchTerm && filteredTools.length === 0 && !isLoading) {
    return null;
  }

  // Auto-expand tools when searching
  const shouldExpandTools = searchTerm && filteredTools.length > 0;
  const effectiveToolsOpen = toolsOpen || shouldExpandTools;

  function handleAll(checked: boolean) {
    setIntegrationTools(
      integration.id,
      checked ? allTools.map((tool) => tool.name) : [],
    );
  }

  return (
    <div
      key={integration.id}
      className={cn(
        "w-full flex flex-col rounded-xl transition-colors border border-border relative",
        isEmpty && "order-last",
      )}
    >
      <div className="flex gap-4 p-2 rounded-t-xl">
        <div className="flex gap-4 items-center justify-between w-full">
          <div>
            <IntegrationIcon
              icon={integration.icon}
              name={integration.name}
              className="h-9 w-9"
            />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <span className="text-sm text-foreground font-semibold text-left truncate">
              {integration.name}
            </span>
          </div>
        </div>
        {!hideActions && (
          <IntegrationListItemActions
            integration={integration}
            onConfigure={() => onConfigure(integration)}
            onRemove={onRemove}
          />
        )}
      </div>
      {isEmpty && (
        <div
          onClick={(e) => {
            e.preventDefault();
            onConfigure(integration);
          }}
          className={cn(
            "flex gap-2 items-center justify-between px-4 py-4 border-t border-border cursor-pointer",
            "hover:bg-muted rounded-b-xl",
          )}
        >
          <div className="flex gap-2 items-center">
            <Icon name="settings" size={16} />
            <span className="text-xs font-medium">Connection settings</span>
          </div>
          <Badge variant="destructive">
            <Icon name="error" size={10} />
            Error
          </Badge>
        </div>
      )}
      {(!isEmpty && !hideTools) && (
        <div
          className={cn(
            "flex flex-col items-start gap-1 min-w-0 border-t border-border cursor-pointer bg-background rounded-b-xl",
            !effectiveToolsOpen && "hover:bg-muted",
          )}
        >
          <span
            onClick={() => setToolsOpen(!toolsOpen)}
            className={cn(
              "text-muted-foreground text-sm h-10 flex items-center w-full hover:bg-muted pl-2 pr-4",
              !effectiveToolsOpen && "rounded-b-xl",
            )}
          >
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Icon
                  name="chevron_right"
                  filled
                  size={14}
                  className={cn(
                    "inline-block mr-1 align-text-bottom text-foreground",
                    effectiveToolsOpen && "rotate-90",
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium text-muted-foreground",
                    isLoading && "animate-pulse",
                  )}
                >
                  {isLoading
                    ? "Loading tools..."
                    : searchTerm
                    ? `${filteredTools.length} matching tools`
                    : "All tools"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {enabledCount}/{total}
                </span>
                <Checkbox
                  id={`select-all-${integration.id}`}
                  className="cursor-pointer"
                  checked={isAll}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAll(!isAll);
                  }}
                  disabled={isLoading}
                />
              </div>
            </div>
          </span>
          {effectiveToolsOpen && (
            <ToolList
              integration={integration}
              toolsSet={toolsSet}
              isLoading={isLoading}
              setIntegrationTools={setIntegrationTools}
              filteredTools={filteredTools}
            />
          )}
        </div>
      )}
    </div>
  );
}

function beautifyToolName(text: string) {
  return text
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// @franca: temporary, leandro wants a talking agent in vtex day
const clientHiddenTools = ["SPEAK"];
const hideFor = (email: string) => {
  return !email.endsWith("@deco.cx");
};

function ToolList({
  className,
  integration,
  toolsSet,
  isLoading,
  setIntegrationTools,
  filteredTools,
}: {
  integration: Integration;
  toolsSet: ToolsMap;
  isLoading: boolean;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  filteredTools: MCPTool[];
  className?: string;
}) {
  const { data: profile } = useProfile();

  // Apply client-side filtering for hidden tools on top of search filtering
  const displayTools = filteredTools.filter((tool) =>
    !(clientHiddenTools.includes(tool.name) && hideFor(profile?.email))
  );

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-b-xl max-h-[350px] w-full overflow-y-auto">
      {displayTools?.map((tool) => {
        const enabled = toolsSet[integration.id]?.includes(tool.name) ??
          false;

        const handleCheckboxChange = (checked: boolean) => {
          const withoutTool = toolsSet[integration.id]?.filter((t) =>
            t !== tool.name
          );
          const withTool = [...(toolsSet[integration.id] || []), tool.name];
          const toolsToUpdate = checked ? withTool : withoutTool;
          setIntegrationTools(integration.id, toolsToUpdate);
        };

        return (
          <label
            key={tool.name}
            className="flex items-center justify-between gap-3 px-4 hover:bg-muted cursor-pointer"
            htmlFor={`${integration.id}-${tool.name}`}
          >
            <div className="flex flex-col min-w-0 border-l border-border border-dashed p-4 pr-0">
              <span
                className={cn(
                  "text-sm truncate cursor-pointer text-foreground",
                  !enabled && "text-muted-foreground",
                )}
              >
                {beautifyToolName(tool.name)}
              </span>
              {tool.description && (
                <ExpandableDescription description={tool.description} />
              )}
            </div>
            <Checkbox
              checked={enabled}
              className="cursor-pointer"
              id={`${integration.id}-${tool.name}`}
              onCheckedChange={handleCheckboxChange}
            />
          </label>
        );
      })}
    </div>
  );
}
