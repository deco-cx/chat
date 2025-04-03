import type { useTools } from "@deco/sdk/hooks";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";

export function ConnStatus({ tools }: { tools: ReturnType<typeof useTools> }) {
  const colors = tools.loading
    ? "text-gray-500 border-gray-500 hover:text-gray-500"
    : tools.error
    ? "text-red-500 border-red-500 hover:text-red-500"
    : "text-green-500 border-green-500 hover:text-green-500";

  return (
    <Tooltip>
      <TooltipTrigger
        asChild
      >
        <Button
          onClick={() => tools.refresh()}
          disabled={tools.loading}
          variant="outline"
          className={cn("gap-2", colors)}
        >
          Refresh
          <Icon
            className={cn(colors, tools.loading && "animate-pulse")}
            name="adjust"
          />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {tools.loading
          ? "Connecting..."
          : tools.data
          ? "Connected"
          : "Disconnected"}
      </TooltipContent>
    </Tooltip>
  );
}
