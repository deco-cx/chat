import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { PropsWithChildren } from "react";
import { useLocation } from "react-router";
import { useLocalStorage } from "../../hooks/use-local-storage";
import {
  DecopilotContextValue,
  DecopilotProvider,
} from "../decopilot/context.tsx";
import { DecopilotChat } from "../decopilot/index.tsx";

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

export function DecopilotLayout({
  children,
  value,
}: PropsWithChildren<{ value: DecopilotContextValue }>) {
  const { open: decopilotOpen } = useDecopilotOpen();
  const location = useLocation();
  const isAgentDetailPage = location.pathname.match(/\/agent\/[^\/]+\/[^\/]+$/);

  return (
    <DecopilotProvider value={value}>
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel>{children}</ResizablePanel>
        {/* Don't show DecopilotChat panel on agent detail pages (handled internally) */}
        {decopilotOpen && !isAgentDetailPage && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={15}>
              <DecopilotChat />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </DecopilotProvider>
  );
}
