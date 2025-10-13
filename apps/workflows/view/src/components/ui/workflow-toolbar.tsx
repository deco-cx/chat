import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type ReactNode, type ReactElement, useRef, useEffect } from "react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { createRoot, type Root } from "react-dom/client";

export interface ToolbarButton {
  id: string;
  icon: string;
  label?: string;
  onClick?: () => void;
  variant?: "default" | "primary";
  disabled?: boolean;
  dropdown?: ReactElement;
  hoverDropdown?: ReactElement; // Dropdown shown on hover
}

export interface WorkflowToolbarProps {
  leftButtons?: ToolbarButton[];
  centerButtons?: ToolbarButton[];
  rightContent?: ReactNode;
  className?: string;
}

function ToolbarButton({
  icon,
  label,
  onClick,
  variant = "default",
  disabled = false,
  dropdown,
  hoverDropdown,
}: ToolbarButton) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tippyInstanceRef = useRef<TippyInstance | null>(null);
  const rootRef = useRef<Root | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!hoverDropdown || !buttonRef.current) return;

    // Create container for React content
    if (!containerRef.current) {
      containerRef.current = document.createElement("div");
    }

    // Create React root if needed
    if (!rootRef.current && containerRef.current) {
      rootRef.current = createRoot(containerRef.current);
    }

    // Render the dropdown content
    if (rootRef.current) {
      rootRef.current.render(hoverDropdown);
    }

    // Create tippy instance
    tippyInstanceRef.current = tippy(buttonRef.current, {
      content: containerRef.current,
      trigger: "mouseenter focus",
      interactive: true,
      placement: "bottom-start",
      maxWidth: 400,
      hideOnClick: false,
      delay: [200, 0], // Show after 200ms hover
    });

    return () => {
      if (tippyInstanceRef.current) {
        tippyInstanceRef.current.destroy();
        tippyInstanceRef.current = null;
      }
      if (rootRef.current) {
        rootRef.current.unmount();
        rootRef.current = null;
      }
    };
  }, [hoverDropdown]);

  const buttonElement = (
    <button
      ref={buttonRef}
      type="button"
      onClick={dropdown ? undefined : onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "flex items-center justify-center rounded-xl shrink-0 size-8",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        variant === "primary"
          ? "bg-[var(--primary-light)] text-[var(--primary-dark)] hover:opacity-90"
          : "hover:bg-muted",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <Icon
        name={icon}
        size={20}
        className={cn(
          variant === "primary"
            ? "text-[var(--primary-dark)]"
            : "text-muted-foreground",
        )}
        filled={variant === "primary"}
      />
    </button>
  );

  if (dropdown) {
    return dropdown;
  }

  return buttonElement;
}

function ToolbarSeparator() {
  return (
    <div className="flex items-center self-stretch px-2">
      <div className="h-5 w-px bg-border shrink-0" />
    </div>
  );
}

export function WorkflowToolbar({
  leftButtons = [],
  centerButtons = [],
  rightContent,
  className,
}: WorkflowToolbarProps) {
  return (
    <div
      className={cn(
        "bg-background border border-border rounded-xl p-1.5 flex flex-col gap-2.5 items-start",
        className,
      )}
    >
      <div className="flex gap-0.5 items-center">
        {/* Left section - action buttons */}
        {leftButtons.length > 0 && (
          <>
            {leftButtons.map((button) => (
              <ToolbarButton key={button.id} {...button} />
            ))}
            <ToolbarSeparator />
          </>
        )}

        {/* Center section - navigation/play controls */}
        {centerButtons.length > 0 && (
          <>
            {centerButtons.map((button) => (
              <ToolbarButton key={button.id} {...button} />
            ))}
            {rightContent && <ToolbarSeparator />}
          </>
        )}

        {/* Right section - custom content (e.g., step previews) */}
        {rightContent}
      </div>
    </div>
  );
}

export { ToolbarButton as WorkflowToolbarButton };
