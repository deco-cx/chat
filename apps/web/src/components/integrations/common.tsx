import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useFile } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Avatar } from "../common/avatar/index.tsx";
import { Suspense } from "react";
import { isFilePath } from "../../utils/path.ts";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { isWellKnownApp } from "./apps.ts";

function FileIcon({ path, fallback, className, variant }: {
  path: string;
  fallback: React.ReactNode;
  className?: string;
  variant: "default" | "small";
}) {
  const { data: fileUrl } = useFile(path);

  if (variant === "small") {
    return (
      <Suspense
        fallback={
          <Skeleton
            className={cn(
              "rounded-xl w-16 h-16 border border-border",
            )}
          />
        }
      >
        <div className="relative w-full h-full">
          <Avatar
            url={typeof fileUrl === "string" ? fileUrl : undefined}
            fallback={fallback}
            fallbackClassName="!bg-transparent"
            className={cn(
              "w-full h-full rounded-none",
              className,
            )}
            objectFit="contain"
          />
        </div>
      </Suspense>
    );
  }

  return (
    <Suspense
      fallback={
        <Skeleton
          className={cn(
            "rounded-2xl w-16 h-16 border border-border",
          )}
        />
      }
    >
      <div
        className={cn(
          "rounded-2xl relative flex items-center justify-center p-2 h-16 w-16",
          "before:content-[''] before:absolute before:inset-0 before:rounded-2xl before:p-[1px] before:bg-gradient-to-t before:from-border before:to-border/50",
          "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)]",
          className,
        )}
      >
        <Avatar
          url={typeof fileUrl === "string" ? fileUrl : undefined}
          fallback={fallback}
          fallbackClassName="!bg-transparent"
          className="w-full h-full rounded-lg"
          objectFit="contain"
        />
      </div>
    </Suspense>
  );
}

function IntegrationIconContent(
  { icon, className, variant = "default" }: Props,
) {
  const fallback = (
    <Icon name="conversion_path" className="text-muted-foreground" />
  );

  if (icon && isFilePath(icon)) {
    return (
      <FileIcon
        path={icon}
        fallback={fallback}
        className={className}
        variant={variant}
      />
    );
  }

  if (variant === "small") {
    return (
      <div
        className={cn(
          "w-full h-full flex items-center justify-center",
          className,
        )}
      >
        {icon
          ? (
            <Avatar
              url={icon}
              fallback={fallback}
              fallbackClassName="!bg-transparent"
              className={cn(
                "w-full h-full rounded-none",
                className,
              )}
              objectFit="contain"
            />
          )
          : fallback}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl relative flex items-center justify-center p-2 h-16 w-16",
        "before:content-[''] before:absolute before:inset-0 before:rounded-xl before:p-[1px] before:bg-gradient-to-t before:from-border before:to-border/50",
        "before:![mask:linear-gradient(#000_0_0)_exclude_content-box,_linear-gradient(#000_0_0)] overflow-hidden",
        className,
      )}
    >
      {icon
        ? (
          <Avatar
            url={icon}
            fallback={fallback}
            fallbackClassName="!bg-transparent"
            className="w-full h-full rounded-none"
            objectFit="contain"
          />
        )
        : fallback}
    </div>
  );
}

export interface Props {
  id?: string;
  icon?: string;
  name: string;
  className?: string;
  variant?: "default" | "small";
}

export function IntegrationIcon(props: Props) {
  const isWellKnown = props.id ? isWellKnownApp(props.id) : false;

  return (
    <Suspense
      fallback={
        <Skeleton
          className={cn(
            "rounded-xl w-16 h-16 border border-border",
            props.variant === "default" ? "p-2" : "",
            props.className,
          )}
        />
      }
    >
      <IntegrationIconContent
        {...props}
        className={cn(props.className, isWellKnown ? "rounded-xl p-0" : "")}
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
      <TooltipContent side="bottom">
        Verified connection
      </TooltipContent>
    </Tooltip>
  );
}
