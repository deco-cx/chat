import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "../main";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { client } from "../lib/rpc";

// Types will be available after npm run gen:self
interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  code: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  input: Record<string, unknown>;
  result?: {
    success: boolean;
    output?: unknown;
    error?: unknown;
    logs?: Array<{ type: string; content: string }>;
  };
}

function WorkflowBuilder() {
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [objective, setObjective] = useState("");

  const generateStep = useMutation({
    mutationFn: async (obj: string) => {
      return await client.GENERATE_STEP({
        objective: obj,
        previousSteps: steps.map((s) => ({
          id: s.id,
          name: s.name,
          outputSchema: s.outputSchema,
        })),
      });
    },
    onSuccess: (data) => {
      if (data.step) {
        setSteps([...steps, data.step as WorkflowStep]);
        setObjective("");
      }
    },
  });

  const runStep = useMutation({
    mutationFn: async (step: WorkflowStep) => {
      // Get all previous step results for @ref resolution
      const previousStepResults: Record<string, unknown> = {};
      for (const s of steps) {
        if (s.result?.success) {
          previousStepResults[s.id] = s.result.output;
        }
      }

      return await client.RUN_WORKFLOW_STEP({
        step: {
          id: step.id,
          name: step.name,
          code: step.code,
          inputSchema: step.inputSchema,
          outputSchema: step.outputSchema,
          input: step.input,
        },
        previousStepResults,
      });
    },
    onSuccess: (data, step) => {
      setSteps(
        steps.map((s) => (s.id === step.id ? { ...s, result: data } : s)),
      );
    },
  });

  return (
    <div className="min-h-screen bg-[#1a1a1a] text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold mb-2">Workflow Builder</h1>
          <p className="text-gray-400 text-sm">
            Build workflows step by step. Each step can reference previous step
            data with @refs.
          </p>
        </div>

        {/* Generate Step */}
        <div className="bg-[#242424] border border-[#3a3a3a] rounded-lg p-6 mb-6">
          <h2 className="text-sm uppercase tracking-wide text-gray-400 mb-4">
            Add Step
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="What should this step do? (e.g., 'List all todos')"
              className="flex-1 bg-[#1a1a1a] border border-[#3a3a3a] rounded px-4 py-2 text-sm focus:outline-none focus:border-[#ff6b4a]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && objective.trim()) {
                  generateStep.mutate(objective);
                }
              }}
            />
            <button
              onClick={() => objective.trim() && generateStep.mutate(objective)}
              disabled={generateStep.isPending || !objective.trim()}
              className="px-6 py-2 bg-[#ff6b4a] hover:bg-[#ff8566] disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium transition-colors"
            >
              {generateStep.isPending ? "Generating..." : "Generate Step"}
            </button>
          </div>
          {generateStep.error && (
            <div className="mt-3 text-red-400 text-sm">
              Error: {String(generateStep.error)}
            </div>
          )}
        </div>

        {/* Steps List */}
        <div className="space-y-4">
          {steps.length === 0 ? (
            <div className="bg-[#242424] border border-[#3a3a3a] rounded-lg p-8 text-center text-gray-400">
              <p className="text-sm">
                No steps yet. Generate your first step above.
              </p>
            </div>
          ) : (
            steps.map((step, index) => (
              <div
                key={step.id}
                className="bg-[#242424] border border-[#3a3a3a] rounded-lg p-6"
              >
                {/* Step Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs text-gray-500">
                        #{index + 1}
                      </span>
                      <h3 className="font-medium">{step.name}</h3>
                      {step.result && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${
                            step.result.success
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                          }`}
                        >
                          {step.result.success ? "✓ Success" : "✗ Failed"}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-400">{step.description}</p>
                  </div>
                  <button
                    onClick={() => runStep.mutate(step)}
                    disabled={runStep.isPending}
                    className="px-4 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] border border-[#3a3a3a] rounded text-xs font-medium transition-colors disabled:opacity-50"
                  >
                    {runStep.isPending && runStep.variables?.id === step.id
                      ? "Running..."
                      : "Run"}
                  </button>
                </div>

                {/* Code Preview */}
                <details className="mb-4">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300 mb-2">
                    View Code
                  </summary>
                  <pre className="bg-[#0d0d0d] border border-[#2a2a2a] rounded p-3 text-xs overflow-x-auto">
                    <code className="text-gray-300">{step.code}</code>
                  </pre>
                </details>

                {/* Result */}
                {step.result && (
                  <div className="border-t border-[#3a3a3a] pt-4">
                    <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                      Result
                    </div>
                    {step.result.error ? (
                      <pre className="bg-red-500/10 border border-red-500/30 rounded p-3 text-xs text-red-400 overflow-x-auto">
                        {JSON.stringify(step.result.error, null, 2)}
                      </pre>
                    ) : (
                      <pre className="bg-[#0d0d0d] border border-[#2a2a2a] rounded p-3 text-xs overflow-x-auto">
                        <code className="text-green-400">
                          {JSON.stringify(step.result.output, null, 2)}
                        </code>
                      </pre>
                    )}
                    {step.result.logs && step.result.logs.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-300">
                          Logs ({step.result.logs.length})
                        </summary>
                        <div className="mt-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded p-3 text-xs space-y-1">
                          {step.result.logs.map((log, i) => (
                            <div
                              key={i}
                              className={
                                log.type === "error"
                                  ? "text-red-400"
                                  : log.type === "warn"
                                    ? "text-yellow-400"
                                    : "text-gray-400"
                              }
                            >
                              [{log.type}] {log.content}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Helper Text */}
        {steps.length > 0 && (
          <div className="mt-6 bg-[#242424] border border-[#3a3a3a] rounded-lg p-4">
            <h3 className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              Using @refs
            </h3>
            <p className="text-sm text-gray-300 mb-2">
              Reference previous step data in new steps:
            </p>
            <ul className="text-xs text-gray-400 space-y-1">
              {steps.map((s) => (
                <li key={s.id} className="font-mono">
                  <span className="text-[#ff6b4a]">@{s.id}</span> - {s.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default createRoute({
  path: "/workflow-builder",
  component: WorkflowBuilder,
  getParentRoute: () => rootRoute,
});
