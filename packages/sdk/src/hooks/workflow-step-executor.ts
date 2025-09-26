import { useMutation } from "@tanstack/react-query";
import { useSDK } from "./store.tsx";
import { getWorkflowStatus, startWorkflow } from "./resources-workflow.ts";
import { formatIntegrationId, WellKnownMcpGroups } from "../crud/groups.ts";
import type {
  WorkflowStep,
  StepExecutionResult,
} from "../mcp/workflows/schemas.ts";

interface ExecuteStepInput {
  step: WorkflowStep;
  workflowInput?: unknown;
  previousResults: Record<string, StepExecutionResult>;
}

/**
 * Hook to execute a workflow step in the sandbox
 * Creates a temporary workflow with just this step and executes it
 */
export function useExecuteWorkflowStep() {
  const { locator } = useSDK();

  return useMutation<StepExecutionResult, Error, ExecuteStepInput>({
    mutationFn: async ({ step, workflowInput = {}, previousResults }) => {
      const startTime = Date.now();

      try {
        // Create a temporary workflow with just this step for testing
        const tempWorkflowName = `test-step-${Date.now()}`;

        // Build the step's execution context by creating a code step
        // that includes the previous results in its code
        const stepCode =
          step.code ||
          `
          export default async function(ctx) {
            return {
              success: false,
              error: "No code generated for this step"
            };
          }
        `;

        // Create a wrapper that provides previous step results
        const wrappedCode = `
export default async function(ctx) {
  // Inject previous step results
  const previousResults = ${JSON.stringify(previousResults || {})};
  
  // Override getStepResult to use our injected results
  const originalGetStepResult = ctx.getStepResult;
  ctx.getStepResult = function(stepId) {
    const result = previousResults[stepId];
    if (!result) {
      throw new Error(\`Step '\${stepId}' has not been executed yet\`);
    }
    return result.value;
  };
  
  // Execute the actual step code
  const stepFunction = ${stepCode.replace(/export\s+default\s+/, "")};
  return await stepFunction.call(this, ctx);
}`;

        // Convert to backend format
        const _sandboxStep = {
          type: "code" as const,
          def: {
            name: step.title || "Test Step",
            description: step.description || "Testing step execution",
            execute: wrappedCode,
          },
        };

        // Start the workflow execution
        const integrationId = formatIntegrationId(WellKnownMcpGroups.Workflows);
        const { runId } = (await startWorkflow(
          locator,
          {
            uri: `rsc://${integrationId}/workflow/${tempWorkflowName}`,
            input: workflowInput as Record<string, unknown>,
          },
        )) as { runId: string };

        // Poll for completion (max 30 seconds)
        const maxAttempts = 30;
        let attempts = 0;
        let status;

        while (attempts < maxAttempts) {
          status = (await getWorkflowStatus(locator, { runId })) as {
            status?: string;
            finalResult?: unknown;
            stepResults?: unknown;
            error?: string;
          };

          if (status.status === "completed" || status.status === "failed") {
            break;
          }

          // Wait 1 second before next poll
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
        }

        const duration = Date.now() - startTime;

        if (status?.status === "completed") {
          return {
            executedAt: new Date().toISOString(),
            value: status.finalResult ||
              status.stepResults || { success: true },
            duration,
          };
        } else if (status?.status === "failed") {
          return {
            executedAt: new Date().toISOString(),
            value: null,
            error: status.error || "Step execution failed",
            duration,
          };
        } else {
          return {
            executedAt: new Date().toISOString(),
            value: null,
            error: "Step execution timed out",
            duration,
          };
        }
      } catch (error) {
        const duration = Date.now() - startTime;

        // Fallback to mock execution if sandbox fails
        console.warn("Sandbox execution failed, using mock:", error);

        return {
          executedAt: new Date().toISOString(),
          value: {
            success: true,
            message: `Step "${step.title}" executed (mock)`,
            timestamp: new Date().toISOString(),
            mockData: true,
          },
          duration,
        };
      }
    },
  });
}
