import { type NodeProps, useStore, Handle, Position } from "reactflow";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { useWorkflowStore } from "../../../store/workflowStore";
import { useExecuteStep } from "../../../hooks/useExecuteStep";
import { useState, useMemo } from "react";
import { RichTextEditor } from "../../RichTextEditor";
import { useMentionItems } from "../../../hooks/useMentionItems";
import { IframeViewRenderer } from "../../IframeViewRenderer";
import { CreateInputViewModal } from "../../CreateInputViewModal";
import { RenderInputViewModal } from "../../RenderInputViewModal";

interface StepNodeData {
  stepId: string;
}

export function StepNode({ data }: NodeProps<StepNodeData>) {
  const zoom = useStore((s) => s.transform[2]);
  const [showJsonView, setShowJsonView] = useState(false);
  const [activeView, setActiveView] = useState<string>("json");
  const [creatingInputViewFor, setCreatingInputViewFor] = useState<
    string | null
  >(null);
  const [renderingInputView, setRenderingInputView] = useState<{
    fieldName: string;
    viewName: string;
    viewCode: string;
  } | null>(null);

  // Only subscribe to the specific step we need, not the entire workflow
  const step = useWorkflowStore((s) => {
    const workflow = s.getCurrentWorkflow();
    return workflow?.steps.find((st) => st.id === data.stepId);
  });

  const workflow = useWorkflowStore((s) => s.getCurrentWorkflow());
  const updateStep = useWorkflowStore((s) => s.updateStep);
  const deleteStep = useWorkflowStore((s) => s.deleteStep);
  const duplicateStep = useWorkflowStore((s) => s.duplicateStep);
  const setInputValue = useWorkflowStore((s) => s.setInputValue);
  const inputValues = useWorkflowStore((state) => state.inputValues);
  const executeStepMutation = useExecuteStep();

  if (!workflow || !step) return null;

  // Get mentions for @ autocomplete - only include previous steps
  // Memoized to prevent editor recreation - include step.id to ensure remount on step change
  const previousStepsWorkflow = useMemo(() => {
    const stepIndex = workflow.steps.findIndex((s) => s.id === step.id);
    return {
      ...workflow,
      steps: workflow.steps.slice(0, stepIndex), // Only steps before this one
    };
  }, [workflow.id, workflow.steps.length, step.id]);

  const mentions = useMentionItems(previousStepsWorkflow);
  const compact = zoom < 0.7;

  const handleExecuteStep = () => {
    if (!workflow) return;

    console.log("▶️ [StepNode] Executing step:", step.id);

    // Build resolved input from current input values
    const resolvedInput: Record<string, unknown> = {};

    if (
      step.inputSchema &&
      (step.inputSchema as Record<string, unknown>).properties
    ) {
      const properties = (step.inputSchema as Record<string, unknown>)
        .properties as Record<string, unknown>;

      for (const key of Object.keys(properties)) {
        const inputKey = `${step.id}_${key}`;
        const userValue = inputValues[inputKey];
        const storedValue = step.input?.[key];

        // Use user-edited value if exists, otherwise use stored value
        resolvedInput[key] = userValue !== undefined ? userValue : storedValue;
      }
    }

    console.log("📋 [StepNode] Resolved input:", resolvedInput);

    // Build previous steps map
    const previousStepResults: Record<string, unknown> = {};
    const stepIndex = workflow.steps.findIndex((s) => s.id === step.id);

    for (let i = 0; i < stepIndex; i++) {
      const prevStep = workflow.steps[i];
      if (prevStep.output !== undefined) {
        previousStepResults[prevStep.id] = prevStep.output;
        console.log(
          `📦 [StepNode] Added previous step result: ${prevStep.id} (${prevStep.title})`,
        );
      } else {
        console.warn(
          `⚠️ [StepNode] Previous step ${prevStep.id} (${prevStep.title}) has no output yet!`,
        );
      }
    }

    console.log(
      "📦 [StepNode] Previous step results:",
      Object.keys(previousStepResults),
    );

    // Set status to active
    updateStep(workflow.id, step.id, { status: "active" });

    executeStepMutation.mutate(
      {
        step: { ...step, input: resolvedInput },
        previousStepResults,
      },
      {
        onSuccess: (result) => {
          console.log("✅ [StepNode] Step executed successfully:", result);

          updateStep(workflow.id, step.id, {
            status: result.success ? "completed" : "error",
            output: result.output,
            error: result.success ? undefined : String(result.error),
            logs: result.logs,
            duration: result.duration,
          });
        },
        onError: (error) => {
          console.error("❌ [StepNode] Step execution failed:", error);

          updateStep(workflow.id, step.id, {
            status: "error",
            error: String(error),
          });
        },
      },
    );
  };

  if (compact) {
    return (
      <div className="rounded-xl border bg-card p-3 w-[320px] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle
          type="source"
          position={Position.Right}
          style={{ opacity: 0 }}
        />
        <div className="flex items-start gap-2">
          {step.icon && (
            <Icon
              name={step.icon}
              size={18}
              className="text-muted-foreground flex-shrink-0 mt-0.5"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">
              {step.title}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
              {step.description}
            </div>
          </div>
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${
              step.status === "completed"
                ? "bg-success"
                : step.status === "active"
                  ? "bg-primary animate-pulse"
                  : step.status === "error"
                    ? "bg-destructive"
                    : "bg-muted-foreground"
            }`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-foreground border border-border rounded-xl p-[2px] w-[640px]">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between h-10 px-4 py-2 rounded-t-xl overflow-clip">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {step.icon && (
            <Icon
              name={step.icon}
              size={16}
              className="shrink-0 text-background"
            />
          )}
          <span className="text-sm font-medium text-background leading-5 truncate">
            {step.title}
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowJsonView(!showJsonView)}
            className="size-5 flex items-center justify-center hover:opacity-70 transition-opacity nodrag"
            title={showJsonView ? "Show form view" : "Show JSON view"}
          >
            <Icon name="code" size={20} className="text-muted-foreground" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="size-5 flex items-center justify-center hover:opacity-70 transition-opacity nodrag"
              >
                <Icon
                  name="more_horiz"
                  size={20}
                  className="text-muted-foreground"
                />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => {
                  if (workflow) duplicateStep?.(workflow.id, step.id);
                }}
              >
                <Icon name="content_copy" size={16} className="mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const newTitle = prompt("Enter new name:", step.title);
                  if (newTitle && workflow) {
                    updateStep(workflow.id, step.id, { title: newTitle });
                  }
                }}
              >
                <Icon name="edit" size={16} className="mr-2" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  if (workflow && confirm(`Delete step "${step.title}"?`)) {
                    deleteStep?.(workflow.id, step.id);
                  }
                }}
                className="text-destructive"
              >
                <Icon name="delete" size={16} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col rounded-xl overflow-hidden">
        {showJsonView ? (
          <div className="bg-background p-4">
            {(() => {
              const jsonString = JSON.stringify(step, null, 2);
              const lines = jsonString.split("\n");

              return (
                <div
                  className="border border-border rounded"
                  style={{
                    height: "400px",
                    overflowY: "auto",
                    overflowX: "hidden",
                    cursor: "text",
                    pointerEvents: "auto",
                  }}
                  onWheel={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <div className="flex gap-5 p-2">
                    {/* Line numbers */}
                    <div className="flex flex-col font-mono text-sm text-muted-foreground leading-[1.5] opacity-50 select-none">
                      {lines.map((_, i) => (
                        <span key={i + 1}>{i + 1}</span>
                      ))}
                    </div>

                    {/* Code content */}
                    <div className="flex-1">
                      <pre className="font-mono text-sm text-foreground leading-[1.5] m-0 whitespace-pre-wrap break-words">
                        {jsonString}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {/* Tools Used Section */}
            {step.toolCalls && step.toolCalls.length > 0 && (
              <div className="bg-background border-b border-border p-4">
                <p className="font-mono text-sm text-muted-foreground uppercase mb-4">
                  TOOLS USED
                </p>
                <div className="flex gap-3 flex-wrap">
                  {step.toolCalls.map((tool: string) => (
                    <Badge
                      key={tool}
                      variant="secondary"
                      className="bg-muted border border-border px-1 py-0.5 text-foreground text-sm font-normal gap-1"
                    >
                      <div className="size-4 bg-background border border-border/20 rounded-md flex items-center justify-center">
                        <Icon name="build" size={12} />
                      </div>
                      {tool}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Input Parameters Section */}
            {step.inputSchema && (
              <div className="bg-background border-b border-border p-4">
                <div
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="font-mono text-sm text-muted-foreground uppercase mb-4">
                    INPUT PARAMETERS
                  </p>
                  <div className="flex flex-col gap-5">
                    {Object.entries(
                      (step.inputSchema as Record<string, unknown>)
                        .properties || {},
                    ).map(([key, schema]: [string, unknown]) => {
                      const schemaObj = schema as Record<string, unknown>;
                      const currentValue = step.input?.[key];
                      const description =
                        typeof schemaObj.description === "string"
                          ? schemaObj.description
                          : "";
                      const inputKey = `${step.id}_${key}`;
                      const displayValue =
                        inputValues[inputKey] !== undefined
                          ? inputValues[inputKey]
                          : typeof currentValue === "string"
                            ? currentValue
                            : JSON.stringify(currentValue) || "";

                      // Get input views for this field
                      const fieldViewPrefix = `${key}_`;
                      const fieldViews = Object.entries(
                        step.inputViews || {},
                      ).filter(([viewName]) =>
                        viewName.startsWith(fieldViewPrefix),
                      );

                      return (
                        <div key={`${step.id}_${key}_wrapper`}>
                          <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-medium text-foreground leading-none">
                              {key}
                            </label>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setCreatingInputViewFor(key)}
                              className="text-xs h-6 px-2"
                            >
                              + Add View
                            </Button>
                          </div>

                          {/* Custom Input Views Pills */}
                          {fieldViews.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-2">
                              {fieldViews.map(([viewName, viewCode]) => (
                                <Button
                                  key={viewName}
                                  variant="secondary"
                                  size="sm"
                                  onClick={() =>
                                    setRenderingInputView({
                                      fieldName: key,
                                      viewName,
                                      viewCode,
                                    })
                                  }
                                  className="text-xs h-6 px-2"
                                >
                                  {viewName.replace(fieldViewPrefix, "")}
                                </Button>
                              ))}
                            </div>
                          )}

                          <RichTextEditor
                            key={inputKey}
                            value={displayValue}
                            onChange={(newValue) => {
                              console.log(
                                "🔤 [StepNode] Input changed:",
                                key,
                                newValue,
                              );

                              setInputValue(inputKey, newValue);

                              const currentInput = step.input || {};
                              updateStep(workflow.id, step.id, {
                                input: { ...currentInput, [key]: newValue },
                              });
                            }}
                            placeholder={description || `Enter ${key}...`}
                            mentions={mentions}
                            minHeight="40px"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Execute Button Section */}
        <div className="bg-background border-b border-border flex items-center justify-end gap-2 p-4">
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={handleExecuteStep}
              disabled={executeStepMutation.isPending}
              className="bg-primary-light text-primary-dark hover:bg-[#c5e015] h-8 px-3 py-2 rounded-xl text-sm font-medium leading-5 nodrag"
            >
              {executeStepMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-dark/20 border-t-primary-dark rounded-full animate-spin" />
                  Executing...
                </span>
              ) : (
                "Execute step"
              )}
            </Button>
          </div>
        </div>

        {/* Output Section */}
        {step.output !== undefined && !showJsonView && (
          <div className="bg-background border-b border-border p-4 flex flex-col gap-3 relative">
            <div
              className="nodrag"
              style={{ cursor: "default" }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header with metrics */}
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-sm text-muted-foreground uppercase">
                  EXECUTION RESULT
                </p>
                <div className="flex items-center gap-2 px-1">
                  {step.duration && (
                    <div className="flex items-center gap-1">
                      <Icon
                        name="schedule"
                        size={16}
                        className="text-purple-light"
                      />
                      <span className="font-mono text-sm text-muted-foreground">
                        {step.duration}ms
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* View toggles */}
              <div className="flex items-center gap-2 py-2 flex-wrap">
                <Button
                  variant={activeView === "json" ? "default" : "secondary"}
                  size="sm"
                  onClick={() => setActiveView("json")}
                  className="h-8 px-3"
                >
                  JSON
                </Button>

                {/* Render buttons for each created view */}
                {step.outputViews &&
                  Object.keys(step.outputViews).map((viewName) => (
                    <Button
                      key={viewName}
                      variant={
                        activeView === viewName ? "default" : "secondary"
                      }
                      size="sm"
                      onClick={() => setActiveView(viewName)}
                      className="h-8 px-3"
                    >
                      {viewName}
                    </Button>
                  ))}

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!workflow) return;
                    console.log("🎨 [StepNode] Opening create view modal");

                    // Set this step as the current step first
                    const stepIndex = workflow.steps.findIndex(
                      (s) => s.id === step.id,
                    );
                    if (stepIndex !== -1) {
                      const setCurrentStepIndex =
                        useWorkflowStore.getState().setCurrentStepIndex;
                      setCurrentStepIndex(workflow.id, stepIndex);
                    }

                    // Then open the modal
                    const setCreatingView =
                      useWorkflowStore.getState().setCreatingView;
                    const setNewViewName =
                      useWorkflowStore.getState().setNewViewName;
                    setCreatingView(true);

                    // Auto-suggest next view name
                    const existingViews = Object.keys(step.outputViews || {});
                    const nextNum = existingViews.length + 1;
                    setNewViewName(`view${nextNum}`);
                  }}
                  className="h-8 px-3"
                >
                  Create view
                  <Icon name="add" size={16} />
                </Button>
              </div>

              {/* Output Display - JSON or View */}
              {activeView === "json" ? (
                // JSON Output
                (() => {
                  const jsonString =
                    typeof step.output === "object"
                      ? JSON.stringify(step.output, null, 2)
                      : String(step.output);
                  const lines = jsonString.split("\n");

                  return (
                    <div
                      className="border border-border rounded"
                      style={{
                        height: "400px",
                        overflowY: "auto",
                        overflowX: "hidden",
                        cursor: "text",
                        pointerEvents: "auto",
                      }}
                      onWheel={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <div className="flex gap-5 p-2">
                        {/* Line numbers */}
                        <div className="flex flex-col font-mono text-sm text-muted-foreground leading-[1.5] opacity-50 select-none">
                          {lines.map((_, i) => (
                            <span key={i + 1}>{i + 1}</span>
                          ))}
                        </div>

                        {/* Code content */}
                        <div className="flex-1">
                          <pre className="font-mono text-sm text-foreground leading-[1.5] m-0 whitespace-pre-wrap break-words">
                            {jsonString}
                          </pre>
                        </div>
                      </div>
                    </div>
                  );
                })()
              ) : (
                // View Output (IframeViewRenderer)
                <div className="min-h-[300px]">
                  <IframeViewRenderer
                    html={step.outputViews?.[activeView] || ""}
                    data={
                      typeof step.output === "object" && step.output !== null
                        ? (step.output as Record<string, unknown>)
                        : { value: step.output }
                    }
                    height="400px"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {step.error && (
          <div className="bg-background p-4">
            <div className="bg-destructive/10 border border-destructive/50 rounded-xl p-3">
              <p className="text-sm text-destructive font-mono m-0">
                {String(step.error)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Create Input View Modal */}
      {creatingInputViewFor && workflow && step && (
        <CreateInputViewModal
          workflow={{ id: workflow.id, steps: workflow.steps }}
          step={step}
          fieldName={creatingInputViewFor}
          fieldSchema={
            (
              (step.inputSchema as Record<string, unknown>)
                ?.properties as Record<string, Record<string, unknown>>
            )?.[creatingInputViewFor] || {}
          }
          open={!!creatingInputViewFor}
          onOpenChange={(open) => {
            if (!open) setCreatingInputViewFor(null);
          }}
        />
      )}

      {/* Render Input View Modal */}
      {renderingInputView && workflow && step && (
        <RenderInputViewModal
          workflow={workflow}
          step={step}
          fieldName={renderingInputView.fieldName}
          viewName={renderingInputView.viewName}
          viewCode={renderingInputView.viewCode}
          open={!!renderingInputView}
          onOpenChange={(open) => {
            if (!open) setRenderingInputView(null);
          }}
          onSubmit={(data) => {
            console.log("📝 [StepNode] Input view submitted:", data);

            // Update the field value
            const fieldValue = data[renderingInputView.fieldName];
            if (fieldValue !== undefined) {
              const inputKey = `${step.id}_${renderingInputView.fieldName}`;
              const valueStr =
                typeof fieldValue === "string"
                  ? fieldValue
                  : JSON.stringify(fieldValue);

              setInputValue(inputKey, valueStr);

              const currentInput = step.input || {};
              updateStep(workflow.id, step.id, {
                input: {
                  ...currentInput,
                  [renderingInputView.fieldName]: valueStr,
                },
              });
            }
          }}
        />
      )}
    </div>
  );
}
