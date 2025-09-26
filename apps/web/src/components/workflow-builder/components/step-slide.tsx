import { useState } from "react";
import { Code, Edit, FileText, Play } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useWorkflowContext } from "../../../contexts/workflow-context.tsx";
import type { WorkflowStep } from "@deco/sdk";

export function StepSlide({ step }: { step: WorkflowStep }) {
  const { state, executeStep, startEditing } = useWorkflowContext();
  const executionResult = state.executionResults[step.def.name];
  const [activeTab, setActiveTab] = useState("overview");

  // Analyze code to find which previous steps are being used
  const analyzeDependencies = () => {
    const dependencies: Array<{ stepTitle: string; usage: string }> = [];

    if (step.type === "code" && "execute" in step.def && step.def.execute) {
      // Find all getStepResult calls
      const stepResultPattern = /ctx\.getStepResult\(['"]([^'"]+)['"]\)/g;
      const matches = step.def.execute.matchAll(stepResultPattern);

      for (const match of matches) {
        const stepId = match[1];
        const prevStep = state.workflow.steps.find((s) => s.def.name === stepId);
        if (prevStep) {
          // Try to find context around the usage
          const startIdx = Math.max(0, match.index! - 50);
          const endIdx = Math.min(step.def.execute.length, match.index! + 100);
          const context = step.def.execute.substring(startIdx, endIdx);

          // Extract variable assignment if exists
          const varPattern = /const\s+(\w+)\s*=\s*await\s+ctx\.getStepResult/;
          const varMatch = context.match(varPattern);
          const usage = varMatch
            ? `Stored as '${varMatch[1]}' variable`
            : "Used in step logic";

          dependencies.push({
            stepTitle: prevStep.def.name || `Step ${stepId}`,
            usage,
          });
        }
      }

      // Also check for readWorkflowInput
      if ("execute" in step.def && step.def.execute.includes("ctx.readWorkflowInput()")) {
        dependencies.push({
          stepTitle: "Workflow Input",
          usage: "Initial data for the workflow",
        });
      }
    }

    return dependencies;
  };

  const dependencies = analyzeDependencies();

  return (
    <div className="h-full flex flex-col p-12">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Step Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground">{step.def.name}</h1>
          {step.def.description && (
            <p className="text-xl text-muted-foreground">{step.def.description}</p>
          )}
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-xl shadow-sm">
          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <div className="border-b px-8">
              <TabsList className="h-12 bg-transparent p-0 border-0">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="code"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-4"
                >
                  <Code className="w-4 h-4 mr-2" />
                  Code
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="p-8 space-y-6 mt-0">
              {/* Data Dependencies */}
              {dependencies.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide mb-4">
                    Data from Other Steps
                  </h3>
                  <div className="space-y-3">
                    {dependencies.map((dep, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 bg-muted rounded-lg"
                      >
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5"></div>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">
                            {dep.stepTitle}
                          </div>
                          <div className="text-sm text-muted-foreground mt-0.5">
                            {dep.usage}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tools Used - Not available in new schema */}
            </TabsContent>

            {/* Code Tab */}
            <TabsContent value="code" className="p-8 mt-0">
              <div className="bg-card rounded-lg p-6">
                {step.type === "code" && "execute" in step.def && step.def.execute ? (
                  <pre className="text-card-foreground overflow-x-auto text-sm font-mono leading-relaxed">
                    <code>{step.def.execute}</code>
                  </pre>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    No code generated yet
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Execution Context - Below the main card */}
        {executionResult && (
          <div
            className={`
              p-5 rounded-xl border-2 transition-all
              ${
                executionResult.error
                  ? "bg-red-50 border-red-200"
                  : "bg-green-50 border-green-200"
              }
            `}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold uppercase tracking-wide">
                {executionResult.error ? (
                  <span className="text-destructive flex items-center gap-2">
                    <span className="w-2 h-2 bg-destructive rounded-full"></span>
                    Execution Failed
                  </span>
                ) : (
                  <span className="text-success flex items-center gap-2">
                    <span className="w-2 h-2 bg-success rounded-full"></span>
                    Execution Successful
                  </span>
                )}
              </h3>
              <span className="text-xs text-muted-foreground">
                {new Date(executionResult.executedAt).toLocaleString()}
                {executionResult.duration && ` • ${executionResult.duration}ms`}
              </span>
            </div>

            <div className="bg-white bg-opacity-60 rounded-lg p-3 font-mono text-xs overflow-x-auto">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(
                  executionResult.error || executionResult.value,
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-center gap-4">
          <Button
            size="lg"
            variant="outline"
            onClick={() => startEditing(step.def.name)}
            className="min-w-[140px]"
          >
            <Edit className="w-5 h-5 mr-2" />
            Edit Step
          </Button>

          <Button
            size="lg"
            onClick={() => executeStep(step.def.name)}
            disabled={state.isExecuting}
            className="min-w-[140px]"
          >
            {state.isExecuting ? (
              <>
                <Spinner />
                <span className="ml-2">Executing...</span>
              </>
            ) : (
              <>
                <Play className="w-5 h-5 mr-2" />
                Test Step
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
