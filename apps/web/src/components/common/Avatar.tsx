import type { Agent } from "@deco/sdk";
import {
  Avatar as AvatarUI,
  AvatarFallback,
  AvatarImage,
} from "@deco/ui/components/avatar.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type ReactNode, useMemo } from "react";

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

export interface AvatarProps {
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
   * Optional size override (defaults to the UI component's size)
   */
  size?: "sm" | "md" | "lg";
}

export function Avatar({
  url,
  fallback,
  className,
  size = "md",
}: AvatarProps) {
  // Calculate appropriate size class
  const sizeClass = useMemo(() => {
    switch (size) {
      case "sm":
        return "h-8 w-8";
      case "lg":
        return "h-12 w-12";
      case "md":
      default:
        return "h-10 w-10";
    }
  }, [size]);

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
    <AvatarUI className={cn(sizeClass, "rounded-2xl", className)}>
      {url && <AvatarImage src={url} alt="Avatar" />}
      <AvatarFallback className={cn(fallbackColor, "rounded-2xl")}>
        {fallbackContent}
      </AvatarFallback>
    </AvatarUI>
  );
}

export const AgentAvatar = (
  { agent, variant = "lg" }: { agent?: Agent; variant?: "xl" | "lg" },
) => {
  if (!agent || agent.name === "Anonymous") {
    return (
      <div
        className={cn(
          "w-full h-full bg-gradient-to-b from-white to-slate-200 flex items-center justify-center border border-slate-200 overflow-hidden",
          variant === "xl" && "rounded-xl",
          variant === "lg" && "rounded-lg",
        )}
      >
        <Icon
          filled
          name="domino_mask"
          className="text-slate-600"
          size={variant === "xl" ? 32 : 16}
        />
      </div>
    );
  }

  return (
    <Avatar
      url={agent.avatar && /^(data:)|(https?:)/.test(agent.avatar)
        ? agent.avatar
        : undefined}
      fallback={agent.avatar &&
          !/^(data:)|(https?:)/.test(agent.avatar)
        ? agent.avatar
        : agent.name.substring(0, 2)}
      size="sm"
      className={cn(
        "w-full h-full",
        variant === "xl" && "rounded-xl",
        variant === "lg" && "rounded-lg",
      )}
    />
  );
};
