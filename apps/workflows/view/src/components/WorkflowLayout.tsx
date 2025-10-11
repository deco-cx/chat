/**
 * WorkflowLayout - Clean workflow builder with floating toolbar
 */

import { useState, useRef } from "react";
import { WorkflowTabs } from "./ui/workflow-tabs";
import { WorkflowToolbar } from "./ui/workflow-toolbar";
import { WorkflowStepsPreview } from "./ui/workflow-steps-preview";
import { ToolsDropdown } from "./ui/tools-dropdown";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import type { Workflow } from "../types/workflow";
import { WorkflowCanvas, type WorkflowCanvasRef } from "./canvas";
import { useWorkflowStore } from "../store/workflowStore";
import { CreateViewModal } from "./CreateViewModal";
import { useMentionItems } from "../hooks/useMentionItems";
import { useIntegrations } from "../hooks/useIntegrations";

interface WorkflowLayoutProps {
  workflow: Workflow;
  currentStepIndex: number;
  onNavigate: (index: number) => void;
  onAddStep: () => void;
  onRunWorkflow: () => void;
  onExportWorkflow: () => void;
  onImportWorkflow: (workflowData: Workflow) => void;
  onTabChange?: (tab: string) => void;
  executionMonitor?: React.ReactNode;
}

export function WorkflowLayout({
  workflow,
  currentStepIndex,
  onNavigate,
  onAddStep,
  onRunWorkflow,
  onExportWorkflow,
  onImportWorkflow,
  onTabChange,
  executionMonitor,
}: WorkflowLayoutProps) {
  const [activeTab, setActiveTab] = useState("editor");
  const [executionPanelOpen, setExecutionPanelOpen] = useState(false);
  const canvasRef = useRef<WorkflowCanvasRef>(null);

  // Store state for modals
  const editingCode = useWorkflowStore((s) => s.editingCode);
  const editedCode = useWorkflowStore((s) => s.editedCode);
  const creatingView = useWorkflowStore((s) => s.creatingView);
  const store = useWorkflowStore();

  // Get tools/integrations for hover dropdown
  const mentionItems = useMentionItems(workflow);
  const { isLoading: integrationsLoading } = useIntegrations();

  console.log("🎯 Execution panel state:", executionPanelOpen);
  console.log("🎯 Has execution monitor content:", !!executionMonitor);

  const handleTabChange = (tab: string) => {
    console.log("📑 Tab changed to:", tab);
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const handleImportClick = () => {
    console.log("📥 [WorkflowLayout] Opening import prompt");

    const json = prompt("Paste workflow JSON here:");

    if (!json) {
      console.log("📥 [WorkflowLayout] Import cancelled");
      return;
    }

    try {
      console.log("📥 [WorkflowLayout] Parsing JSON, length:", json.length);

      const workflowData = JSON.parse(json);

      if (!workflowData.id || !Array.isArray(workflowData.steps)) {
        console.error("❌ [WorkflowLayout] Invalid workflow format");
        alert('❌ Invalid workflow format. Must have "id" and "steps" array.');
        return;
      }

      console.log("✅ [WorkflowLayout] Valid workflow:", workflowData.id);
      console.log("✅ [WorkflowLayout] Steps:", workflowData.steps.length);

      onImportWorkflow(workflowData);

      console.log("✅ [WorkflowLayout] Workflow imported successfully");
    } catch (error) {
      console.error("❌ [WorkflowLayout] Failed to parse JSON:", error);
      alert("❌ Invalid JSON. Please check format and try again.");
    }
  };

  const handleReset = () => {
    if (confirm("Reset workflow? This will clear all steps.")) {
      console.log("🔄 Resetting workflow");
      localStorage.clear();
      globalThis.location.reload();
    }
  };

  const steps = workflow.steps || [];
  const isRunning = workflow.execution?.status === "running";

  const tabs = [
    { id: "editor", label: "Editor", icon: "edit" },
    { id: "code", label: "Code", icon: "code" },
    { id: "input", label: "Input", icon: "keyboard" },
  ];

  const leftButtons = [
    {
      id: "tools",
      icon: "build",
      label: "Tools",
      hoverDropdown: (
        <ToolsDropdown
          items={mentionItems}
          isLoading={integrationsLoading}
          onItemClick={(item) => {
            console.log("🔧 Tool clicked:", item);
            // Could add functionality to insert tool in current step
          }}
        />
      ),
    },
    {
      id: "flash",
      icon: "flash_on",
      label: "Execution Monitor",
      onClick: () => {
        console.log(
          "🔥 Flash button clicked, toggling panel:",
          !executionPanelOpen,
        );
        setExecutionPanelOpen(!executionPanelOpen);
      },
    },
  ];

  const centerButtons = [
    {
      id: "prev",
      icon: "chevron_left",
      label: "Previous step",
      onClick: () => {
        if (activeTab === "editor") {
          canvasRef.current?.centerOnPrev();
        } else {
          onNavigate(Math.max(0, currentStepIndex - 1));
        }
      },
      disabled: currentStepIndex === 0,
    },
    {
      id: "play",
      icon: "play_arrow",
      label: "Run workflow",
      variant: "primary" as const,
      onClick: onRunWorkflow,
      disabled: isRunning || steps.length === 0,
    },
    {
      id: "next",
      icon: "chevron_right",
      label: "Next step",
      onClick: () => {
        if (activeTab === "editor") {
          canvasRef.current?.centerOnNext();
        } else {
          onNavigate(Math.min(steps.length - 1, currentStepIndex + 1));
        }
      },
      disabled: currentStepIndex >= steps.length - 1,
    },
  ];

  const stepPreviews = steps.map((step, index) => ({
    id: step.id,
    name: step.title || `Step ${index + 1}`,
    icon: step.icon,
  }));

  console.log("WorkflowLayout render:", {
    steps: steps.length,
    currentStepIndex,
    activeTab,
    workflowId: workflow.id,
    hasSteps: steps.length > 0,
  });

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Tabs at top */}
      <WorkflowTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={handleTabChange}
      />

      {/* Main Content Area */}
      <div className="flex-1 relative">
        {activeTab === "editor" && (
          <div className="absolute inset-0">
            <WorkflowCanvas ref={canvasRef} />
          </div>
        )}

        {activeTab === "code" && (
          <div className="absolute inset-0 overflow-auto p-2 bg-muted/20">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    Generated Code
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Step {currentStepIndex + 1} of {steps.length} •{" "}
                    {steps[currentStepIndex]?.title || "Untitled"}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const code = steps[currentStepIndex]?.code || "";
                    navigator.clipboard.writeText(code);
                  }}
                  disabled={!steps[currentStepIndex]?.code}
                  className="gap-2"
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "16px" }}
                  >
                    content_copy
                  </span>
                  Copy Code
                </Button>
              </div>

              {/* Code Block */}
              <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                  <span
                    className="material-symbols-outlined text-muted-foreground"
                    style={{ fontSize: "16px" }}
                  >
                    code
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">
                    JavaScript / TypeScript
                  </span>
                </div>
                <div className="p-6 overflow-auto max-h-[70vh] bg-[#0d1117]">
                  <pre className="text-sm font-mono leading-relaxed text-[#e6edf3]">
                    {steps[currentStepIndex]?.code || (
                      <span className="text-muted-foreground italic">
                        // No code generated yet
                      </span>
                    )}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "input" && (
          <div className="absolute inset-0 overflow-auto p-2 bg-muted/20">
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold text-foreground">
                    Input Schema
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Step {currentStepIndex + 1} of {steps.length} •{" "}
                    {steps[currentStepIndex]?.title || "Untitled"}
                  </p>
                </div>
                {steps[currentStepIndex]?.inputSchema && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const schema = JSON.stringify(
                        steps[currentStepIndex].inputSchema,
                        null,
                        2,
                      );
                      navigator.clipboard.writeText(schema);
                    }}
                    className="gap-2"
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "16px" }}
                    >
                      content_copy
                    </span>
                    Copy Schema
                  </Button>
                )}
              </div>

              {/* Schema Content */}
              {steps[currentStepIndex]?.inputSchema ? (
                <>
                  {/* Schema Block */}
                  <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
                      <span
                        className="material-symbols-outlined text-muted-foreground"
                        style={{ fontSize: "16px" }}
                      >
                        schema
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">
                        JSON Schema
                      </span>
                    </div>
                    <div className="p-6 overflow-auto max-h-[60vh] bg-[#0d1117]">
                      <pre className="text-sm font-mono leading-relaxed text-[#e6edf3]">
                        {JSON.stringify(
                          steps[currentStepIndex].inputSchema,
                          null,
                          2,
                        )}
                      </pre>
                    </div>
                  </div>

                  {/* Field Details */}
                  {steps[currentStepIndex].inputSchema?.properties &&
                    Object.keys(steps[currentStepIndex].inputSchema.properties)
                      .length > 0 && (
                      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-border bg-muted/30">
                          <h4 className="text-sm font-semibold text-foreground">
                            Field Details
                          </h4>
                        </div>
                        <div className="divide-y divide-border">
                          {Object.entries(
                            steps[currentStepIndex].inputSchema.properties,
                          ).map(([key, value]: [string, any]) => (
                            <div
                              key={key}
                              className="p-4 hover:bg-muted/20 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-sm font-semibold text-foreground">
                                      {key}
                                    </span>
                                    {Array.isArray(
                                      steps[currentStepIndex].inputSchema
                                        ?.required,
                                    ) &&
                                      steps[
                                        currentStepIndex
                                      ].inputSchema.required.includes(key) && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-600 font-medium">
                                          REQUIRED
                                        </span>
                                      )}
                                  </div>
                                  {value.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {value.description}
                                    </p>
                                  )}
                                </div>
                                <span className="text-xs px-2 py-1 rounded bg-muted font-mono text-muted-foreground">
                                  {value.type || "any"}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                  <span
                    className="material-symbols-outlined text-muted-foreground mx-auto"
                    style={{ fontSize: "48px" }}
                  >
                    schema
                  </span>
                  <p className="text-base font-medium text-foreground mt-4">
                    No input schema defined
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    This step doesn't require any input parameters
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Floating Toolbar at bottom */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <WorkflowToolbar
          leftButtons={[
            ...leftButtons,
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
                    <ResponsiveDropdownItem
                      onClick={onExportWorkflow}
                      disabled={!workflow || !workflow.id}
                    >
                      <span
                        className="material-symbols-outlined mr-2"
                        style={{ fontSize: "16px" }}
                      >
                        download
                      </span>
                      Export
                    </ResponsiveDropdownItem>
                    <ResponsiveDropdownItem onClick={handleImportClick}>
                      <span
                        className="material-symbols-outlined mr-2"
                        style={{ fontSize: "16px" }}
                      >
                        upload
                      </span>
                      Import
                    </ResponsiveDropdownItem>
                    <ResponsiveDropdownSeparator />
                    <ResponsiveDropdownItem
                      onClick={handleReset}
                      className="text-destructive focus:text-destructive"
                    >
                      <span
                        className="material-symbols-outlined mr-2"
                        style={{ fontSize: "16px" }}
                      >
                        refresh
                      </span>
                      Reset
                    </ResponsiveDropdownItem>
                  </ResponsiveDropdownContent>
                </ResponsiveDropdown>
              ),
            },
          ]}
          centerButtons={centerButtons}
          rightContent={
            <WorkflowStepsPreview
              steps={stepPreviews}
              activeStepId={steps[currentStepIndex]?.id}
              onStepClick={(stepId) => {
                const index = steps.findIndex((s) => s.id === stepId);
                if (index !== -1) {
                  if (activeTab === "editor") {
                    canvasRef.current?.centerOnStep(index);
                  } else {
                    onNavigate(index);
                  }
                }
              }}
              onAddStep={onAddStep}
            />
          }
        />
      </div>

      {/* Execution Monitor Dropdown */}
      {executionPanelOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[100]"
            onClick={() => setExecutionPanelOpen(false)}
          />

          {/* Dropdown Panel */}
          <div className="fixed bottom-2 left-2 z-[101] w-[400px] max-h-[70vh] bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between p-2 border-b border-border bg-muted/50">
              <h3 className="text-lg font-semibold text-foreground">
                Execution Monitor
              </h3>
              <button
                onClick={() => setExecutionPanelOpen(false)}
                className="size-8 flex items-center justify-center rounded-lg hover:bg-background transition-colors"
              >
                <span
                  className="material-symbols-outlined text-muted-foreground"
                  style={{ fontSize: "20px" }}
                >
                  close
                </span>
              </button>
            </div>
            <div className="overflow-y-auto p-2 max-h-[calc(70vh-60px)]">
              {executionMonitor || (
                <div className="p-2 text-center">
                  <p className="text-muted-foreground text-sm">
                    No execution data
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Code Editor Modal */}
      {editingCode && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              console.log(
                "🚪 [WorkflowLayout] Closing code editor (click outside)",
              );
              store.setEditingCode(false);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              console.log("🚪 [WorkflowLayout] Closing code editor (Escape)");
              store.setEditingCode(false);
            }
          }}
        >
          <div className="bg-background rounded-2xl border border-border shadow-2xl max-w-5xl w-full mx-8 max-h-[85vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 px-8 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold mb-1 text-foreground">
                  Edit Step as JSON
                </h3>
                <p className="text-sm text-muted-foreground">
                  Edit all step fields: code, input, schemas, views, etc
                </p>
              </div>
              <Button
                onClick={() => {
                  console.log(
                    "🚪 [WorkflowLayout] Closing code editor (close button)",
                  );
                  store.setEditingCode(false);
                }}
                variant="outline"
                size="icon"
                className="h-8 w-8"
              >
                ×
              </Button>
            </div>

            {/* Code Editor */}
            <div className="flex-1 overflow-auto p-6 px-8">
              <textarea
                value={editedCode}
                onChange={(e) => {
                  store.setEditingCode(true, e.target.value);
                }}
                className="w-full h-full font-mono text-sm bg-card border border-border rounded-lg p-4 text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Enter step JSON..."
              />
            </div>

            {/* Footer */}
            <div className="p-6 px-8 border-t border-border flex justify-end gap-3">
              <Button
                onClick={() => {
                  console.log(
                    "🚪 [WorkflowLayout] Closing code editor (cancel)",
                  );
                  store.setEditingCode(false);
                }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  console.log("💾 [WorkflowLayout] Saving step JSON");
                  try {
                    const stepData = JSON.parse(editedCode);
                    const currentStep = workflow.steps[currentStepIndex];

                    if (!stepData.id) {
                      alert('Step JSON must have an "id" field');
                      return;
                    }

                    store.updateStep(workflow.id, currentStep.id, stepData);
                    store.setEditingCode(false);
                    console.log(
                      "✅ [WorkflowLayout] Step updated successfully",
                    );
                  } catch (error) {
                    console.error("❌ [WorkflowLayout] Invalid JSON:", error);
                    alert("Invalid JSON. Please check your syntax.");
                  }
                }}
                variant="default"
              >
                Save JSON
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create View Modal */}
      {creatingView && (
        <CreateViewModal
          workflow={workflow}
          step={workflow.steps[currentStepIndex]}
          open={creatingView}
          onOpenChange={(open) => {
            if (!open) store.setCreatingView(false);
          }}
        />
      )}
    </div>
  );
}
