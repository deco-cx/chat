import type { Integration, MCPTool } from "@deco/sdk";
import { useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import * as React from "react";
import { useCallback, useState } from "react";
import { IntegrationHeader } from "./header.tsx";

interface IntegrationProps {
  integration: Integration;
  enabledTools: string[];
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  savedTools?: string[];
}

/**
 * Returns the count of differences between two toolsets.
 */
export function getDiffCount(
  t0: Record<string, string[]>,
  t1: Record<string, string[]>,
) {
  let count = 0;
  for (const [i0, t0Tools] of Object.entries(t0)) {
    const t1Tools = t1[i0] ?? [];
    count += t0Tools.filter((tool) => !t1Tools.includes(tool)).length;
  }
  for (const [i1, t1Tools] of Object.entries(t1)) {
    const t0Tools = t0[i1] ?? [];
    count += t1Tools.filter((tool) => !t0Tools.includes(tool)).length;
  }
  return count;
}

interface ToolRowProps {
  tool: MCPTool;
  integrationId: string;
  isEnabled: boolean;
  wasSaved: boolean;
  onRemove: (toolName: string) => void;
}

/**
 * Renders a single tool row, with removal button if enabled.
 */
export const ToolRow = React.memo(function ToolRow({
  tool,
  integrationId,
  isEnabled,
  wasSaved,
  onRemove,
}: ToolRowProps) {
  // Show row only if enabled or was previously saved
  if (!isEnabled && !wasSaved) return null;
  // If the tool was saved but is now disabled, mark as pending removal
  const hasPendingRemoval = !isEnabled && wasSaved;
  return (
    <div
      key={`${integrationId}-${tool.name}`}
      className={cn(
        "group flex items-center gap-2 pl-2 rounded-md hover:bg-accent/50 transition-colors max-w-full relative h-10",
      )}
    >
      <Icon
        name="build"
        filled
        size={16}
        className={cn(
          "text-muted-foreground",
          hasPendingRemoval && "text-slate-400",
        )}
      />
      <span
        className={cn(
          "text-xs truncate flex-1 min-w-0",
          hasPendingRemoval && "line-through text-slate-400",
        )}
      >
        {tool.name}
      </span>
      {isEnabled && (
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-transparent"
          aria-label={`Remove ${tool.name}`}
          onClick={() => onRemove(tool.name)}
          tabIndex={-1}
        >
          <Icon name="close" size={16} />
        </Button>
      )}
    </div>
  );
});

interface ToolListProps {
  tools: MCPTool[];
  integrationId: string;
  enabledTools: string[];
  savedTools: string[];
  onRemove: (toolName: string) => void;
}

/**
 * Renders the list of tools for an integration.
 */
export function ToolList({
  tools,
  integrationId,
  enabledTools,
  savedTools,
  onRemove,
}: ToolListProps) {
  return (
    <div className="max-w-full p-2 pt-0">
      {tools.map((tool) => (
        <ToolRow
          key={tool.name}
          tool={tool}
          integrationId={integrationId}
          isEnabled={enabledTools.includes(tool.name)}
          wasSaved={savedTools.includes(tool.name)}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

/**
 * Renders an integration card with its tools, loading, and error states.
 */
export function Integration({
  integration,
  enabledTools,
  setIntegrationTools,
  savedTools = [],
}: IntegrationProps) {
  const { data: toolsData, error, isLoading } = useTools(
    integration.connection,
  );
  const [isExpanded, setIsExpanded] = useState(false);

  // Handles toggling a tool's enabled state
  const handleToolToggle = useCallback((toolId: string, checked: boolean) => {
    const updatedTools = checked
      ? [...enabledTools, toolId]
      : enabledTools.filter((tool) => tool !== toolId);
    setIntegrationTools(integration.id, updatedTools);
  }, [enabledTools, integration.id, setIntegrationTools]);

  // Loading state
  if (isLoading) {
    return (
      <div className="rounded-lg border bg-gradient-to-b from-white to-slate-50">
        <IntegrationHeader.Skeleton
          isExpanded={isExpanded}
          setIsExpanded={setIsExpanded}
        />
        <div className="border-t p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start space-x-3">
              <Skeleton className="h-4 w-4" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50">
        <IntegrationHeader.Error
          integration={integration}
          setIsExpanded={setIsExpanded}
          isExpanded={isExpanded}
        />
        {isExpanded && (
          <div className="border-red-300 p-4">
            <div className="flex items-center space-x-2 text-red-400">
              <Icon name="cancel" />
              <p className="text-xs">
                Failed to load tools for{" "}
                {integration.name}. Please try again later.
              </p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Main integration card
  return (
    <div className="rounded-lg border border-slate-200">
      <IntegrationHeader
        integration={integration}
        tools={toolsData?.tools?.map((tool: MCPTool) => tool.name) ?? []}
        enabledTools={enabledTools}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
      />
      {isExpanded && toolsData?.tools && (
        <div className="overflow-hidden">
          <ToolList
            tools={toolsData.tools}
            integrationId={integration.id}
            enabledTools={enabledTools}
            savedTools={savedTools}
            onRemove={(toolName) => handleToolToggle(toolName, false)}
          />
        </div>
      )}
    </div>
  );
}
