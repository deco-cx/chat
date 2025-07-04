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
  "bg-gradient-to-br from-red-100 to-red-300 text-red-800 shadow-lg shadow-red-300/40 ring-1 ring-red-300/30",
  "bg-gradient-to-br from-green-100 to-green-300 text-green-800 shadow-lg shadow-green-300/40 ring-1 ring-green-300/30",
  "bg-gradient-to-br from-blue-100 to-blue-300 text-blue-800 shadow-lg shadow-blue-300/40 ring-1 ring-blue-300/30",
  "bg-gradient-to-br from-yellow-100 to-yellow-300 text-yellow-800 shadow-lg shadow-yellow-300/40 ring-1 ring-yellow-300/30",
  "bg-gradient-to-br from-purple-100 to-purple-300 text-purple-800 shadow-lg shadow-purple-300/40 ring-1 ring-purple-300/30",
  "bg-gradient-to-br from-pink-100 to-pink-300 text-pink-800 shadow-lg shadow-pink-300/40 ring-1 ring-pink-300/30",
  "bg-gradient-to-br from-indigo-100 to-indigo-300 text-indigo-800 shadow-lg shadow-indigo-300/40 ring-1 ring-indigo-300/30",
  "bg-gradient-to-br from-orange-100 to-orange-300 text-orange-800 shadow-lg shadow-orange-300/40 ring-1 ring-orange-300/30",
  "bg-gradient-to-br from-teal-100 to-teal-300 text-teal-800 shadow-lg shadow-teal-300/40 ring-1 ring-teal-300/30",
  "bg-gradient-to-br from-cyan-100 to-cyan-300 text-cyan-800 shadow-lg shadow-cyan-300/40 ring-1 ring-cyan-300/30",
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
  // Extract first letter from string fallback
  const fallbackContent = useMemo(() => {
    if (typeof fallback === "string") {
      return fallback.substring(0, 1).toUpperCase();
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

  // Determine font size based on avatar size
  const fontSize = useMemo(() => {
    if (!className) return "text-sm";
    
    // Extract size information from className
    if (className.includes("size-6") || className.includes("w-6") || className.includes("h-6")) {
      return "text-xs"; // 12px for 24px avatar
    }
    if (className.includes("size-8") || className.includes("w-8") || className.includes("h-8")) {
      return "text-sm"; // 14px for 32px avatar  
    }
    if (className.includes("size-10") || className.includes("w-10") || className.includes("h-10")) {
      return "text-base"; // 16px for 40px avatar
    }
    if (className.includes("w-24") || className.includes("h-24")) {
      return "text-2xl"; // 24px for 96px avatar
    }
    
    return "text-sm"; // default
  }, [className]);

  // Determine border radius based on avatar className
  const borderRadius = useMemo(() => {
    if (!className) return "rounded-lg";
    
    if (className.includes("rounded-full")) {
      return "rounded-full";
    }
    if (className.includes("rounded-xl")) {
      return "rounded-xl";
    }
    if (className.includes("rounded-lg")) {
      return "rounded-lg";
    }
    if (className.includes("rounded-md")) {
      return "rounded-md";
    }
    
    return "rounded-lg"; // default
  }, [className]);

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
        className={cn(fallbackColor, fontSize, borderRadius, "font-medium drop-shadow-lg", fallbackClassName)}
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
            "w-full h-full",
            className,
          )}
        />
      }
    >
      <Avatar
        url={typeof fileUrl === "string" ? fileUrl : undefined}
        fallback={name.substring(0, 1)}
        className={cn(
          "w-full h-full",
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
      fallback={name.substring(0, 1)}
      className={cn(
        "w-full h-full",
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
            "w-full h-full",
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
