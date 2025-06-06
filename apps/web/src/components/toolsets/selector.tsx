import { type Integration, MCPTool, useTools } from "@deco/sdk";
import { useProfile } from "@deco/sdk/hooks";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { IntegrationIcon } from "../integrations/list/common.tsx";
import { ExpandableDescription } from "./description.tsx";

interface ToolsMap {
  [integrationId: string]: string[];
}

function IntegrationListItem({
  integration,
  toolsSet,
  setIntegrationTools,
}: {
  integration: Integration;
  toolsSet: ToolsMap;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  const [openTools, setOpenTools] = useState(false);
  const { data: toolsData, isLoading } = useTools(integration.connection);
  const navigateWorkspace = useNavigateWorkspace();

  const total = toolsData?.tools?.length ?? 0;
  const enabled = new Set([
    ...(toolsSet[integration.id] || []),
  ]).size;

  const allTools = toolsData?.tools || [];
  const enabledCount =
    allTools.filter((tool) => toolsSet[integration.id]?.includes(tool.name))
      .length;
  const isAll = enabledCount > 0;
  const isEmpty = !isLoading && allTools.length === 0;

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
      <label
        htmlFor={`select-all-${integration.id}`}
        className={cn(
          "flex gap-4 px-4 py-4 rounded-t-xl",
          !isEmpty && "hover:bg-muted cursor-pointer",
        )}
      >
        <div className="flex gap-4 items-start justify-between w-full">
          <div className="p-1 rounded-xl border border-border">
            <IntegrationIcon
              icon={integration.icon}
              name={integration.name}
              variant="small"
              className="h-9 w-9 p-0 rounded-lg"
            />
          </div>
          <div className="flex flex-col gap-1 w-full">
            <span className="text-sm font-semibold text-left truncate">
              {integration.name}
            </span>
            {integration.description && (
              <p className="text-sm text-muted-foreground">
                {integration.description}
              </p>
            )}
          </div>
          {!isEmpty && (
            <div>
              <Checkbox
                id={`select-all-${integration.id}`}
                className="cursor-pointer"
                checked={isAll}
                onCheckedChange={handleAll}
              />
            </div>
          )}
        </div>
      </label>
      <div className="absolute right-4 top-4 text-muted-foreground lg:hidden">
        <Icon name="chevron_right" size={16} />
      </div>
      {isEmpty && (
        <div
          onClick={(e) => {
            e.preventDefault();
            navigateWorkspace(`/integration/${integration.id}`);
          }}
          className={cn(
            "flex gap-2 items-center justify-between px-4 py-4 border-t border-border cursor-pointer",
            "hover:bg-muted rounded-b-xl",
          )}
        >
          <div className="flex gap-2 items-center">
            <Icon name="settings" size={16} />
            <span className="text-xs font-medium">Setup Integration</span>
          </div>
          <Badge variant="destructive">
            <Icon name="error" size={10} />
            Error
          </Badge>
        </div>
      )}
      {!isEmpty && (
        <div
          className={cn(
            "flex flex-col items-start gap-1 min-w-0 border-t border-border cursor-pointer",
            !openTools && "hover:bg-muted rounded-b-xl",
          )}
        >
          <span
            onClick={() => setOpenTools(!openTools)}
            className={cn(
              "text-muted-foreground text-sm py-4 w-full hover:bg-muted px-4",
              !openTools && "rounded-b-xl",
            )}
          >
            {isLoading
              ? (
                "Loading tools..."
              )
              : (
                <div className="flex items-center gap-4 text-foreground">
                  <Icon
                    name="chevron_right"
                    filled
                    size={14}
                    className={cn(
                      "inline-block mr-1 align-text-bottom",
                      openTools && "rotate-90",
                    )}
                  />
                  {`${enabled} of ${total} tools enabled`}
                </div>
              )}
          </span>
          {openTools && (
            <ToolList
              className="px-4"
              integration={integration}
              toolsSet={toolsSet}
              isLoading={isLoading}
              allTools={allTools}
              setIntegrationTools={setIntegrationTools}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function IntegrationList({
  integrations,
  toolsSet,
  setIntegrationTools,
}: {
  integrations: Integration[];
  toolsSet: ToolsMap;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {integrations.map((integration) => (
        <IntegrationListItem
          key={integration.id}
          integration={integration}
          toolsSet={toolsSet}
          setIntegrationTools={setIntegrationTools}
        />
      ))}
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
  allTools,
  setIntegrationTools,
}: {
  integration: Integration;
  toolsSet: ToolsMap;
  isLoading: boolean;
  allTools: MCPTool[];
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  className?: string;
}) {
  const { data: profile } = useProfile();
  const filteredTools = allTools.filter((tool) =>
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
    <div className={cn("space-y-4 pt-2", className)}>
      <div className="space-y-2">
        <label
          className="flex items-start gap-3 p-4 hover:bg-muted rounded-xl cursor-pointer"
          htmlFor={`select-all-${integration.id}`}
        >
          <Checkbox
            checked={allTools.every((tool) =>
              toolsSet[integration.id]?.includes(tool.name)
            )}
            className="cursor-pointer"
            id={`select-all-${integration.id}`}
            onCheckedChange={(checked) => {
              setIntegrationTools(
                integration.id,
                checked ? allTools.map((tool) => tool.name) : [],
              );
            }}
          />
          <div className="flex flex-col min-w-0">
            <span className="text-sm truncate cursor-pointer text-foreground">
              Select All
            </span>
          </div>
        </label>
        {filteredTools?.map((tool) => {
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
              className="flex items-start gap-3 p-4 bg-muted/50 hover:bg-muted rounded-xl cursor-pointer"
              htmlFor={`${integration.id}-${tool.name}`}
            >
              <Checkbox
                checked={enabled}
                className="cursor-pointer"
                id={`${integration.id}-${tool.name}`}
                onCheckedChange={handleCheckboxChange}
              />
              <div className="flex flex-col min-w-0">
                <span
                  className={cn(
                    "text-sm truncate cursor-pointer text-foreground",
                    enabled && !enabled && "text-muted-foreground",
                  )}
                >
                  {beautifyToolName(tool.name)}
                </span>
                {tool.description && (
                  <ExpandableDescription description={tool.description} />
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
