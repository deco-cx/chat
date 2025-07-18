import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "./use-mobile.ts";

type ViewMode = "cards" | "table";

export function useViewMode(
  key?: string,
): [ViewMode, (mode: ViewMode) => void] {
  const isMobile = useIsMobile();
  const previousIsMobile = useRef<boolean>(isMobile);
  const storageKey = key ? `deco-view-mode-${key}` : "deco-view-mode";

  // Simple initialization: check localStorage, otherwise default to cards
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const stored = globalThis.localStorage?.getItem(storageKey);
    return stored === "cards" || stored === "table"
      ? (stored as ViewMode)
      : "cards";
  });

  // Save to localStorage when user manually changes view
  const setViewModeWithStorage = (mode: ViewMode) => {
    setViewMode(mode);
    globalThis.localStorage?.setItem(storageKey, mode);
  };

  // Auto-switch from table to cards when going from desktop to mobile
  useEffect(() => {
    if (!previousIsMobile.current && isMobile && viewMode === "table") {
      setViewMode("cards"); // Don't save auto-switches to localStorage
    }
    previousIsMobile.current = isMobile;
  }, [isMobile, viewMode]);

  return [viewMode, setViewModeWithStorage];
}
