import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense } from "react";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";

export interface IntegrationIconProps {
  icon?: string;
  name?: string;
  className?: string;
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
}

export function IntegrationIcon({
  icon,
  name,
  className,
  size = "base",
}: IntegrationIconProps) {
  return (
    <Suspense fallback={<Skeleton className={className} />}>
      <IntegrationAvatar
        url={icon}
        size={size}
        fallback={name}
        className={className}
      />
    </Suspense>
  );
}

export function VerifiedIntegrationBadge() {
  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          variant="outline"
          className="text-xs h-6 rounded-lg flex items-center gap-1 px-2 w-fit"
        >
          <Icon name="verified" size={16} />
          <span className="font-medium">deco.chat</span>
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom">Verified connection</TooltipContent>
    </Tooltip>
  );
}
