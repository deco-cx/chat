/**
 * WORKFLOWS - Main Workflow Builder Page
 *
 * Layout: Golden layout with resizable panels
 * - Left: Tool catalog
 * - Center: Step editor with tabs
 * - Right: Execution monitor (toggle)
 */

import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useQuery } from "@tanstack/react-query";
import { createRoute, useSearch } from "@tanstack/react-router";
import { AlertCircle, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { CreateViewModal } from "../components/CreateViewModal";
import { IframeViewRenderer } from "../components/IframeViewRenderer";
import { RichTextEditor } from "../components/RichTextEditor";
import { ToolList } from "../components/ToolList";
import { WorkflowLayout } from "../components/WorkflowLayout";
import { useExecuteStep } from "../hooks/useExecuteStep";
import { useExecuteWorkflow } from "../hooks/useExecuteWorkflow";
import { useGenerateStep } from "../hooks/useGenerateStep";
import { useIntegrations } from "../hooks/useIntegrations";
import { useMentionItems } from "../hooks/useMentionItems";
import { client } from "../lib/rpc";
import { rootRoute } from "../main";
import { useWorkflowStore } from "../store/workflowStore";
import type { Workflow, WorkflowStep } from "../types/workflow";

function WorkflowsPage() {
  // Read resourceURI from search params
  const searchParams = useSearch({ from: "/workflow" });
  const resourceURI = (searchParams as { resourceURI?: string })?.resourceURI;

  // Fetch workflow from API if resourceURI is provided
  const {
    data: workflowData,
    isLoading: isLoadingWorkflow,
    error: workflowError,
  } = useQuery({
    queryKey: ["workflow", resourceURI],
    queryFn: async () => {
      if (!resourceURI) return null;
      return await client.DECO_RESOURCE_WORKFLOW_READ({ uri: resourceURI });
    },
    enabled: !!resourceURI,
  });

  // Show missing param page if no resourceURI
  if (!resourceURI) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="max-w-md p-8 rounded-xl border border-border bg-card/50 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-foreground">
            Missing Parameter
          </h2>
          <p className="text-muted-foreground mb-4">
            No workflow resource URI provided. Please provide a{" "}
            <code className="px-2 py-1 bg-muted rounded text-sm">
              resourceURI
            </code>{" "}
            search parameter.
          </p>
          <p className="text-sm text-muted-foreground/70">
            Example:{" "}
            <code className="px-2 py-1 bg-muted rounded text-xs">
              /workflow?resourceURI=workflow://my-workflow
            </code>
          </p>
        </div>
      </div>
    );
  }

  // Show loading state
  if (isLoadingWorkflow) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p>Loading workflow...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (workflowError) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="max-w-md p-8 rounded-xl border border-destructive/50 bg-destructive/10 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-3 text-destructive">
            Failed to Load Workflow
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            {workflowError instanceof Error
              ? workflowError.message
              : String(workflowError)}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Resource URI:{" "}
            <code className="px-2 py-1 bg-muted rounded">{resourceURI}</code>
          </p>
        </div>
      </div>
    );
  }

  // If no workflow data, show error
  if (!workflowData) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <div className="text-center">
          <p>No workflow data found</p>
        </div>
      </div>
    );
  }

  // Render the workflow
  return <WorkflowPageContent workflowData={workflowData} />;
}

function WorkflowPageContent({
  workflowData,
}: {
  workflowData: {
    uri: string;
    data: { name: string; description: string; steps: any[] };
  };
}) {
  const [copied, setCopied] = useState(false);

  const store = useWorkflowStore();

  // 🐛 BISECT: Initialize workflow from API data ONCE using useEffect
  const workflow = useWorkflowStore(
    (state) => state.storage.workflows[workflowData.uri],
  );

  // Import workflow on mount if it doesn't exist
  useEffect(() => {
    if (!workflow) {
      console.log("🔄 Importing workflow from API data");
      const importedWorkflow: Workflow = {
        id: workflowData.uri,
        name: workflowData.data.name,
        description: workflowData.data.description,
        steps: workflowData.data.steps.map((step: any, index: number) => ({
          id: `step-${index}`,
          title: step.name || `Step ${index + 1}`,
          description: step.description || "",
          status: "pending" as const,
          toolCalls: [], // No longer using separate tool calls
          code: step.execute,
          inputSchema: step.inputSchema || {},
          outputSchema: step.outputSchema || {},
          input: step.input || {},
          dependencies: step.dependencies || [],
          options: step.options,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
        currentStepIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      store.importWorkflow(importedWorkflow);
    }
  }, [workflowData.uri, workflow, store]);
  const isPlaying = useWorkflowStore((state) => state.isPlaying);
  const editingCode = useWorkflowStore((state) => state.editingCode);
  const editedCode = useWorkflowStore((state) => state.editedCode);
  const prompt = useWorkflowStore((state) => state.prompt);
  const inputValues = useWorkflowStore((state) => state.inputValues);
  const creatingView = useWorkflowStore((state) => state.creatingView);
  const activeView = useWorkflowStore((state) => state.activeView);

  // React Query hooks
  const { data: integrations = [] } = useIntegrations();

  // Generate mention items for Tiptap (tools + previous steps)
  const mentions = useMentionItems(workflow);
  const generateStepMutation = useGenerateStep();
  const executeStepMutation = useExecuteStep();
  const executeWorkflowMutation = useExecuteWorkflow(
    (stepId, status, output) => {
      console.log("📍 Step status update:", stepId, status, output);
      if (workflow) {
        store.updateStep(workflow.id, stepId, {
          status,
          ...(output !== undefined ? { output } : {}),
        });
      }
    },
  );

  if (!workflow) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400">
        Loading...
      </div>
    );
  }

  console.log("🎨 WorkflowsPage render:", {
    workflowId: workflow.id,
    steps: workflow.steps.length,
    currentStepIndex: workflow.currentStepIndex,
    stepStatuses: workflow.steps.map((s) => ({ id: s.id, status: s.status })),
  });

  const handleNavigate = (index: number) => {
    console.log("Navigate to step:", index);
    store.setCurrentStepIndex(workflow.id, index);
  };

  const handleAddStep = () => {
    console.log("➕ Add step - navigating to create form");
    // Navigate to create step form (index = steps.length shows create form)
    store.setCurrentStepIndex(workflow.id, workflow.steps.length);
  };

  const handleGenerateStep = () => {
    if (!prompt.trim()) {
      console.warn("⚠️ Empty prompt, not generating step");
      return;
    }

    console.log("⚡ [WorkflowPage] Generating step with prompt:", prompt);

    const previousSteps = workflow.steps.map((step: WorkflowStep) => ({
      id: step.id,
      name: step.title,
      outputSchema: step.outputSchema || {},
    }));

    generateStepMutation.mutate(
      { objective: prompt, previousSteps },
      {
        onSuccess: (generatedStep) => {
          console.log("✅ Step generated successfully:", generatedStep);

          // The API returns {step: {...}, reasoning: '...'} so we need to access .step
          const step = generatedStep.step;

          console.log("💾 [WorkflowPage] Adding generated step to store");
          console.log("💾 [WorkflowPage] Step data:", step);

          store.addStep(workflow.id, {
            title: step.name,
            description: step.description,
            status: "pending",
            toolCalls: step.primaryTool ? [step.primaryTool] : [],
            icon: step.icon,
            inputSchema: step.inputSchema,
            outputSchema: step.outputSchema,
            input: step.input,
            inputDescription: step.inputDescription,
            code: step.code,
            inputView: step.inputView,
            outputView: step.outputView,
          });

          // Navigate to the newly created step
          store.setCurrentStepIndex(workflow.id, workflow.steps.length);
          store.setPrompt("");
        },
        onError: (error) => {
          console.error("❌ Failed to generate step:", error);
        },
      },
    );
  };

  const handleExecuteStep = () => {
    const currentStep = workflow.steps[workflow.currentStepIndex];
    if (!currentStep) return;

    console.log("▶️ Execute single step:", currentStep.title);

    // Build previous step results
    // Format: { stepId: stepOutput } where stepOutput is the raw output object
    const previousStepResults: Record<string, unknown> = {};
    workflow.steps.slice(0, workflow.currentStepIndex).forEach((step) => {
      if (step.output) {
        // Pass the output directly (not wrapped in { output: ... })
        // The @ref will be: @stepId.output.field, and resolver expects stepResults[stepId] to BE the output
        previousStepResults[step.id] = step.output;
      }
    });

    executeStepMutation.mutate(
      {
        step: currentStep,
        previousStepResults,
        globalInput: {},
      },
      {
        onSuccess: (result) => {
          console.log("✅ Step executed successfully:", result);
          store.updateStep(workflow.id, currentStep.id, {
            status: "completed",
            output: result.output,
            logs: result.logs,
            duration: result.duration,
          });
        },
        onError: (error) => {
          console.error("❌ Step execution failed:", error);
          store.updateStep(workflow.id, currentStep.id, {
            status: "error",
            error: error instanceof Error ? error.message : String(error),
          });
        },
      },
    );
  };

  const handleRunWorkflow = async () => {
    console.log(
      "🚀 Run full workflow sequentially:",
      workflow.id,
      workflow.steps,
    );

    // Reset all step statuses first
    workflow.steps.forEach((step) => {
      store.updateStep(workflow.id, step.id, {
        status: "pending",
        error: undefined,
        output: undefined,
        logs: undefined,
        duration: undefined,
      });
    });

    // Execute steps sequentially
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      console.log(
        `▶️ Executing step ${i + 1}/${workflow.steps.length}: ${step.title}`,
      );

      // Set status to active
      store.updateStep(workflow.id, step.id, { status: "active" });

      try {
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
            const userValue = store.inputValues[inputKey];
            const storedValue = step.input?.[key];

            // Use user-edited value if exists, otherwise use stored value
            resolvedInput[key] =
              userValue !== undefined ? userValue : storedValue;
          }
        }

        // Build previous steps map
        const previousStepResults: Record<string, unknown> = {};
        for (let j = 0; j < i; j++) {
          const prevStep = workflow.steps[j];
          if (prevStep.output !== undefined) {
            previousStepResults[prevStep.id] = prevStep.output;
          }
        }

        // Execute the step
        const result = await new Promise<{
          success: boolean;
          output?: unknown;
          error?: unknown;
          logs?: unknown;
          duration?: number;
        }>((resolve, reject) => {
          executeStepMutation.mutate(
            {
              step: { ...step, input: resolvedInput },
              previousStepResults,
            },
            {
              onSuccess: (result) => {
                console.log(`✅ Step ${i + 1} completed:`, result);
                store.updateStep(workflow.id, step.id, {
                  status: result.success ? "completed" : "error",
                  output: result.output,
                  error: result.success ? undefined : String(result.error),
                  logs: result.logs,
                  duration: result.duration,
                });
                resolve(result);
              },
              onError: (error) => {
                console.error(`❌ Step ${i + 1} failed:`, error);
                store.updateStep(workflow.id, step.id, {
                  status: "error",
                  error: String(error),
                });
                reject(error);
              },
            },
          );
        });

        // If step failed, stop execution
        if (!(result as { success: boolean }).success) {
          console.log(`🛑 Workflow stopped at step ${i + 1} due to error`);
          break;
        }
      } catch (error) {
        console.error(`❌ Step ${i + 1} execution failed:`, error);
        store.updateStep(workflow.id, step.id, {
          status: "error",
          error: String(error),
        });
        break;
      }
    }

    console.log("🎉 Sequential workflow execution completed");
  };

  const handleToolClick = (toolId: string) => {
    console.log("🔧 [WorkflowPage] Tool clicked:", toolId);
    store.setPrompt(prompt + ` @${toolId}`);
  };

  const handleExportWorkflow = () => {
    try {
      // Export complete workflow with all execution data
      const workflowData = {
        ...workflow,
        steps: workflow.steps.map((step) => ({
          ...step,
          // Ensure output, logs, duration are included
          output: step.output,
          logs: step.logs,
          duration: step.duration,
        })),
        exportedAt: new Date().toISOString(),
      };

      const json = JSON.stringify(workflowData, null, 2);

      // Show JSON in window.prompt() for easy select-all and copy
      globalThis.prompt(
        "📋 Workflow JSON (Ctrl+A to select all, Ctrl+C to copy):",
        json,
      );

      // Also copy to clipboard
      navigator.clipboard.writeText(json).then(() => {
        console.log("✅ Workflow copied to clipboard");
      });

      // Also download as file
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `workflow-${workflow.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("✅ Workflow exported:", workflow.id);
      console.log("📋 Full Workflow JSON:\n", json);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("❌ Failed to export workflow:", error);
      alert("Failed to export workflow");
    }
  };

  const handleImportWorkflow = (workflowData: typeof workflow) => {
    try {
      console.log("📥 [WorkflowPage] Importing workflow:", workflowData.id);
      console.log("📥 [WorkflowPage] Steps:", workflowData.steps?.length);

      // Normalize steps - add missing fields & clean @ref:globalInput
      const normalizedSteps = (workflowData.steps || []).map((step: any) => {
        console.log("🔧 [Import] Normalizing step:", step.name || step.title);

        // Preserve execution data: output, logs, duration, status
        const executionData = {
          output: step.output,
          logs: step.logs || [],
          duration: step.duration,
          status: step.status || "pending",
        };

        // Clean input: replace @ref:globalInput.field with empty string
        const cleanedInput: Record<string, any> = {};
        const inputDescription: Record<string, string> = {};

        if (step.input) {
          for (const [key, value] of Object.entries(step.input)) {
            if (
              typeof value === "string" &&
              value.startsWith("@ref:globalInput.")
            ) {
              cleanedInput[key] = "";
              const fieldName = value.replace("@ref:globalInput.", "");
              inputDescription[key] =
                `Required: ${fieldName} from global input`;
              console.log("🧹 [Import] Cleaned @ref:globalInput:", key);
            } else {
              cleanedInput[key] = value;
            }
          }
        }

        return {
          ...step,
          ...executionData, // First, so can be overwritten
          title: step.title || step.name || "Untitled Step",
          toolCalls: step.toolCalls || [],
          input:
            Object.keys(cleanedInput).length > 0 ? cleanedInput : step.input,
          inputDescription:
            Object.keys(inputDescription).length > 0
              ? inputDescription
              : step.inputDescription,
          createdAt: step.createdAt || new Date().toISOString(),
          updatedAt: step.updatedAt || new Date().toISOString(),
        };
      });

      const normalizedWorkflow = {
        ...workflowData,
        steps: normalizedSteps,
        currentStepIndex: workflowData.currentStepIndex || 0,
        createdAt: workflowData.createdAt || new Date().toISOString(),
        updatedAt: workflowData.updatedAt || new Date().toISOString(),
      };

      console.log("✅ [WorkflowPage] Workflow normalized");

      // Update Zustand store with imported workflow
      store.importWorkflow(normalizedWorkflow);
      console.log("✅ Workflow imported successfully:", workflowData.id);

      // Navigate to first step or create form
      store.setCurrentStepIndex(normalizedWorkflow.id, 0);
    } catch (error) {
      console.error("❌ Failed to import workflow:", error);
      alert(
        `Failed to import workflow: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };

  const handleInsertReference = (stepIndex: number, fieldPath?: string) => {
    const step = workflow.steps[stepIndex];
    const ref = fieldPath
      ? `@${step.id}.output.${fieldPath}`
      : `@${step.id}.output`;

    const newValue = prompt ? `${prompt} ${ref}` : ref;
    store.setPrompt(newValue);

    console.log(
      "📌 [WorkflowPage] Reference inserted:",
      ref,
      "for step:",
      step.id,
    );

    // Navigate to create step form if not already there
    if (workflow.currentStepIndex < workflow.steps.length) {
      store.setCurrentStepIndex(workflow.id, workflow.steps.length);
    }
  };

  const handlePlayerPrevious = () => {
    if (workflow.currentStepIndex > 0) {
      store.setCurrentStepIndex(workflow.id, workflow.currentStepIndex - 1);
    }
  };

  const handlePlayerNext = () => {
    if (workflow.currentStepIndex < workflow.steps.length) {
      store.setCurrentStepIndex(workflow.id, workflow.currentStepIndex + 1);
    }
  };

  const handlePlayerPlayPause = () => {
    if (workflow.steps.length === 0) return;

    store.setIsPlaying(!isPlaying);

    if (!isPlaying) {
      // Start auto-play from current step
      console.log("▶️ Auto-play started");
      // TODO: Implement auto-execution of steps
    } else {
      console.log("⏸️ Auto-play paused");
    }
  };

  const handlePlayerSeek = (stepIndex: number) => {
    store.setCurrentStepIndex(workflow.id, stepIndex);
  };

  // Render components
  const toolCatalogComponent = (
    <ToolList integrations={integrations} onToolClick={handleToolClick} />
  );

  const shouldShowCreateForm =
    !workflow.steps ||
    workflow.steps.length === 0 ||
    workflow.currentStepIndex >= workflow.steps.length;
  console.log("🎯 [StepEditor] Decision:", {
    hasSteps: !!workflow.steps,
    stepsLength: workflow.steps?.length,
    currentStepIndex: workflow.currentStepIndex,
    shouldShowCreateForm,
    currentStepData: workflow.steps?.[workflow.currentStepIndex],
  });

  const stepEditorComponent = shouldShowCreateForm ? (
    // Create new step - Notion style!
    <div className="max-w-[900px] mx-auto mt-20 px-12">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-3">
          <h2 className="text-4xl font-bold m-0 text-foreground">
            Create New Step
          </h2>
          <p className="text-lg text-muted-foreground m-0">
            Describe what you want to accomplish and AI will generate the code.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <label className="block text-base font-medium mb-3 text-foreground">
              What should this step do?
            </label>
            <RichTextEditor
              value={prompt}
              onChange={(value) => store.setPrompt(value)}
              placeholder="Example: Extract payment information from PDF document... Type @ to mention tools or steps"
              mentions={mentions}
              minHeight="200px"
            />
            <p className="mt-2 text-sm text-muted-foreground">
              Tip: Use @tool-name to reference tools, @step-N for previous steps
            </p>
          </div>

          <Button
            onClick={handleGenerateStep}
            disabled={!prompt.trim() || generateStepMutation.isPending}
            variant="default"
            size="lg"
            className="w-full"
          >
            {generateStepMutation.isPending ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                Generating...
              </span>
            ) : (
              "⚡ Generate Step with AI"
            )}
          </Button>

          {generateStepMutation.isError && (
            <div className="p-5 bg-destructive/10 border border-destructive/50 rounded-xl">
              <p className="text-sm text-destructive m-0">
                {generateStepMutation.error?.message ||
                  "Failed to generate step"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  ) : (
    // View existing step
    <div className="max-w-[1000px] mx-auto my-16 px-12">
      <div className="flex flex-col gap-10">
        {/* Step Header */}
        <div className="flex flex-col gap-2">
          <h2 className="text-3xl font-bold m-0 text-foreground">
            {workflow.steps[workflow.currentStepIndex].title}
          </h2>
          <p className="text-base text-muted-foreground m-0">
            {workflow.steps[workflow.currentStepIndex].description}
          </p>
        </div>

        {/* Tool Info */}
        {workflow.steps[workflow.currentStepIndex]?.toolCalls?.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
              Tools Used
            </h3>
            <div className="flex gap-2">
              {workflow.steps[workflow.currentStepIndex].toolCalls.map(
                (tool: string) => (
                  <span
                    key={tool}
                    className="px-3 py-1.5 bg-card border border-border text-primary text-xs font-mono rounded-md"
                  >
                    {tool}
                  </span>
                ),
              )}
            </div>
          </div>
        )}

        {/* Input Schema Form */}
        {workflow.steps[workflow.currentStepIndex]?.inputSchema && (
          <div>
            <h3 className="text-xs font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
              Input Parameters
            </h3>
            <div className="rounded-xl border border-border bg-card/50 p-6 flex flex-col gap-6">
              {Object.entries(
                (
                  workflow.steps[workflow.currentStepIndex]
                    .inputSchema as Record<string, unknown>
                ).properties || {},
              ).map(([key, schema]: [string, unknown]) => {
                const schemaObj = schema as Record<string, unknown>;
                const currentValue =
                  workflow.steps[workflow.currentStepIndex].input?.[key];
                const description =
                  typeof schemaObj.description === "string"
                    ? schemaObj.description
                    : "";
                const inputKey = `${workflow.steps[workflow.currentStepIndex].id}_${key}`;
                const displayValue =
                  inputValues[inputKey] !== undefined
                    ? inputValues[inputKey]
                    : typeof currentValue === "string"
                      ? currentValue
                      : JSON.stringify(currentValue) || "";

                const inputDesc =
                  workflow.steps[workflow.currentStepIndex].inputDescription;

                return (
                  <div key={key}>
                    <div className="flex items-center gap-2 mb-2">
                      <label className="text-base font-medium m-0 text-foreground">
                        {key}
                      </label>
                      {inputDesc?.[key] && (
                        <span className="text-xs text-muted-foreground">
                          📍 {inputDesc[key]}
                        </span>
                      )}
                    </div>
                    {description && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {description}
                      </p>
                    )}
                    <Input
                      type="text"
                      value={displayValue}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        console.log(
                          "🔤 [WorkflowPage] Input changed:",
                          key,
                          newValue,
                        );

                        store.setInputValue(inputKey, newValue);

                        // Update Zustand store
                        const currentInput =
                          workflow.steps[workflow.currentStepIndex].input || {};
                        store.updateStep(
                          workflow.id,
                          workflow.steps[workflow.currentStepIndex].id,
                          {
                            input: { ...currentInput, [key]: newValue },
                          },
                        );
                      }}
                      placeholder={`Enter ${key}...`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-4 pt-6 border-t border-border">
          <Button
            onClick={handleExecuteStep}
            disabled={executeStepMutation.isPending}
            variant="default"
            size="default"
            className="flex items-center gap-2"
          >
            <Play
              size={18}
              fill={executeStepMutation.isPending ? "none" : "currentColor"}
            />
            {executeStepMutation.isPending ? "Executing..." : "Execute Step"}
          </Button>
          <Button
            onClick={() => {
              console.log("📝 [WorkflowPage] Opening step JSON editor");
              // Serialize entire step as JSON
              const stepJson = JSON.stringify(
                workflow.steps[workflow.currentStepIndex],
                null,
                2,
              );
              store.setEditingCode(true, stepJson);
            }}
            variant="secondary"
            size="default"
          >
            📝 Edit as JSON
          </Button>
        </div>

        {/* Code Editor Modal */}
        {editingCode && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                console.log(
                  "🚪 [WorkflowPage] Closing code editor (click outside)",
                );
                store.setEditingCode(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                console.log("🚪 [WorkflowPage] Closing code editor (Escape)");
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
                      "🚪 [WorkflowPage] Closing code editor (close button)",
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
                    console.log(
                      "✏️ [WorkflowPage] Code edited, length:",
                      e.target.value.length,
                    );
                    store.setEditingCode(true, e.target.value);
                  }}
                  spellCheck={false}
                  className="w-full min-h-[400px] p-5 bg-card border border-border rounded-xl text-sm font-mono text-foreground leading-relaxed resize-vertical focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  placeholder='{\n  "title": "Step Name",\n  "code": "export default...",\n  "input": {...},\n  "inputSchema": {...},\n  "outputSchema": {...}\n}'
                />
              </div>

              {/* Modal Footer */}
              <div className="p-5 px-8 border-t border-border flex gap-3 justify-end">
                <Button
                  onClick={() => {
                    console.log("❌ [WorkflowPage] Code edit cancelled");
                    store.setEditingCode(false);
                  }}
                  variant="secondary"
                  size="default"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    console.log("💾 [WorkflowPage] Saving step JSON changes");

                    try {
                      const updatedStep = JSON.parse(editedCode);
                      console.log("✅ [WorkflowPage] JSON parsed successfully");

                      // Update entire step with parsed JSON
                      store.updateStep(
                        workflow.id,
                        workflow.steps[workflow.currentStepIndex].id,
                        {
                          ...updatedStep,
                          id: workflow.steps[workflow.currentStepIndex].id, // Keep original ID
                          updatedAt: new Date().toISOString(),
                        },
                      );

                      console.log("✅ [WorkflowPage] Step updated from JSON");
                      store.setEditingCode(false);
                    } catch (error) {
                      console.error("❌ [WorkflowPage] Invalid JSON:", error);
                      alert(
                        `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
                      );
                    }
                  }}
                  variant="default"
                  size="default"
                >
                  💾 Save JSON
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Execution Result */}
        {workflow.steps[workflow.currentStepIndex].output !== undefined && (
          <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
            <div className="p-4 px-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-xs font-semibold m-0 text-muted-foreground uppercase tracking-wider">
                  Execution Result
                </h3>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded uppercase ${
                    workflow.steps[workflow.currentStepIndex].status ===
                    "completed"
                      ? "bg-success/10 text-success"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {workflow.steps[workflow.currentStepIndex].status ===
                  "completed"
                    ? "✓ Success"
                    : "✗ Failed"}
                </span>
              </div>
              <Button
                onClick={() => {
                  const resultData = {
                    success:
                      workflow.steps[workflow.currentStepIndex].status ===
                      "completed",
                    output: workflow.steps[workflow.currentStepIndex].output,
                    error: workflow.steps[workflow.currentStepIndex].error,
                  };
                  navigator.clipboard.writeText(
                    JSON.stringify(resultData, null, 2),
                  );
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                variant={copied ? "default" : "secondary"}
                size="sm"
              >
                {copied ? "✓ Copied!" : "Copy JSON"}
              </Button>
            </div>

            <div className="p-6 max-h-[400px] overflow-y-auto">
              {workflow.steps[workflow.currentStepIndex].status ===
              "completed" ? (
                <div className="flex flex-col gap-5">
                  {/* Duration */}
                  {workflow.steps[workflow.currentStepIndex].duration !==
                    undefined && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        Duration:
                      </p>
                      <p className="text-sm text-muted-foreground font-mono">
                        {workflow.steps[workflow.currentStepIndex].duration}ms
                      </p>
                    </div>
                  )}

                  {/* Output */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider m-0">
                        Output:
                      </p>

                      <div className="flex gap-2 items-center">
                        {/* View Selector Tabs */}
                        <Button
                          onClick={() => store.setActiveView("json")}
                          variant={
                            activeView === "json" ? "default" : "secondary"
                          }
                          size="sm"
                        >
                          JSON
                        </Button>

                        {Object.keys(
                          workflow.steps[workflow.currentStepIndex]
                            .outputViews || {},
                        ).map((viewName) => (
                          <Button
                            key={viewName}
                            onClick={() => store.setActiveView(viewName)}
                            variant={
                              activeView === viewName ? "default" : "secondary"
                            }
                            size="sm"
                          >
                            {viewName}
                          </Button>
                        ))}

                        {/* Create View Button */}
                        <Button
                          onClick={() => {
                            console.log(
                              "🎨 [WorkflowPage] Opening create view modal",
                            );
                            store.setCreatingView(true);
                            // Auto-suggest next view name
                            const existingViews = Object.keys(
                              workflow.steps[workflow.currentStepIndex]
                                .outputViews || {},
                            );
                            const nextNum = existingViews.length + 1;
                            store.setNewViewName(`view${nextNum}`);
                          }}
                          disabled={
                            !workflow.steps[workflow.currentStepIndex].output
                          }
                          variant="secondary"
                          size="sm"
                          className="text-success"
                          title={
                            !workflow.steps[workflow.currentStepIndex].output
                              ? "Execute step first to create custom view"
                              : "Create custom view"
                          }
                        >
                          + Create View
                        </Button>
                      </div>
                    </div>

                    {activeView === "json" ? (
                      <pre className="text-sm text-success font-mono bg-card p-4 rounded-lg overflow-auto m-0 leading-relaxed">
                        {typeof workflow.steps[workflow.currentStepIndex]
                          .output === "object" &&
                        workflow.steps[workflow.currentStepIndex].output !==
                          null
                          ? JSON.stringify(
                              workflow.steps[workflow.currentStepIndex].output,
                              null,
                              2,
                            )
                          : String(
                              workflow.steps[workflow.currentStepIndex].output,
                            )}
                      </pre>
                    ) : (
                      <div className="bg-card p-5 rounded-lg border border-border">
                        <IframeViewRenderer
                          html={(() => {
                            const step =
                              workflow.steps[workflow.currentStepIndex];
                            const data =
                              typeof step.output === "object" &&
                              step.output !== null
                                ? (step.output as Record<string, unknown>)
                                : { value: step.output };

                            // Process outputView.script if present
                            if (
                              step.outputView?.html &&
                              step.outputView?.script
                            ) {
                              try {
                                const view = step.outputView;
                                const scriptFn = new Function(
                                  "data",
                                  "view",
                                  step.outputView.script,
                                );
                                return scriptFn(data, view);
                              } catch (err) {
                                console.error(
                                  "Error executing outputView script:",
                                  err,
                                );
                                return step.outputView.html; // Fallback to raw HTML
                              }
                            }

                            // Fallback to outputViews (new format) or empty
                            return step.outputViews?.[activeView] || "";
                          })()}
                          data={
                            typeof workflow.steps[workflow.currentStepIndex]
                              .output === "object" &&
                            workflow.steps[workflow.currentStepIndex].output !==
                              null
                              ? (workflow.steps[workflow.currentStepIndex]
                                  .output as Record<string, unknown>)
                              : {
                                  value:
                                    workflow.steps[workflow.currentStepIndex]
                                      .output,
                                }
                          }
                        />
                      </div>
                    )}
                  </div>

                  {/* Logs */}
                  {workflow.steps[workflow.currentStepIndex].logs &&
                    workflow.steps[workflow.currentStepIndex].logs!.length >
                      0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
                          Logs:
                        </p>
                        <div className="bg-card p-4 rounded-lg flex flex-col gap-2">
                          {workflow.steps[workflow.currentStepIndex].logs!.map(
                            (log, idx) => (
                              <div
                                key={idx}
                                className={`text-xs font-mono ${log.type === "error" ? "text-destructive" : "text-muted-foreground"}`}
                              >
                                <span className="text-muted-foreground">
                                  [{log.type}]
                                </span>{" "}
                                {log.content}
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-destructive mb-3 uppercase tracking-wider">
                    Error:
                  </p>
                  <pre className="text-sm text-destructive font-mono bg-card p-4 rounded-lg overflow-auto m-0 leading-relaxed">
                    {String(
                      workflow.steps[workflow.currentStepIndex].error ||
                        "Unknown error",
                    )}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Create View Modal */}
        {creatingView && (
          <CreateViewModal
            workflow={workflow}
            step={workflow.steps[workflow.currentStepIndex]}
            open={creatingView}
            onOpenChange={(open) => {
              if (!open) {
                console.log("🚪 [WorkflowPage] Closing create view modal");
                store.setCreatingView(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );

  const executionMonitorComponent = (
    <div className="p-4 ">
      <div className="mb-6">
        <h3 className="text-xl font-bold mb-2 text-foreground">
          Execution Monitor
        </h3>
        <p className="text-sm text-muted-foreground">
          Click outputs to insert references
        </p>
      </div>

      {!workflow.steps || workflow.steps.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground text-sm mb-2">
            No steps to execute
          </p>
          <p className="text-muted-foreground/60 text-xs">
            Create a step to get started
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {workflow.steps.map((step: WorkflowStep, index: number) => (
            <div
              key={step.id}
              className="rounded-xl border border-border bg-card p-5 hover:border-border/80 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1">
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5 ${
                      step.status === "completed"
                        ? "bg-success shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                        : step.status === "active"
                          ? "bg-primary shadow-[0_0_10px_rgba(34,211,238,0.5)] animate-pulse"
                          : step.status === "error"
                            ? "bg-destructive"
                            : "bg-muted-foreground"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-bold text-foreground mb-1">
                      {step.title || `Step ${index + 1}`}
                    </div>
                    {step.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed m-0">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-medium text-muted-foreground flex-shrink-0">
                  {step.status === "completed"
                    ? "✓ Done"
                    : step.status === "active"
                      ? "⏳ Running"
                      : step.status === "error"
                        ? "❌ Error"
                        : "⏸ Pending"}
                </span>
              </div>

              {step.output !== undefined && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground m-0">Output:</p>
                    <Button
                      onClick={() => handleInsertReference(index)}
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs text-primary border-primary/30 bg-primary/10 hover:bg-primary/20"
                      title="Insert reference to this output"
                    >
                      📌 Insert @ref
                    </Button>
                  </div>

                  {typeof step.output === "object" && step.output !== null ? (
                    <div className="flex flex-col gap-2">
                      {Object.entries(step.output).map(([key, value]) => (
                        <Button
                          key={key}
                          onClick={() => handleInsertReference(index, key)}
                          variant="outline"
                          size="sm"
                          className="text-left justify-start h-auto py-2.5 px-3 text-xs font-mono bg-card border-border hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                          title={`Insert @step${index + 1}.output.${key}`}
                        >
                          <span className="text-muted-foreground">{key}:</span>{" "}
                          <span className="text-success">
                            {typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                          </span>
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleInsertReference(index)}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto py-3 px-3 text-xs font-mono bg-card border-border text-success hover:border-primary hover:shadow-lg hover:shadow-primary/20"
                      title={`Insert @step${index + 1}.output`}
                    >
                      {String(step.output)}
                    </Button>
                  )}
                </div>
              )}

              {step.error && (
                <div className="mt-3 pt-3 border-t border-destructive/50">
                  <p className="text-xs text-destructive font-mono">
                    {String(step.error)}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <WorkflowLayout
      workflow={workflow}
      currentStepIndex={workflow.currentStepIndex}
      onNavigate={handleNavigate}
      onAddStep={handleAddStep}
      onRunWorkflow={handleRunWorkflow}
      onExportWorkflow={handleExportWorkflow}
      onImportWorkflow={handleImportWorkflow}
      executionMonitor={executionMonitorComponent}
    />
  );
}

export default createRoute({
  path: "/workflow",
  component: WorkflowsPage,
  getParentRoute: () => rootRoute,
});
