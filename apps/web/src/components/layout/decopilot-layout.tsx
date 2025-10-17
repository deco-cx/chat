import { PropsWithChildren } from "react";
import { useLocalStorage } from "../../hooks/use-local-storage";
import {
  DecopilotContextValue,
  DecopilotProvider,
} from "../decopilot/context.tsx";

export function useDecopilotOpen() {
  const { value: open, update: setOpen } = useLocalStorage({
    key: "deco-cms-decopilot",
    defaultValue: false,
  });

  const toggle = () => {
    setOpen(!open);
  };

  return {
    open,
    setOpen,
    toggle,
  };
}

/**
 * DecopilotLayout is now a simple context provider for pages that need to
 * provide additional context to the Decopilot chat.
 * 
 * The actual chat rendering is handled by ProjectLayout to prevent re-renders
 * during navigation.
 */
export function DecopilotLayout({
  children,
  value,
}: PropsWithChildren<{ value: DecopilotContextValue }>) {
  return (
    <DecopilotProvider value={value}>
      {children}
    </DecopilotProvider>
  );
}
