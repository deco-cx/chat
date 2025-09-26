import { InstanceGetResponse } from "cloudflare/resources/workflows/instances/instances.mjs";
import type { AppContext } from "../context.ts";

// Type for basic workflow status (from workflowInstance.status())
export interface InstanceStatus {
  status:
    | "queued"
    | "running"
    | "waiting"
    | "complete"
    | "errored"
    | "terminated";
  output?: unknown;
  error?: string | unknown;
}

/**
 * Converts an InstanceStatus to InstanceGetResponse format with minimal fields
 * This allows us to have a single code path for handling both basic and detailed status
 */
export function normalizeWorkflowStatus(
  instanceStatus: InstanceStatus,
): InstanceGetResponse {
  return {
    status: instanceStatus.status,
    output:
      typeof instanceStatus.output === "string" ||
      typeof instanceStatus.output === "number"
        ? instanceStatus.output
        : JSON.stringify(instanceStatus.output ?? {}),
    error: instanceStatus.error
      ? {
          message:
            typeof instanceStatus.error === "string"
              ? instanceStatus.error
              : JSON.stringify(instanceStatus.error),
          name: "WorkflowError",
        }
      : null,
    // Required fields with default values
    queued: new Date().toISOString(), // We don't have this info from basic status
    start: null, // Not available in basic status
    end: null, // Not available in basic status
    success:
      instanceStatus.status === "complete"
        ? true
        : instanceStatus.status === "errored" ||
            instanceStatus.status === "terminated"
          ? false
          : null,
    steps: [], // No step information in basic status
    params: null, // Not available in basic status
    trigger: { source: "unknown" }, // Not available in basic status
    versionId: "unknown", // Not available in basic status
  };
}

/**
 * Maps Cloudflare Workflow status to our standardized status format
 */
export function mapWorkflowStatus(
  cfStatus: InstanceGetResponse["status"],
): "pending" | "running" | "completed" | "failed" {
  switch (cfStatus) {
    case "queued":
      return "pending";
    case "running":
    case "waiting":
      return "running";
    case "complete":
      return "completed";
    case "errored":
    case "terminated":
      return "failed";
    default:
      return "pending";
  }
}

const normalizeStepName = (name: string) => {
  return name.endsWith("-1") ? name.slice(0, -2) : name; // for the first occurrence of the step we should remove suffix -1
};

/**
 * Extracts step results from workflow steps and returns parsed outputs
 */
export function extractStepResults(
  steps: InstanceGetResponse["steps"],
): Record<string, unknown> {
  const stepResults: Record<string, unknown> = {};

  steps.forEach((step) => {
    if (!("name" in step)) {
      return;
    }
    const stepName = normalizeStepName(step.name);
    // Only process step types that have name and output (UnionMember0, UnionMember3)
    if (step.type === "step") {
      try {
        // Parse the output if it's a JSON string
        const parsedOutput =
          typeof step.output === "string"
            ? JSON.parse(step.output)
            : step.output;
        stepResults[stepName] = parsedOutput;
      } catch {
        // If parsing fails, use the raw output
        stepResults[stepName] = step.output;
      }
    }

    // Handle waitForEvent steps that also have name and output
    if (step.type === "waitForEvent") {
      try {
        const parsedOutput =
          typeof step.output === "string"
            ? JSON.parse(step.output)
            : step.output;
        stepResults[stepName] = parsedOutput;
      } catch {
        stepResults[stepName] = step.output;
      }
    }
  });

  return stepResults;
}

/**
 * Finds the currently executing step in a running workflow
 */
export function findCurrentStep(
  steps: InstanceGetResponse["steps"],
  status: "pending" | "running" | "completed" | "failed",
): string | undefined {
  if (status !== "running") return undefined;

  // Look for steps that have started but not ended
  for (const step of steps) {
    if (
      step.type === "step" &&
      "name" in step &&
      "start" in step &&
      "end" in step
    ) {
      if (step.start && !step.end) {
        return step.name;
      }
    }
    if (
      step.type === "waitForEvent" &&
      "name" in step &&
      "start" in step &&
      "end" in step
    ) {
      if (step.start && !step.end) {
        return step.name;
      }
    }
  }

  // If no current step found, check for incomplete steps
  const incompleteStep = steps.find(
    (step) =>
      ("end" in step && !step.end) ||
      (step.type === "step" && step.end === null),
  );

  return incompleteStep && "name" in incompleteStep
    ? incompleteStep.name
    : undefined;
}

/**
 * Extracts error logs from workflow steps
 */
export function extractStepLogs(
  steps: InstanceGetResponse["steps"],
): Array<{ type: "log" | "warn" | "error"; content: string }> {
  const logs: Array<{ type: "log" | "warn" | "error"; content: string }> = [];

  steps.forEach((step) => {
    // Add step logs if there are errors (for types that have error property)
    if (
      (step.type === "step" ||
        step.type === "sleep" ||
        step.type === "waitForEvent") &&
      "error" in step &&
      step.error &&
      "name" in step
    ) {
      logs.push({
        type: "error",
        content: `Step ${step.name}: ${step.error.message || step.error}`,
      });
    }
  });

  return logs;
}

/**
 * Extracts timing information from workflow status
 */
export function extractWorkflowTiming(workflowStatus: InstanceGetResponse) {
  const startTime =
    workflowStatus.start || workflowStatus.queued
      ? new Date(workflowStatus.start || workflowStatus.queued).getTime()
      : Date.now();

  const endTime = workflowStatus.end
    ? new Date(workflowStatus.end).getTime()
    : undefined;

  return { startTime, endTime };
}

/**
 * Formats error information from workflow status
 */
export function formatWorkflowError(
  workflowStatus: InstanceGetResponse,
): string | undefined {
  if (!workflowStatus.error) return undefined;

  return typeof workflowStatus.error === "object"
    ? JSON.stringify(workflowStatus.error, null, 2)
    : String(workflowStatus.error);
}

/**
 * Fetches workflow status from both basic and detailed sources
 */
export async function fetchWorkflowStatus(
  c: AppContext,
  runId: string,
): Promise<InstanceGetResponse> {
  // Get status from Cloudflare Workflow
  const workflowInstance = await c.workflowRunner.get(runId);
  const basicStatus = (await workflowInstance.status()) as InstanceStatus;

  // Try to get detailed status from API (available in production)
  const apiResponse: InstanceGetResponse | null = await c.cf.workflows.instances
    .get("workflow-runner", runId, {
      account_id: c.envVars.CF_ACCOUNT_ID,
    })
    .catch(() => null);

  // Normalize to common format - use detailed if available, otherwise convert basic
  return apiResponse || normalizeWorkflowStatus(basicStatus);
}

/**
 * Processes workflow steps to extract results with fallback handling
 */
export function processWorkflowSteps(
  workflowStatus: InstanceGetResponse,
): Record<string, unknown> {
  if (workflowStatus.steps && workflowStatus.steps.length > 0) {
    return extractStepResults(workflowStatus.steps);
  }

  // Fallback to old method if detailed steps not available
  if (
    workflowStatus.output &&
    typeof workflowStatus.output === "object" &&
    "steps" in workflowStatus.output
  ) {
    return (workflowStatus.output as { steps: Record<string, unknown> }).steps;
  }

  return {};
}
