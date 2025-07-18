import { cn } from "@deco/ui/lib/utils.ts";
import type { HTMLAttributes } from "react";

export type IconVariant = "filled";

export interface Props extends HTMLAttributes<HTMLSpanElement> {
  /**
   * The name of the icon.
   */
  name: string;
  /**
   * Whether the icon is filled.
   */
  filled?: boolean;
  /**
   * The weight of the icon.
   */
  weight?: number;
  /**
   * The grade of the icon.
   */
  grade?: number;
  /**
   * The size of the icon.
   */
  size?: number;
}

/**
 * Uses material-icons library.
 * For available icons, see: https://fonts.google.com/icons?icon.set=Material+Icons
 */
export function Icon({
  name,
  filled = false,
  weight = 400,
  grade = 0,
  size = 16,
  style,
  className,
  ...props
}: Props) {
  return (
    <span
      translate="no"
      className={cn("material-symbols-outlined", className)}
      style={{
        fontVariationSettings: Object.entries({
          FILL: filled ? "1" : "0",
          wght: weight,
          GRAD: grade,
        })
          .map(([key, value]) => `'${key}' ${value}`)
          .join(", "),
        ...style,
        fontSize: `${size}px`,
      }}
      {...props}
    >
      {name}
    </span>
  );
}
