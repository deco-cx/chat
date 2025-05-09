import { type Integration, useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Dialog, DialogContent } from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { IntegrationIcon } from "../integrations/list/common.tsx";
import { ExpandableDescription } from "./description.tsx";

// Types
type ToolsMap = Record<string, string[]>;
type SelectedToolsMap = Record<string, Set<string>>;

interface ToolsetSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installedIntegrations: Integration[];
  toolsSet: ToolsMap;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  initialSelectedIntegration?: string | null;
}

// Hooks
function useToolsetState(toolsSet: ToolsMap, open: boolean) {
  const [selectedTools, setSelectedTools] = useState<SelectedToolsMap>({});

  useEffect(() => {
    if (!open) {
      setSelectedTools({});
      return;
    }

    const initialSelectedTools: SelectedToolsMap = {};
    Object.entries(toolsSet).forEach(([integrationId, tools]) => {
      initialSelectedTools[integrationId] = new Set(tools);
    });
    setSelectedTools(initialSelectedTools);
  }, [open, toolsSet]);

  const handleToolToggle = (
    integrationId: string,
    toolName: string,
    checked: boolean,
  ) => {
    setSelectedTools((prev) => {
      const newSelected = { ...prev };
      if (!newSelected[integrationId]) {
        newSelected[integrationId] = new Set(toolsSet[integrationId] || []);
      }

      if (checked) {
        newSelected[integrationId].add(toolName);
      } else {
        newSelected[integrationId].delete(toolName);
      }

      return newSelected;
    });
  };

  return { selectedTools, handleToolToggle };
}

// Components
function IntegrationItem({
  integration,
  isSelected,
  onClick,
  toolsSet,
  selectedTools,
}: {
  integration: Integration;
  isSelected: boolean;
  onClick: () => void;
  toolsSet: ToolsMap;
  selectedTools: SelectedToolsMap;
}) {
  const { data: toolsData, isLoading } = useTools(integration.connection);

  const toolsCount = useMemo(() => toolsData?.tools?.length ?? 0, [toolsData]);

  const enabledToolsCount = useMemo(() => {
    const enabledTools = toolsSet[integration.id] || [];
    const selectedToolsForIntegration = selectedTools[integration.id]
      ? Array.from(selectedTools[integration.id])
      : [];
    return new Set([...enabledTools, ...selectedToolsForIntegration]).size;
  }, [integration.id, toolsSet, selectedTools]);

  return (
    <div
      onClick={onClick}
      className={cn(
        "w-full flex flex-col gap-2 px-3 py-2 rounded-lg transition-colors cursor-pointer",
        "hover:bg-slate-50",
        isSelected && "bg-slate-100",
      )}
    >
      <div className="flex items-center gap-3">
        <IntegrationIcon
          icon={integration.icon}
          name={integration.name}
          className="h-12 w-12"
        />
        <div className="flex flex-col items-start gap-1 min-w-0">
          <span className="font-medium text-left truncate">
            {integration.name}
          </span>
          <span className="text-slate-500 text-sm">
            {isLoading
              ? "Loading tools..."
              : `${enabledToolsCount} of ${toolsCount} tools enabled`}
          </span>
        </div>
      </div>
    </div>
  );
}

function ToolsList({
  integration,
  selectedTools,
  toolsSet,
  onToolToggle,
}: {
  integration: Integration;
  selectedTools: SelectedToolsMap;
  toolsSet: ToolsMap;
  onToolToggle: (
    integrationId: string,
    toolName: string,
    checked: boolean,
  ) => void;
}) {
  const { data: toolsData, isLoading } = useTools(integration.connection);

  const isToolEnabled = (toolName: string) =>
    toolsSet[integration.id]?.includes(toolName) ?? false;

  const isToolSelected = (toolName: string) =>
    selectedTools[integration.id]?.has(toolName) ?? isToolEnabled(toolName);

  const handleSelectAll = (checked: boolean) => {
    toolsData?.tools?.forEach((tool) => {
      onToolToggle(integration.id, tool.name, checked);
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-6 bg-slate-100 animate-pulse rounded" />
        ))}
      </div>
    );
  }

  const allTools = toolsData?.tools || [];
  const enabledCount =
    allTools.filter((tool) => isToolSelected(tool.name)).length;
  const isAllSelected = enabledCount === allTools.length && allTools.length > 0;
  const isPartiallySelected = enabledCount > 0 && !isAllSelected;

  return (
    <div className="space-y-4">
      {allTools.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all"
              checked={isAllSelected}
              data-state={isPartiallySelected ? "indeterminate" : undefined}
              onCheckedChange={handleSelectAll}
            />
            <label
              htmlFor="select-all"
              className="text-sm font-medium cursor-pointer text-slate-700"
            >
              {isAllSelected ? "Deselect all" : "Select all"}
            </label>
          </div>
          <span className="text-sm text-slate-500">
            {enabledCount} of {allTools.length} tools selected
          </span>
        </div>
      )}
      <div className="space-y-2">
        {allTools.map((tool) => (
          <div
            key={tool.name}
            className="flex items-start gap-3 py-2 px-3 hover:bg-slate-50 border border-slate-200 rounded-lg"
          >
            <Checkbox
              id={`${integration.id}-${tool.name}`}
              checked={isToolSelected(tool.name)}
              onCheckedChange={(checked) =>
                onToolToggle(integration.id, tool.name, !!checked)}
              className="mt-1"
            />
            <div className="flex flex-col min-w-0">
              <label
                htmlFor={`${integration.id}-${tool.name}`}
                className={cn(
                  "text-sm truncate cursor-pointer text-slate-700",
                  isToolEnabled(tool.name) && !isToolSelected(tool.name) &&
                    "text-slate-400",
                )}
              >
                {tool.name}
              </label>
              {tool.description && (
                <ExpandableDescription description={tool.description} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ToolsetSelector({
  open,
  onOpenChange,
  installedIntegrations,
  toolsSet,
  setIntegrationTools,
  initialSelectedIntegration,
}: ToolsetSelectorProps) {
  const [search, setSearch] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<string | null>(
    null,
  );
  const selectedItemRef = useRef<HTMLDivElement>(null);

  const { selectedTools, handleToolToggle } = useToolsetState(toolsSet, open);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setSelectedIntegration(null);
      setSearch("");
    }
  }, [open]);

  // Handle initial integration selection
  useEffect(() => {
    if (!open) return;

    if (initialSelectedIntegration) {
      setSelectedIntegration(initialSelectedIntegration);
      setTimeout(() => {
        selectedItemRef.current?.scrollIntoView({ block: "center" });
      }, 100);
    } else if (!selectedIntegration && installedIntegrations.length > 0) {
      setSelectedIntegration(installedIntegrations[0].id);
    }
  }, [
    open,
    initialSelectedIntegration,
    installedIntegrations,
    selectedIntegration,
  ]);

  const handleAddTools = () => {
    Object.entries(selectedTools).forEach(([integrationId, toolSet]) => {
      setIntegrationTools(integrationId, Array.from(toolSet));
    });
    onOpenChange(false);
  };

  const filteredIntegrations = installedIntegrations.filter((integration) =>
    integration.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedIntegrationData = installedIntegrations.find(
    (integration) => integration.id === selectedIntegration,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-full max-w-full md:h-auto md:max-w-[800px] w-full p-0 gap-0 flex flex-col border-none rounded-none md:rounded-lg">
        <div className="flex flex-col">
          <div className="p-2 border-b border-slate-200">
            <div className="bg-slate-100 rounded-lg px-4 py-2 text-slate-700 font-normal text-sm inline-block">
              Available Tools
            </div>
          </div>

          <div className="border-b border-slate-200">
            <Input
              placeholder="Search integrations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-none border-none focus-visible:ring-0 placeholder:text-slate-500"
            />
          </div>

          <div className="flex gap-6 p-4 h-[400px] overflow-hidden">
            <div className="w-[280px] flex-shrink-0 truncate">
              <ScrollArea>
                <div className="space-y-1">
                  {filteredIntegrations.map((integration) => (
                    <div
                      key={integration.id}
                      ref={selectedIntegration === integration.id
                        ? selectedItemRef
                        : null}
                    >
                      <IntegrationItem
                        integration={integration}
                        isSelected={selectedIntegration === integration.id}
                        onClick={() => setSelectedIntegration(integration.id)}
                        toolsSet={toolsSet}
                        selectedTools={selectedTools}
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex-1 min-w-0">
              <ScrollArea className="h-full">
                {selectedIntegrationData && (
                  <ToolsList
                    integration={selectedIntegrationData}
                    selectedTools={selectedTools}
                    toolsSet={toolsSet}
                    onToolToggle={handleToolToggle}
                  />
                )}
              </ScrollArea>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t mt-auto">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAddTools}
            className="bg-slate-700 hover:bg-slate-600 rounded-lg font-normal"
            disabled={Object.keys(selectedTools).length === 0}
          >
            Update tools
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
