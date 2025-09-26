import { useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useWorkflowContext } from "../../../contexts/workflow-context.tsx";

export function DeveloperBar() {
  const { state, dispatch } = useWorkflowContext();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleClose = () => {
    dispatch({ type: "TOGGLE_DEV_BAR" });
  };

  return (
    <div
      className={`
        border-t bg-white transition-all duration-300
        ${isCollapsed ? "h-12" : "h-64"}
      `}
    >
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b bg-muted">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Developer Tools</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1"
          >
            {isCollapsed ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>

        <Button variant="ghost" size="sm" onClick={handleClose} className="p-1">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="h-52 overflow-hidden">
          <Tabs
            value={state.devBarTab}
            onValueChange={(value) =>
              dispatch({
                type: "SET_DEV_TAB",
                payload: value as typeof state.devBarTab,
              })
            }
            className="h-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="state">State</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="debug">Debug</TabsTrigger>
            </TabsList>

            <div className="h-40 overflow-auto p-4">
              <TabsContent value="state" className="mt-0">
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Execution Context
                  </h4>

                  {/* Visual representation of execution state */}
                  <div className="space-y-2">
                    {state.workflow.steps.map((step, index) => {
                      const result = state.executionResults[step.def.name];
                      const hasExecuted = !!result;
                      const hasError = result?.error;

                      return (
                        <div
                          key={step.def.name}
                          className={`
                            p-2 rounded border text-xs
                            ${
                              hasError
                                ? "bg-destructive/10 border-destructive/20"
                                : hasExecuted
                                  ? "bg-success/10 border-success/20"
                                  : "bg-muted border-border"
                            }
                          `}
                        >
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <span
                                className={`
                                inline-block w-2 h-2 rounded-full
                                ${
                                  hasError
                                    ? "bg-destructive/100"
                                    : hasExecuted
                                      ? "bg-success/100"
                                      : "bg-muted-foreground"
                                }
                              `}
                              />
                              <span className="font-semibold">
                                {step.def.name || `Step ${index + 1}`}
                              </span>
                            </div>
                            {result && (
                              <span className="text-muted-foreground">
                                {new Date(
                                  result.executedAt,
                                ).toLocaleTimeString()}
                              </span>
                            )}
                          </div>

                          {result && (
                            <div className="ml-4 mt-1">
                              {hasError ? (
                                <div className="text-destructive">
                                  Error: {result.error}
                                </div>
                              ) : (
                                <details className="cursor-pointer">
                                  <summary className="text-muted-foreground hover:text-foreground">
                                    View result ({result.duration}ms)
                                  </summary>
                                  <pre className="mt-1 p-2 bg-white rounded text-xs overflow-x-auto">
                                    {JSON.stringify(result.value, null, 2)}
                                  </pre>
                                </details>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {state.workflow.steps.length === 0 && (
                      <div className="text-muted-foreground text-center py-2">
                        No steps in workflow
                      </div>
                    )}
                  </div>

                  {/* Summary stats */}
                  <div className="pt-2 border-t text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Total Steps:</span>
                      <span className="font-medium">
                        {state.workflow.steps.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Executed:</span>
                      <span className="font-medium text-success">
                        {
                          Object.keys(state.executionResults).filter(
                            (id) => !state.executionResults[id].error,
                          ).length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Failed:</span>
                      <span className="font-medium text-destructive">
                        {
                          Object.keys(state.executionResults).filter(
                            (id) => state.executionResults[id].error,
                          ).length
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="config" className="mt-0">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Workflow Configuration
                  </h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(
                      {
                        name: state.workflow.name,
                        description: state.workflow.description,
                        stepsCount: state.workflow.steps.length,
                        hasInputSchema: !!state.workflow.inputSchema,
                        hasOutputSchema: !!state.workflow.outputSchema,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="logs" className="mt-0">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Execution Logs
                  </h4>
                  <div className="text-xs font-mono space-y-1">
                    {Object.entries(state.executionResults).map(
                      ([stepId, result]) => (
                        <div key={stepId} className="flex gap-2">
                          <span className="text-muted-foreground">
                            [{new Date(result.executedAt).toLocaleTimeString()}]
                          </span>
                          <span
                            className={
                              result.error ? "text-destructive" : "text-success"
                            }
                          >
                            {stepId}:
                          </span>
                          <span className="text-foreground">
                            {result.error || "Success"}
                          </span>
                        </div>
                      ),
                    )}
                    {Object.keys(state.executionResults).length === 0 && (
                      <span className="text-muted-foreground">
                        No execution logs yet
                      </span>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="debug" className="mt-0">
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase">
                    Debug Information
                  </h4>
                  <pre className="text-xs bg-muted p-3 rounded overflow-x-auto">
                    {JSON.stringify(
                      {
                        currentStep:
                          state.workflow.steps[state.currentStepIndex]?.def.name,
                        isEditing: state.isEditing,
                        editingStepId: state.editingStepId,
                        lastSaved: state.lastSaved,
                        error: state.error,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </div>
  );
}
