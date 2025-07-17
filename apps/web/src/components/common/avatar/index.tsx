import {
  AvatarFallback,
  AvatarImage,
  Avatar as AvatarUI,
} from "@deco/ui/components/avatar.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes, type ReactNode, useMemo } from "react";

// Predefined color palette for avatar backgrounds with gradients and shadows
const AVATAR_COLORS = [
  "drop-shadow-lg bg-gradient-to-br from-red-100 to-red-300 text-red-800 shadow-lg shadow-red-300/40 ring-1 ring-red-300/30",
  "drop-shadow-lg bg-gradient-to-br from-lime-100 to-lime-300 text-lime-800 shadow-lg shadow-lime-300/40 ring-1 ring-lime-300/30",
  "drop-shadow-lg bg-gradient-to-br from-emerald-100 to-emerald-300 text-emerald-800 shadow-lg shadow-emerald-300/40 ring-1 ring-emerald-300/30",
  "drop-shadow-lg bg-gradient-to-br from-orange-100 to-orange-300 text-orange-800 shadow-lg shadow-orange-300/40 ring-1 ring-orange-300/30",
  "drop-shadow-lg bg-gradient-to-br from-amber-100 to-amber-300 text-amber-800 shadow-lg shadow-amber-300/40 ring-1 ring-amber-300/30",
  "drop-shadow-lg bg-gradient-to-br from-yellow-100 to-yellow-300 text-yellow-800 shadow-lg shadow-yellow-300/40 ring-1 ring-yellow-300/30",
  "drop-shadow-lg bg-gradient-to-br from-green-100 to-green-300 text-green-800 shadow-lg shadow-green-300/40 ring-1 ring-green-300/30",
  "drop-shadow-lg bg-gradient-to-br from-teal-100 to-teal-300 text-teal-800 shadow-lg shadow-teal-300/40 ring-1 ring-teal-300/30",
  "drop-shadow-lg bg-gradient-to-br from-cyan-100 to-cyan-300 text-cyan-800 shadow-lg shadow-cyan-300/40 ring-1 ring-cyan-300/30",
  "drop-shadow-lg bg-gradient-to-br from-sky-100 to-sky-300 text-sky-800 shadow-lg shadow-sky-300/40 ring-1 ring-sky-300/30",
  "drop-shadow-lg bg-gradient-to-br from-blue-100 to-blue-300 text-blue-800 shadow-lg shadow-blue-300/40 ring-1 ring-blue-300/30",
  "drop-shadow-lg bg-gradient-to-br from-indigo-100 to-indigo-300 text-indigo-800 shadow-lg shadow-indigo-300/40 ring-1 ring-indigo-300/30",
  "drop-shadow-lg bg-gradient-to-br from-violet-100 to-violet-300 text-violet-800 shadow-lg shadow-violet-300/40 ring-1 ring-violet-300/30",
  "drop-shadow-lg bg-gradient-to-br from-purple-100 to-purple-300 text-purple-800 shadow-lg shadow-purple-300/40 ring-1 ring-purple-300/30",
  "drop-shadow-lg bg-gradient-to-br from-fuchsia-100 to-fuchsia-300 text-fuchsia-800 shadow-lg shadow-fuchsia-300/40 ring-1 ring-fuchsia-300/30",
  "drop-shadow-lg bg-gradient-to-br from-pink-100 to-pink-300 text-pink-800 shadow-lg shadow-pink-300/40 ring-1 ring-pink-300/30",
  "drop-shadow-lg bg-gradient-to-br from-rose-100 to-rose-300 text-rose-800 shadow-lg shadow-rose-300/40 ring-1 ring-rose-300/30",
];

const MUTED_COLOR = "drop-shadow-lg text-muted-foreground bg-muted shadow-lg";

/**
 * Generate a deterministic color from a string
 */
function getColorFromString(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

// Unified avatar variants with shape and size
const avatarVariants = cva("border border-border", {
  variants: {
    shape: {
      circle: "rounded-full",
      square: "",
    },
    size: {
      xs: "w-6 h-6 text-sm font-semibold",
      sm: "w-8 h-8 text-lg font-semibold",
      base: "w-10 h-10 text-2xl font-semibold",
      lg: "w-12 h-12 text-3xl font-semibold",
      xl: "w-16 h-16 text-4xl font-semibold",
      "2xl": "w-20 h-20 text-5xl font-semibold",
      "3xl": "w-32 h-32 text-7xl font-semibold",
    },
  },
  compoundVariants: [
    // Square avatar roundedness based on size
    { shape: "square", size: "xs", class: "rounded-lg" },
    { shape: "square", size: "sm", class: "rounded-xl" },
    { shape: "square", size: "base", class: "rounded-xl" },
    { shape: "square", size: "lg", class: "rounded-2xl" },
    { shape: "square", size: "xl", class: "rounded-2xl" },
    { shape: "square", size: "2xl", class: "rounded-3xl" },
    { shape: "square", size: "3xl", class: "rounded-[40px]" },
  ],
  defaultVariants: {
    shape: "square",
    size: "base",
  },
});

// Image variants for object-fit
const avatarImageVariants = cva("", {
  variants: {
    objectFit: {
      contain: "object-contain",
      cover: "object-cover",
    },
  },
  defaultVariants: {
    objectFit: "cover",
  },
});

// Icon size mapping based on avatar size (in pixels)
const getIconSize = (size: string): number => {
  const iconSizes = {
    xs: 12, // 12px for 24px avatar
    sm: 16, // 16px for 32px avatar
    base: 24, // 24px for 40px avatar
    lg: 28, // 28px for 48px avatar
    xl: 36, // 36px for 64px avatar
    "2xl": 48, // 48px for 80px avatar
    "3xl": 80, // 80px for 128px avatar
  };
  return iconSizes[size as keyof typeof iconSizes] || iconSizes.base;
};

interface BaseAvatarProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * The URL of the avatar image
   */
  url?: string;
  /**
   * Fallback text or element to display when the image is not available
   * If string is provided, it will use the first character (typically first initial)
   */
  fallback: string | ReactNode;
  /**
   * The object fit of the avatar image
   */
  objectFit?: "contain" | "cover";
  /**
   * Additional CSS classes to apply to the avatar
   */
  className?: string;
  /**
   * Whether to use the muted color palette
   */
  muted?: boolean;
  /**
   * The shape of the avatar
   */
  shape?: "circle" | "square";
  /**
   * The size of the avatar
   */
  size?: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
}

/**
 * UnifiedAvatar - Handles both circle and square avatars with variants
 * Internal component - use Avatar with shape prop instead
 */
function UnifiedAvatar({
  url,
  fallback,
  shape = "square",
  size = "base",
  objectFit = "cover",
  className,
  muted = false,
  ...props
}: BaseAvatarProps) {
  const fallbackContent = useMemo(() => {
    if (typeof fallback === "string") {
      return fallback.substring(0, 1).toUpperCase();
    }
    return fallback;
  }, [fallback]);

  const fallbackColor = useMemo(() => {
    if (muted) {
      return MUTED_COLOR;
    }
    if (typeof fallback === "string") {
      return getColorFromString(fallback);
    }
    return AVATAR_COLORS[0];
  }, [fallback, muted]);

  const isIconUrl = url?.startsWith("icon://");
  const iconName = isIconUrl ? url?.replace("icon://", "") : undefined;

  return (
    <AvatarUI
      className={cn(avatarVariants({ shape, size }), className)}
      {...props}
    >
      {isIconUrl && iconName ? (
        <div
          className={cn(
            "flex items-center justify-center w-full h-full",
            fallbackColor,
          )}
        >
          <Icon name={iconName} size={getIconSize(size)} />
        </div>
      ) : (
        <>
          <AvatarImage
            src={url}
            alt="Avatar"
            className={cn(avatarImageVariants({ objectFit }))}
          />
          <AvatarFallback className={cn(fallbackColor, "rounded-none")}>
            {fallbackContent}
          </AvatarFallback>
        </>
      )}
    </AvatarUI>
  );
}

export type AvatarProps = VariantProps<typeof avatarVariants> & BaseAvatarProps;

/**
 * Avatar - Universal avatar component with shape variant
 *
 * @param shape - 'circle' for user profiles, 'square' for brands/agents (default: 'square')
 * @param size - Size variant (default: 'base')
 * @param url - Image URL or icon:// format
 * @param fallback - Fallback text or element when image fails to load
 * @param objectFit - How the image should fit within the container
 * @param className - Additional CSS classes
 * @param muted - Whether to use muted colors
 */
export function Avatar({
  shape = "square",
  size = "base",
  url,
  fallback,
  objectFit = "cover",
  className,
  muted = false,
  ...props
}: AvatarProps) {
  return (
    <UnifiedAvatar
      shape={shape}
      url={url}
      fallback={fallback}
      size={size ?? "base"}
      objectFit={objectFit}
      className={className}
      muted={muted}
      {...props}
    />
  );
}
