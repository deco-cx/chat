import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  type ReactElement,
  useRef,
  useEffect,
  useMemo,
  useCallback,
  useContext,
} from "react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../../main";
import { ToolsDropdown } from "./tools-dropdown";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { useActiveTab } from "@/store/tab";
import { WorkflowCanvasRef } from "../canvas/WorkflowCanvas";
import {
  useWorkflowStoreActions,
  useWorkflowStepsLength,
  WorkflowStoreContext,
  Workflow,
  useCurrentWorkflow,
} from "@/store/workflow";
import { useImportToolAsStep } from "@/hooks/useImportToolAsStep";
import { type MentionItem } from "@/hooks/useMentionItems";
import { useSearch } from "@tanstack/react-router";
import { useUpdateWorkflow } from "@/hooks/useUpdateWorkflow";
import { useQueryClient } from "@tanstack/react-query";
import { client } from "@/lib/rpc";
import { toast } from "sonner";

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

  // Capture workflow store from context (if available)
  const workflowStore = useContext(WorkflowStoreContext);

  // Create tippy instance only once on mount if hoverDropdown is provided
  useEffect(() => {
    if (!hoverDropdown || !buttonRef.current) return;

    // Create container for React content once
    containerRef.current = document.createElement("div");

    // Create React root once
    rootRef.current = createRoot(containerRef.current);

    // Create tippy instance once
    tippyInstanceRef.current = tippy(buttonRef.current, {
      content: containerRef.current,
      trigger: "mouseenter focus",
      interactive: true,
      placement: "bottom-start",
      maxWidth: 400,
      hideOnClick: false,
      delay: [200, 0],
      appendTo: document.body,
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
      containerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]); // Only re-run if label changes, not if hoverDropdown changes

  // Update React content when hoverDropdown or workflowStore changes
  useEffect(() => {
    if (!hoverDropdown || !rootRef.current) return;

    rootRef.current.render(
      <QueryClientProvider client={queryClient}>
        <WorkflowStoreContext.Provider value={workflowStore}>
          {hoverDropdown}
        </WorkflowStoreContext.Provider>
      </QueryClientProvider>,
    );
  }, [hoverDropdown, workflowStore, label]);

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
          icon === "progress_activity" && "animate-spin",
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

// Wrapper component that connects ToolsDropdown to workflow actions
function ToolsDropdownWithWorkflowActions() {
  const workflowLength = useWorkflowStepsLength();
  const importToolMutation = useImportToolAsStep();
  const { addStep, updateDependencyToolCalls, setCurrentStepIndex } =
    useWorkflowStoreActions();

  const handleToolClick = useCallback(
    (toolItem: MentionItem) => {
      // Only handle tool items (not step items)
      if (toolItem.type !== "tool") {
        console.log("⚠️ Skipping non-tool item:", toolItem.type);
        return;
      }

      if (!toolItem.integration) {
        console.error("❌ Tool item missing integration data");
        return;
      }

      importToolMutation.mutate(
        {
          toolName: toolItem.label,
          integrationId: toolItem.integration.id,
          integrationName: toolItem.integration.name,
          toolDescription: toolItem.description,
          inputSchema: toolItem.inputSchema,
          outputSchema: toolItem.outputSchema,
        },
        {
          onSuccess: (generatedStep) => {
            // Add step with correct WorkflowStep schema (type + def)
            addStep(generatedStep as any);

            // Update workflow dependencyToolCalls
            updateDependencyToolCalls();

            // Navigate to new step
            const currentSteps = workflowLength;
            setCurrentStepIndex(currentSteps);
          },
          onError: (error) => {
            console.error("❌ Failed to import tool:", error);
            alert(`Failed to import tool: ${error.message || String(error)}`);
          },
        },
      );
    },
    [
      importToolMutation,
      addStep,
      updateDependencyToolCalls,
      setCurrentStepIndex,
      workflowLength,
    ],
  );

  return <ToolsDropdown onToolClick={handleToolClick} />;
}

export function WorkflowToolbar({
  canvasRef,
}: {
  canvasRef: React.RefObject<WorkflowCanvasRef>;
}) {
  const activeTab = useActiveTab();
  const { clearStore, syncFromServer } = useWorkflowStoreActions();
  const searchParams = useSearch({ from: "/workflow" });
  const resourceURI = (searchParams as { resourceURI?: string })?.resourceURI;
  const workflow = useCurrentWorkflow();
  const queryClient = useQueryClient();

  const updateWorkflowMutation = useUpdateWorkflow();

  // Handle save workflow
  const handleSaveWorkflow = useCallback(() => {
    if (!resourceURI || !workflow) return;

    updateWorkflowMutation.mutate(
      {
        uri: resourceURI,
        workflow: workflow,
      },
      {
        onSuccess: () => {
          toast.success("Workflow saved successfully");
          queryClient.invalidateQueries({
            queryKey: ["workflow", resourceURI],
          });
        },
        onError: (error) => {
          toast.error(
            `Failed to save workflow: ${error instanceof Error ? error.message : String(error)}`,
          );
        },
      },
    );
  }, [resourceURI, workflow, updateWorkflowMutation, queryClient]);

  // Handle sync from server
  const handleSyncFromServer = useCallback(async () => {
    if (!resourceURI) return;

    try {
      const result = await client.READ_WORKFLOW({ uri: resourceURI });

      if (result?.workflow) {
        syncFromServer(result.workflow as Workflow);
        // Also invalidate the query cache to keep it in sync
        await queryClient.invalidateQueries({
          queryKey: ["workflow", resourceURI],
        });
      }
    } catch (error) {
      console.error("❌ Failed to sync workflow:", error);
      alert(
        `Failed to sync workflow: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }, [resourceURI, syncFromServer, queryClient]);

  // Memoize the tools dropdown to prevent recreating it on every render
  const toolsDropdown = useMemo(() => <ToolsDropdownWithWorkflowActions />, []);

  const leftButtons = useMemo(
    () => [
      {
        id: "tools",
        icon: "build",
        label: "Tools",
        hoverDropdown: toolsDropdown,
      },
      {
        id: "settings",
        icon: "settings",
        label: "Settings",
        dropdown: (
          <ResponsiveDropdown>
            <ResponsiveDropdownTrigger asChild>
              <button
                type="button"
                aria-label="Settings"
                className="flex items-center justify-center rounded-xl shrink-0 size-8 hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <span
                  className="material-symbols-outlined text-muted-foreground"
                  style={{ fontSize: "20px" }}
                >
                  settings
                </span>
              </button>
            </ResponsiveDropdownTrigger>
            <ResponsiveDropdownContent
              align="end"
              className="w-fit bg-popover/95 backdrop-blur-sm"
            >
              <ResponsiveDropdownItem onClick={handleSyncFromServer}>
                <span
                  className="material-symbols-outlined mr-2"
                  style={{ fontSize: "16px" }}
                >
                  sync
                </span>
                Sync from Server
              </ResponsiveDropdownItem>
              <ResponsiveDropdownItem
                onClick={() => {
                  if (
                    confirm(
                      "Are you sure you want to reset the workflow? This will clear all steps.",
                    )
                  ) {
                    clearStore();
                  }
                }}
                className="text-destructive focus:text-destructive"
              >
                <span
                  className="material-symbols-outlined mr-2"
                  style={{ fontSize: "16px" }}
                >
                  delete_sweep
                </span>
                Reset Workflow
              </ResponsiveDropdownItem>
            </ResponsiveDropdownContent>
          </ResponsiveDropdown>
        ),
      },
      {
        id: "save",
        icon: updateWorkflowMutation.isPending ? "progress_activity" : "save",
        label: updateWorkflowMutation.isPending ? "Saving..." : "Save Workflow",
        onClick: handleSaveWorkflow,
        disabled: updateWorkflowMutation.isPending,
      },
    ],
    [
      activeTab,
      clearStore,
      handleSyncFromServer,
      handleSaveWorkflow,
      toolsDropdown,
      updateWorkflowMutation.isPending,
    ],
  );

  const centerButtons = useMemo(
    () => [
      {
        id: "prev",
        icon: "chevron_left",
        label: "Previous step",
        onClick: () => {
          if (activeTab === "editor") {
            canvasRef.current?.centerOnPrev();
          } else {
            void 0;
          }
          return void 0;
        },
        disabled: false,
      },
      {
        id: "play",
        icon: "play_arrow",
        label: "Run workflow",
        variant: "primary" as const,
        onClick: () => {
          void 0;
        },
        disabled: false,
      },
      {
        id: "next",
        icon: "chevron_right",
        label: "Next step",
        onClick: () => {
          if (activeTab === "editor") {
            canvasRef.current?.centerOnNext();
          } else {
            void 0;
          }
        },
        disabled: false,
      },
    ],
    [activeTab],
  );
  return (
    <div
      className={cn(
        "bg-background border border-border rounded-xl p-1.5 flex flex-col gap-2.5 items-start",
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
          </>
        )}
      </div>
    </div>
  );
}

export { ToolbarButton as WorkflowToolbarButton };
