import {
  Avatar as AvatarUI,
  AvatarFallback,
  AvatarImage,
} from "@deco/ui/components/avatar.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type HTMLAttributes, type ReactNode, Suspense, useMemo } from "react";
import { useFile } from "@deco/sdk";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { isFilePath } from "../../../utils/path.ts";

// Predefined color palette for avatar backgrounds
const AVATAR_COLORS = [
  "bg-red-100 text-red-800",
  "bg-green-100 text-green-800",
  "bg-blue-100 text-blue-800",
  "bg-yellow-100 text-yellow-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-indigo-100 text-indigo-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
  "bg-cyan-100 text-cyan-800",
];

/**
 * Generate a deterministic color from a string
 * @param input The input string to generate a color from
 * @returns A CSS class string for background and text color
 */
function getColorFromString(input: string): string {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Get a positive index within the color array range
  const index = Math.abs(hash) % AVATAR_COLORS.length;

  return AVATAR_COLORS[index];
}

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The URL of the avatar image
   */
  url?: string;

  /**
   * Fallback text or element to display when the image is not available
   * If string is provided, it will use the first two characters (typically initials)
   */
  fallback: string | ReactNode;

  /**
   * Additional CSS classes to apply to the avatar
   */
  className?: string;

  /**
   * The object fit of the avatar image
   */
  objectFit?: "contain" | "cover";

  /**
   * Additional CSS classes to apply to the avatar fallback
   */
  fallbackClassName?: string;
}

export function Avatar({
  url,
  fallback,
  className,
  objectFit = "cover",
  fallbackClassName,
  ...props
}: AvatarProps) {
  // Extract initials from string fallback (first two characters)
  const fallbackContent = useMemo(() => {
    if (typeof fallback === "string") {
      return fallback.substring(0, 2).toUpperCase();
    }
    return fallback;
  }, [fallback]);

  // Get a deterministic color for the fallback based on the content
  const fallbackColor = useMemo(() => {
    if (typeof fallback === "string") {
      return getColorFromString(fallback);
    }
    // Default color if we can't determine a string value
    return AVATAR_COLORS[0];
  }, [fallback]);

  return (
    <AvatarUI className={cn(className)} {...props}>
      <AvatarImage
        src={url}
        alt="Avatar"
        className={cn(
          (objectFit === "contain" && url) ? "object-contain" : "object-cover",
        )}
      />
      <AvatarFallback
        className={cn(fallbackColor, "rounded-lg", fallbackClassName)}
      >
        {fallbackContent}
      </AvatarFallback>
    </AvatarUI>
  );
}

function FileAvatar(
  { path, name, className }: { path: string; name: string; className?: string },
) {
  const { data: fileUrl } = useFile(path);

  return (
    <Suspense
      fallback={
        <Skeleton
          className={cn(
            "w-full h-full rounded-lg",
            className,
          )}
        />
      }
    >
      <Avatar
        url={typeof fileUrl === "string" ? fileUrl : undefined}
        fallback={name.substring(0, 2)}
        className={cn(
          "w-full h-full rounded-lg",
          className,
        )}
      />
    </Suspense>
  );
}

function AgentAvatarContent(
  { name, avatar, className }: {
    name?: string;
    avatar?: string;
    className?: string;
  },
) {
  if (avatar && isFilePath(avatar)) {
    return (
      <FileAvatar
        path={avatar}
        name={name ?? "Unknown"}
        className={className}
      />
    );
  }

  if (!name || name === "Anonymous") {
    return (
      <div
        className={cn(
          "w-full h-full bg-gradient-to-b from-white to-muted flex items-center justify-center border border-border overflow-hidden",
          className,
        )}
      >
        <Icon
          filled
          name="robot_2"
          className="text-muted-foreground"
        />
      </div>
    );
  }
  return (
    <Avatar
      url={avatar}
      fallback={name.substring(0, 2)}
      className={cn(
        "w-full h-full rounded-lg",
        className,
      )}
    />
  );
}

export const AgentAvatar = (
  { name, avatar, className }: {
    name?: string;
    avatar?: string;
    className?: string;
  },
) => {
  return (
    <Suspense
      fallback={
        <Skeleton
          className={cn(
            "w-full h-full rounded-lg",
            className,
          )}
        />
      }
    >
      <AgentAvatarContent
        name={name}
        avatar={avatar}
        className={className}
      />
    </Suspense>
  );
};
