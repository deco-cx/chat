import type { Integration } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import * as React from "react";
import { IntegrationIcon } from "./icon.tsx";
export function IntegrationHeader({
  integration,
  tools,
  enabledTools,
  isExpanded,
  setIsExpanded,
}: {
  integration: Integration;
  tools: string[];
  enabledTools: string[];
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
}) {
  const numberOfEnabledTools = enabledTools.length;

  return (
    <div
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full px-4 py-[10px] cursor-pointer transition-colors"
    >
      <div className="flex w-full items-center gap-2 min-w-0">
        <Icon
          name="chevron_right"
          className={cn(
            "text-slate-700 transition-transform cursor-pointer",
            isExpanded ? "rotate-90" : "",
          )}
        />
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <IntegrationIcon
            icon={integration.icon}
            name={integration.name}
            className="h-4 w-4 rounded border-none"
          />
          <div className="font-medium text-sm text-slate-700 truncate">
            {integration?.name}
          </div>
          <span className="text-xs text-slate-400">
            {numberOfEnabledTools} tools
          </span>
        </div>
      </div>
    </div>
  );
}

IntegrationHeader.Skeleton = ({
  isExpanded,
  setIsExpanded,
}: {
  isExpanded: boolean;
  setIsExpanded: (isExpanded: boolean) => void;
}) => (
  <button
    type="button"
    onClick={() => setIsExpanded(!isExpanded)}
    className="w-full p-4 hover:bg-accent/50 transition-colors"
  >
    <div className="flex w-full items-center justify-between gap-2">
      <Icon
        name="chevron_right"
        className={cn(
          "text-muted-foreground transition-transform",
          isExpanded ? "rotate-90" : "",
        )}
      />
      <div className="flex items-center gap-2 flex-grow">
        <Skeleton className="h-6 w-6 rounded-md" />
        <Skeleton className="h-5 w-32" />
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  </button>
);

IntegrationHeader.Error = ({
  integration,
  setIsExpanded,
  isExpanded,
}: {
  integration: Integration;
  setIsExpanded: (isExpanded: boolean) => void;
  isExpanded: boolean;
}) => (
  <button
    type="button"
    onClick={() => setIsExpanded(!isExpanded)}
    className="w-full p-4 hover:bg-red-100/50 transition-colors"
  >
    <div className="flex w-full items-center justify-between gap-2">
      <Icon
        name="chevron_right"
        className={cn(
          "text-muted-foreground transition-transform",
          isExpanded ? "rotate-90" : "",
        )}
      />
      <div className="flex items-center gap-2 flex-grow">
        <IntegrationIcon icon={integration.icon} name={integration.name} />
        <h3 className="font-medium text-base">{integration.name}</h3>
      </div>

      <div className="flex items-center gap-2">
        <Icon name="cancel" className="text-xs text-red-500" size={16} />
        <span className="text-sm text-red-500">Error</span>
      </div>
    </div>
  </button>
);
