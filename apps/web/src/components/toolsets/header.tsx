import type { Integration } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { IntegrationIcon } from "../integrations/common.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Button } from "@deco/ui/components/button.tsx";
export function IntegrationHeader({
  integration,
  enabledTools,
  variant = "default",
}: {
  integration: Integration;
  tools: string[];
  enabledTools: string[];
  variant?: "error" | "default";
}) {
  const numberOfEnabledTools = enabledTools.length;
  const navigateWorkspace = useNavigateWorkspace();

  return (
    <div className="w-full px-4 py-[10px]">
      <div className="flex w-full items-center justify-between gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <IntegrationIcon
            icon={integration.icon}
            name={integration.name}
            className="h-5 w-5 rounded !border-none p-0"
          />
          <div className="font-medium text-sm text-foreground truncate">
            {integration?.name}
          </div>
          {numberOfEnabledTools > 0 && (
            <span className="text-xs text-muted-foreground">
              {numberOfEnabledTools} tools
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {variant === "error" && (
            <div className="flex items-center gap-2 bg-destructive/10 rounded-full px-2 py-1 text-xs">
              <Icon
                name="warning"
                filled
                className="text-xs text-destructive"
                size={16}
              />
              <span className="text-xs text-destructive">
                Failed to load tools
              </span>
            </div>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  navigateWorkspace(`/integration/${integration.id}`);
                }}
                className="h-6 w-6 rounded hover:bg-muted transition-colors"
                aria-label="Manage Integration"
              >
                <Icon name="settings" className=" text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Manage Integration</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

IntegrationHeader.Skeleton = () => (
  <div className="w-full p-4">
    <div className="flex w-full items-center justify-between gap-2">
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
  </div>
);
