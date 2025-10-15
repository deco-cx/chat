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
import { useExecuteStep } from "../../../hooks/useExecuteStep";
import { useState, memo, useMemo, useCallback } from "react";
import { RichTextEditor } from "../../RichTextEditor";
import { RenderInputViewModal } from "../../RenderInputViewModal";
import {
  useWorkflowStoreActions,
  useWorkflowStepByName,
  useWorkflowAuthToken,
  useWorkflowStepsArray,
  useWorkflowStepIndex,
} from "@/store/workflow";
import { StepOutput } from "./step-output";
import type { WorkflowStep, WorkflowDependency } from "shared/types/workflows";

interface StepNodeData {
  stepId: string;
}

// Type guards
function hasErrorOutput(output: unknown): output is { error: string } {
  return (
    typeof output === "object" &&
    output !== null &&
    "error" in output &&
    typeof (output as { error: unknown }).error === "string"
  );
}

function hasSuccessOutput(output: unknown): output is Record<string, unknown> {
  return (
    typeof output === "object" &&
    output !== null &&
    Object.keys(output).length > 0 &&
    !hasErrorOutput(output) // Use the error check to ensure no error exists
  );
}

function hasExecutionResult(output: unknown): output is {
  success: boolean;
  output?: unknown;
  duration?: number;
} {
  return (
    typeof output === "object" &&
    output !== null &&
    "success" in output &&
    typeof (output as { success: unknown }).success === "boolean" &&
    (output as { success: boolean }).success === true &&
    !hasErrorOutput(output) // Only consider it a successful result if no error exists
  );
}

// Components
interface StepErrorProps {
  error: string;
}

function StepError({ error }: StepErrorProps) {
  return (
    <div className="mt-3 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
      <p className="text-xs text-red-400 font-mono whitespace-pre-wrap">
        {error}
      </p>
    </div>
  );
}

function StepSuccessIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-green-500 font-medium">
      <Icon name="check_circle" size={20} />
      <span>Executed successfully</span>
    </div>
  );
}

function StepErrorIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm text-red-500 font-medium">
      <Icon name="error" size={20} />
      <span>Execution failed</span>
    </div>
  );
}

interface JsonViewProps {
  jsonString: string;
  lines: string[];
}

function JsonView({ jsonString, lines }: JsonViewProps) {
  return (
    <div className="bg-background p-4">
      <div
        data-scrollable="true"
        className="border border-border rounded bg-muted/30"
        style={{
          maxHeight: "500px",
          minHeight: "120px",
          overflowY: "auto",
          overflowX: "hidden",
          cursor: "text",
          pointerEvents: "auto",
        }}
        onWheel={(e) => {
          e.stopPropagation();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex gap-5 p-4">
          {/* Line numbers */}
          <div className="flex flex-col font-mono text-xs text-muted-foreground leading-[1.5] opacity-50 select-none shrink-0">
            {lines.map((_, i) => (
              <span key={i + 1}>{i + 1}</span>
            ))}
          </div>

          {/* Code content */}
          <div className="flex-1 min-w-0">
            <pre className="font-mono text-xs text-foreground leading-[1.5] m-0 whitespace-pre-wrap break-words">
              {jsonString}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

interface StepFormViewProps {
  step: WorkflowStep;
  inputSchemaEntries: Array<[string, unknown]>;
  workflowActions: ReturnType<typeof useWorkflowStoreActions>;
  onCreateInputView: (key: string) => void;
  stepName: string;
}

// OPTIMIZED: Memoize to prevent re-renders when parent updates
const StepFormView = memo(
  function StepFormView({
    step,
    inputSchemaEntries,
    workflowActions,
    onCreateInputView,
    stepName,
  }: StepFormViewProps) {
    // PERFORMANCE: Use granular updateStepInput for field changes
    // This prevents creating new input objects and triggering re-renders
    const handleFieldChange = useCallback(
      (fieldKey: string, newValue: string) => {
        // CRITICAL: Use updateStepInput instead of updateStep
        // This only updates the specific field without recreating input object
        workflowActions.updateStepInput(stepName, fieldKey, newValue);
      },
      [workflowActions, stepName],
    );

    // Dependencies might be under def or at step level
    const dependencies =
      step.def && "dependencies" in step.def
        ? (step.def as any).dependencies
        : undefined;

    // PERFORMANCE: Create per-field onChange handlers that are stable
    // This prevents creating new functions on every render
    const fieldHandlers = useMemo(() => {
      const handlers: Record<string, (newValue: string) => void> = {};
      inputSchemaEntries.forEach(([key]) => {
        handlers[key] = (newValue: string) => handleFieldChange(key, newValue);
      });
      return handlers;
    }, [inputSchemaEntries, handleFieldChange]);

    return (
      <>
        {/* Tools Used Section */}
        {dependencies && dependencies.length > 0 && (
          <div className="bg-background border-b border-border p-4">
            <p className="font-mono text-sm text-muted-foreground uppercase mb-4">
              TOOLS USED
            </p>
            <div className="flex gap-3 flex-wrap">
              {dependencies.map((tool: WorkflowDependency) => (
                <Badge
                  key={tool.integrationId}
                  variant="secondary"
                  className="bg-muted border border-border px-1 py-0.5 text-foreground text-sm font-normal gap-1"
                >
                  <div className="size-4 bg-background border border-border/20 rounded-md flex items-center justify-center">
                    <Icon name="build" size={12} />
                  </div>
                  {tool.integrationId}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Input Parameters Section */}
        {step.def?.inputSchema && (
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
                {inputSchemaEntries.map(([key, schema]: [string, unknown]) => {
                  const schemaObj = schema as Record<string, unknown>;
                  const description =
                    typeof schemaObj.description === "string"
                      ? schemaObj.description
                      : "";

                  // Get the current value from step.def.input
                  const currentValue = (step.def as any).input?.[key];
                  const stringValue =
                    typeof currentValue === "string"
                      ? currentValue
                      : currentValue !== undefined
                        ? JSON.stringify(currentValue, null, 2)
                        : "";

                  return (
                    <div key={key}>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-foreground leading-none">
                          {key}
                        </label>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => onCreateInputView(key)}
                          className="text-xs h-6 px-2"
                        >
                          + Add View
                        </Button>
                      </div>

                      <RichTextEditor
                        placeholder={description || `Enter ${key}...`}
                        minHeight="40px"
                        value={stringValue}
                        onChange={fieldHandlers[key]}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison - only re-render if these actually changed
    return (
      prevProps.step === nextProps.step &&
      prevProps.stepName === nextProps.stepName &&
      prevProps.inputSchemaEntries.length ===
        nextProps.inputSchemaEntries.length &&
      prevProps.workflowActions === nextProps.workflowActions &&
      prevProps.onCreateInputView === nextProps.onCreateInputView
    );
  },
);

export const StepNode = memo(
  function StepNode({ data }: NodeProps<StepNodeData>) {
    // OPTIMIZED: Only subscribe to zoom, and add equality check to prevent re-renders
    const zoom = useStore(
      (s) => s.transform[2],
      (a, b) => Math.abs(a - b) < 0.01,
    );
    const [showJsonView, setShowJsonView] = useState(false);
    const [_creatingInputViewFor, setCreatingInputViewFor] = useState<
      string | null
    >(null);
    const [renderingInputView, setRenderingInputView] = useState<{
      fieldName: string;
      viewName: string;
      viewCode: string;
    } | null>(null);

    // OPTIMIZED: Only subscribe to the specific step we need, not entire workflow
    const step = useWorkflowStepByName(data.stepId);
    const workflowActions = useWorkflowStoreActions();

    // OPTIMIZED: Atomic selectors - only subscribe to what we actually need
    const authToken = useWorkflowAuthToken();

    const executeStepMutation = useExecuteStep();

    const compact = zoom < 0.7;

    // OPTIMIZED: Only compute when actually needed (when showJsonView is true)
    const inputSchemaEntries = useMemo((): Array<[string, unknown]> => {
      if (!step || !(step.def as any)?.inputSchema) return [];
      return Object.entries(
        ((step.def as any).inputSchema as Record<string, unknown>).properties ||
          {},
      );
    }, [step, (step?.def as any)?.inputSchema]);

    // OPTIMIZED: Only compute JSON when viewing JSON (expensive operation)
    const jsonViewData = useMemo((): {
      jsonString: string;
      lines: string[];
    } => {
      if (!step || !showJsonView) return { jsonString: "", lines: [] };
      const jsonString = JSON.stringify(step, null, 2);
      const lines = jsonString.split("\n");
      return { jsonString, lines };
    }, [step, showJsonView]);

    // OPTIMIZED: Extract stable values to reduce callback recreation
    const stepName = step?.def?.name;
    const stepExecute = (step?.def as any)?.execute;
    const stepInputSchema = (step?.def as any)?.inputSchema;
    const stepOutputSchema = (step?.def as any)?.outputSchema;
    const stepInput = (step?.def as any)?.input;

    // OPTIMIZED: Get step index and all steps, then compute previous results locally
    const stepIndex = useWorkflowStepIndex(stepName || "");
    const allSteps = useWorkflowStepsArray();

    // Memoize previous step results - only recompute when steps before this one change
    const previousStepResults = useMemo(() => {
      if (stepIndex <= 0) return {};

      const results: Record<string, unknown> = {};
      const previousSteps = allSteps.slice(0, stepIndex);

      previousSteps.forEach((prevStep: WorkflowStep) => {
        if (
          prevStep.output &&
          typeof prevStep.output === "object" &&
          "success" in prevStep.output &&
          prevStep.output.success &&
          "output" in prevStep.output
        ) {
          const stepId = prevStep.def?.id || "";
          results[stepId as string] = (
            prevStep.output as { output: unknown }
          ).output;
        }
      });

      return results;
    }, [stepIndex, allSteps]);

    // Memoize workflow steps for @ref resolution (name-to-id mapping)
    const workflowSteps = useMemo(() => {
      return allSteps.map((s: WorkflowStep) => ({
        id: (s.def?.id as string) || "",
        name: s.def?.name || "",
      }));
    }, [allSteps]);

    // PERFORMANCE: Memoize the execute step handler with stable dependencies
    const handleExecuteStep = useCallback(() => {
      if (!step || !stepName) return;

      executeStepMutation.mutate(
        {
          step: {
            id: stepName,
            name: stepName,
            execute: (stepExecute || "") as string,
            inputSchema: (stepInputSchema || {}) as any,
            outputSchema: (stepOutputSchema || {}) as any,
            input: (stepInput || {}) as any,
          },
          previousStepResults,
          workflowSteps,
          authToken,
        },
        {
          onSuccess: async (result) => {
            const resolvedResult = await result;
            // Store the entire execution result (includes success, output, logs, duration)
            // This allows the UI to show execution details
            workflowActions.updateStep(stepName, {
              output: resolvedResult as unknown as Record<string, unknown>,
            } as any);
          },
          onError: (error) => {
            const errorData: Record<string, unknown> = {
              error: String(error),
            };
            workflowActions.updateStep(stepName, {
              output: errorData,
            } as any);
          },
        },
      );
    }, [
      step,
      stepName,
      stepExecute,
      stepInputSchema,
      stepOutputSchema,
      stepInput,
      previousStepResults,
      workflowSteps,
      authToken,
      executeStepMutation.mutate, // IMPORTANT: Only depend on .mutate function, not entire mutation object
      workflowActions,
    ]);

    // PERFORMANCE: Memoize the handler for creating input views
    const handleCreateInputView = useCallback((key: string) => {
      setCreatingInputViewFor(key);
    }, []);

    if (!step) return null;

    if (compact) {
      return (
        <div className="rounded-xl border bg-card p-3 w-[320px] shadow-sm hover:shadow-md transition-shadow cursor-pointer">
          <Handle
            type="target"
            position={Position.Left}
            style={{ opacity: 0 }}
          />
          <Handle
            type="source"
            position={Position.Right}
            style={{ opacity: 0 }}
          />
          <div className="flex items-start gap-2">
            <Icon
              name={"build"}
              size={18}
              className="text-muted-foreground flex-shrink-0 mt-0.5"
            />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-foreground truncate">
                {step.def?.name}
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                {step.def?.description}
              </div>
            </div>
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 bg-muted-foreground`}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="bg-foreground border border-border rounded-xl p-[2px] w-[640px]">
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle
          type="source"
          position={Position.Right}
          style={{ opacity: 0 }}
        />

        {/* Header */}
        <div className="flex items-center justify-between h-10 px-4 py-2 rounded-t-xl overflow-clip">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Icon
              name={"build"}
              size={16}
              className="shrink-0 text-background"
            />
            <span className="text-sm font-medium text-background leading-5 truncate">
              {step.def?.name}
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
                    // TODO: Implement duplicate functionality
                    void 0;
                  }}
                >
                  <Icon name="content_copy" size={16} className="mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const newTitle = prompt("Enter new name:", step?.def?.name);
                    if (newTitle) {
                      // TODO: Implement rename functionality
                      void 0;
                    }
                  }}
                >
                  <Icon name="edit" size={16} className="mr-2" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    if (step && confirm(`Delete step "${step.def?.name}"?`)) {
                      workflowActions.removeStep(step.def?.name as string);
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
          {showJsonView && (
            <JsonView
              jsonString={jsonViewData.jsonString}
              lines={jsonViewData.lines}
            />
          )}
          {!showJsonView && stepName && (
            <StepFormView
              step={step}
              stepName={stepName}
              inputSchemaEntries={inputSchemaEntries}
              workflowActions={workflowActions}
              onCreateInputView={handleCreateInputView}
            />
          )}

          {/* Execute Button Section */}
          <div className="bg-background border-b border-border p-4">
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3"
            >
              {/* Execution Status Indicator */}
              {hasSuccessOutput((step as any).output) && (
                <StepSuccessIndicator />
              )}
              {hasErrorOutput((step as any).output) && <StepErrorIndicator />}

              <div className="flex-1" />

              {/* Execute Button */}
              <Button
                onClick={handleExecuteStep}
                disabled={executeStepMutation.isPending}
                className="bg-primary-light text-primary-dark hover:bg-[#c5e015] h-8 px-3 py-2 rounded-xl text-sm font-medium leading-5 nodrag disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {executeStepMutation.isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-dark/20 border-t-primary-dark rounded-full animate-spin" />
                    Executing...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Icon name="play_arrow" size={16} />
                    Execute step
                  </span>
                )}
              </Button>
            </div>

            {/* Error Details */}
            {hasErrorOutput((step as any).output) && (
              <StepError error={(step as any).output.error} />
            )}
          </div>
        </div>

        {/* Render Input View Modal */}
        {renderingInputView && step && (
          <RenderInputViewModal
            step={{ name: step.def?.name || "", output: (step as any).output }}
            fieldName={renderingInputView.fieldName}
            viewName={renderingInputView.viewName}
            viewCode={renderingInputView.viewCode}
            open={!!renderingInputView}
            onOpenChange={(open) => {
              if (!open) setRenderingInputView(null);
            }}
            onSubmit={(_data) => {
              // Update the field value
            }}
          />
        )}

        {/* Render Output View - only if output exists and has success property */}
        {hasExecutionResult((step as any).output) && (
          <StepOutput step={(step as any).output} />
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // PERFORMANCE: Custom comparison to prevent re-renders
    // Only re-render if stepId actually changes (string comparison)
    return prevProps.data.stepId === nextProps.data.stepId;
  },
);
