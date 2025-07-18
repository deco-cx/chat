import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type ComponentProps, type ReactNode, Suspense, useMemo } from "react";
import { useAgentTools } from "../../hooks/use-tools.ts";
import { togglePanel, useDock } from "../dock/index.tsx";
import { useChatContext } from "./context.tsx";

function ToolsButton() {
  const { uiOptions } = useChatContext();
  const showThreadTools = uiOptions?.showThreadTools;
  if (typeof showThreadTools === "boolean" && !showThreadTools) {
    return null;
  }
  return (
    <Suspense fallback={<ToolsButton.Skeleton />}>
      <ToolsButton.UI />
    </Suspense>
  );
}

function DockedToggleButton({
  id,
  title,
  children,
  className,
  disabled,
  ...btnProps
}: {
  id: string;
  title: string;
  children: ReactNode;
} & ComponentProps<typeof Button>) {
  const { openPanels, tabs } = useDock();

  return (
    <Button
      {...btnProps}
      type="button"
      disabled={disabled || !tabs[id]}
      onClick={() =>
        togglePanel({
          id,
          component: id,
          title,
          initialWidth: 420,
          position: { direction: "right" },
        })
      }
      className={cn(className, openPanels.has(id) ? "bg-accent" : "")}
    >
      {children}
    </Button>
  );
}

ToolsButton.Skeleton = () => (
  <DockedToggleButton
    id="tools"
    title="Chat settings"
    variant="outline"
    size="sm"
    disabled
  >
    <Icon name="build" />
  </DockedToggleButton>
);

ToolsButton.UI = () => {
  const { agentId } = useChatContext();
  const tools_set = useAgentTools(agentId);
  const numberOfTools = useMemo(
    () => Object.values(tools_set).reduce((acc, tool) => acc + tool.length, 0),
    [tools_set],
  );

  return (
    <DockedToggleButton
      id="tools"
      title="Chat settings"
      variant="outline"
      size="sm"
    >
      <Icon name="build" />
      <span className="text-xs">{numberOfTools}</span>
    </DockedToggleButton>
  );
};

export default ToolsButton;
