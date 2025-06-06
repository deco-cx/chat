import { useIntegrations, useTools } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useMemo, useState } from "react";
import { formatToolName } from "../chat/utils/format-tool-name.ts";
import { IntegrationIcon } from "../integrations/common.tsx";
import type { Integration } from "@deco/sdk";
import type { MCPTool } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";

interface SingleToolSelectorProps {
  value: string | null;
  onChange: (value: string) => void;
}

interface IntegrationListProps {
  integrations: Integration[];
  isLoading: boolean;
  search: string;
  onSelect: (integration: Integration) => void;
}

function IntegrationList(
  { integrations, isLoading, search, onSelect }: IntegrationListProps,
) {
  const filtered = useMemo(
    () =>
      !search
        ? integrations
        : integrations.filter((integration) =>
          integration.name.toLowerCase().includes(search.toLowerCase())
        ),
    [integrations, search],
  );

  if (isLoading) {
    return (
      <div className="p-4 text-muted-foreground">Loading integrations...</div>
    );
  }
  if (filtered.length === 0) {
    return (
      <div className="p-4 text-muted-foreground">No integrations found.</div>
    );
  }
  return (
    <>
      {filtered.map((integration) => (
        <button
          type="button"
          key={integration.id}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-left cursor-pointer"
          onClick={() => onSelect(integration)}
        >
          <IntegrationIcon
            icon={integration.icon}
            name={integration.name}
            className="h-8 w-8 shrink-0"
          />
          <div className="flex flex-col min-w-0">
            <span className="font-medium truncate">{integration.name}</span>
            {integration.description && (
              <span className="text-xs text-muted-foreground truncate">
                {integration.description}
              </span>
            )}
          </div>
        </button>
      ))}
    </>
  );
}

interface ToolListProps {
  integration: Integration;
  value: string | null;
  search: string;
  onSelect: (tool: MCPTool) => void;
}

function ToolList({ integration, value, search, onSelect }: ToolListProps) {
  const { data: toolsData, isLoading } = useTools(
    integration.connection || { type: "HTTP", url: "" },
  );
  const filtered = useMemo(
    () =>
      !toolsData
        ? []
        : !search
        ? toolsData.tools
        : toolsData.tools.filter((tool) =>
          tool.name.toLowerCase().includes(search.toLowerCase()) ||
          (tool.description?.toLowerCase().includes(search.toLowerCase()) ??
            false)
        ),
    [toolsData, search],
  );

  return (
    <>
      {isLoading
        ? <div className="p-4 text-muted-foreground">Loading tools...</div>
        : filtered.length === 0
        ? <div className="p-4 text-muted-foreground">No tools found.</div>
        : (
          filtered.map((tool) => (
            <button
              type="button"
              key={tool.name}
              className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${
                value === `${integration.id}/${tool.name}` ? "bg-muted" : ""
              }`}
              onClick={() => onSelect(tool)}
            >
              <IntegrationIcon
                icon={integration.icon}
                name={integration.name}
                className="h-8 w-8 shrink-0"
              />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium truncate">
                  {integration.name} / {formatToolName(tool.name)}
                </span>
                {tool.description && (
                  <span className="text-xs text-muted-foreground truncate">
                    {tool.description}
                  </span>
                )}
              </div>
              {value === `${integration.id}/${tool.name}` && (
                <Icon
                  name="check"
                  size={18}
                  className="ml-auto text-muted-foreground"
                />
              )}
            </button>
          ))
        )}
    </>
  );
}

interface SelectorDialogProps {
  open: boolean;
  value: string | null;
  onClose: () => void;
  onChange: (value: string) => void;
}

function SelectorDialog(
  { open, value, onClose, onChange }: SelectorDialogProps,
) {
  const [search, setSearch] = useState("");
  const [selectedIntegration, setSelectedIntegration] = useState<
    Integration | null
  >(null);
  const { data: integrations = [], isLoading: isIntegrationsLoading } =
    useIntegrations();

  const handleDialogChange = (v: boolean) => {
    if (!v) {
      setSelectedIntegration(null);
      setSearch("");
      onClose();
    }
  };

  function handleToolSelect(tool: MCPTool) {
    if (!selectedIntegration) return;
    onChange(`${selectedIntegration.id}/${tool.name}`);
    setSelectedIntegration(null);
    setSearch("");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-md w-full p-0 gap-0">
        <DialogHeader>
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex flex-col gap-2">
              {selectedIntegration && (
                <button
                  type="button"
                  className="flex text-xs h-6 items-center gap-2 px-2 text-muted-foreground hover:text-foreground bg-muted/50 rounded-xl hover:bg-muted transition-colors"
                  onClick={() => {
                    setSelectedIntegration(null);
                    setSearch("");
                  }}
                >
                  <Icon name="arrow_back" size={18} />
                  Back to integrations
                </button>
              )}
              <span>Select a Tool</span>
            </div>
          </div>
        </DialogHeader>
        <div className="border-b border-border">
          <Input
            placeholder={selectedIntegration
              ? `Search ${selectedIntegration.name} tools...`
              : "Search integrations..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border-none focus-visible:ring-0 placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-96 overflow-y-auto">
          <div className="divide-y divide-border">
            {!selectedIntegration
              ? (
                <IntegrationList
                  integrations={integrations}
                  isLoading={isIntegrationsLoading}
                  search={search}
                  onSelect={(integration) => {
                    setSelectedIntegration(integration);
                    setSearch("");
                  }}
                />
              )
              : (
                <ToolList
                  integration={selectedIntegration}
                  value={value}
                  search={search}
                  onSelect={handleToolSelect}
                />
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SingleToolSelector(
  { value, onChange }: SingleToolSelectorProps,
) {
  const [open, setOpen] = useState(false);
  const { data: integrations = [] } = useIntegrations();

  const selected = useMemo(() => {
    if (!value) return null;
    const [integrationId, toolName] = value.split("/");
    const integration = integrations.find((i) => i.id === integrationId);
    return integration ? { integration, toolName } : null;
  }, [value, integrations]);

  return (
    <div className="max-w-[410px]">
      <Button
        type="button"
        variant="outline"
        className={cn("w-full justify-between truncate", {
          "px-1": selected,
        })}
        onClick={() => setOpen(true)}
      >
        {selected
          ? (
            <span className="flex items-center gap-2">
              <IntegrationIcon
                icon={selected.integration.icon}
                name={selected.integration.name}
                className="h-8 w-8"
              />
              <span className="truncate overflow-hidden whitespace-nowrap max-w-[350px]">
                {selected.integration.name} / {selected.toolName}
              </span>
            </span>
          )
          : <span className="text-muted-foreground">Select a tool...</span>}
        <Icon
          name="expand_more"
          size={18}
          className="ml-2 text-muted-foreground"
        />
      </Button>
      <SelectorDialog
        open={open}
        value={value}
        onClose={() => setOpen(false)}
        onChange={onChange}
      />
    </div>
  );
}
