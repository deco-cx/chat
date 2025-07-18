import type { UniqueWorkflow, WorkflowRun, WorkflowStats } from "./types.ts";

/**
 * Determines if a status is considered successful
 */
function isSuccessStatus(status: string): boolean {
  const successStatuses = [
    "success",
    "succeeded",
    "completed",
    "complete",
    "finished",
  ];
  return successStatuses.includes(status.toLowerCase());
}

/**
 * Determines if a status is considered an error
 */
function isErrorStatus(status: string): boolean {
  const errorStatuses = [
    "failed",
    "error",
    "errored",
    "failure",
    "cancelled",
    "canceled",
    "timeout",
  ];
  return errorStatuses.includes(status.toLowerCase());
}

/**
 * Determines if a status is considered pending
 */
function isPendingStatus(status: string): boolean {
  const pendingStatuses = ["pending", "queued", "waiting", "scheduled"];
  return pendingStatuses.includes(status.toLowerCase());
}

/**
 * Determines if a status is considered running
 */
function isRunningStatus(status: string): boolean {
  const runningStatuses = [
    "running",
    "in_progress",
    "executing",
    "active",
    "processing",
  ];
  return runningStatuses.includes(status.toLowerCase());
}

/**
 * Transform array of workflow runs into unique workflows with aggregated stats
 */
export function transformToUniqueWorkflows(
  runs: WorkflowRun[],
): UniqueWorkflow[] {
  if (!runs || !Array.isArray(runs)) {
    console.warn("⚠️ Invalid runs input:", runs);
    return [];
  }

  if (runs.length === 0) {
    return [];
  }

  const workflowMap = new Map<string, WorkflowRun[]>();

  // Group runs by workflow name
  runs.forEach((run) => {
    if (!run || typeof run.workflowName !== "string") {
      console.warn("⚠️ Invalid run object:", run);
      return;
    }

    const existing = workflowMap.get(run.workflowName) || [];
    existing.push(run);
    workflowMap.set(run.workflowName, existing);
  });

  // Transform each group into a unique workflow
  const result = Array.from(workflowMap.entries()).map(
    ([workflowName, workflowRuns]) => {
      // Sort runs by updatedAt (most recent first)
      const sortedRuns = workflowRuns.sort((a, b) => b.updatedAt - a.updatedAt);
      const lastRun = sortedRuns[0];

      // Calculate statistics - debug the status counting
      const successCount = workflowRuns.filter((run) =>
        isSuccessStatus(run.status),
      ).length;
      const errorCount = workflowRuns.filter((run) =>
        isErrorStatus(run.status),
      ).length;
      const runningCount = workflowRuns.filter((run) =>
        isRunningStatus(run.status),
      ).length;
      const pendingCount = workflowRuns.filter((run) =>
        isPendingStatus(run.status),
      ).length;

      // Debug status breakdown - remove this after testing
      console.log(`🔢 Status breakdown for ${workflowName}:`, {
        total: workflowRuns.length,
        success: successCount,
        error: errorCount,
        running: runningCount,
        pending: pendingCount,
        statusCounts: workflowRuns.reduce(
          (acc, run) => {
            acc[run.status] = (acc[run.status] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
      });

      // Find first and last dates
      const firstCreated = Math.min(
        ...workflowRuns.map((run) => run.createdAt),
      );
      const lastUpdated = Math.max(...workflowRuns.map((run) => run.updatedAt));

      const uniqueWorkflow = {
        name: workflowName,
        totalRuns: workflowRuns.length,
        lastRun: {
          date: lastRun.updatedAt,
          status: lastRun.status,
          runId: lastRun.runId,
        },
        successCount,
        errorCount,
        firstCreated,
        lastUpdated,
      };

      return uniqueWorkflow;
    },
  );

  return result;
}

/**
 * Calculate detailed statistics for a specific workflow
 */
export function calculateWorkflowStats(runs: WorkflowRun[]): WorkflowStats {
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      successCount: 0,
      errorCount: 0,
      pendingCount: 0,
      runningCount: 0,
      successRate: 0,
    };
  }

  const successCount = runs.filter((run) => isSuccessStatus(run.status)).length;
  const errorCount = runs.filter((run) => isErrorStatus(run.status)).length;
  const pendingCount = runs.filter((run) => isPendingStatus(run.status)).length;
  const runningCount = runs.filter((run) => isRunningStatus(run.status)).length;

  const successRate = runs.length > 0 ? (successCount / runs.length) * 100 : 0;

  // Sort runs by updatedAt (most recent first)
  const sortedByUpdated = [...runs].sort((a, b) => b.updatedAt - a.updatedAt);
  const lastRun = sortedByUpdated[0];

  // Sort runs by createdAt (earliest first)
  const sortedByCreated = [...runs].sort((a, b) => a.createdAt - b.createdAt);
  const firstRun = sortedByCreated[0];

  return {
    totalRuns: runs.length,
    successCount,
    errorCount,
    pendingCount,
    runningCount,
    successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
    lastRun: lastRun
      ? {
          date: lastRun.updatedAt,
          status: lastRun.status,
          runId: lastRun.runId,
        }
      : undefined,
    firstRun: firstRun
      ? {
          date: firstRun.createdAt,
          runId: firstRun.runId,
        }
      : undefined,
  };
}

/**
 * Get status badge variant for consistent styling
 */
export function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" | "success" {
  if (isSuccessStatus(status)) return "success";
  if (isErrorStatus(status)) return "destructive";
  if (isRunningStatus(status)) return "secondary";
  return "outline";
}

/**
 * Format status for display
 */
export function formatStatus(status: string): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "errored":
      return "Error";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

/**
 * Sort unique workflows by various criteria
 */
export function sortUniqueWorkflows(
  workflows: UniqueWorkflow[],
  sortKey: string,
  direction: "asc" | "desc",
): UniqueWorkflow[] {
  return [...workflows].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortKey) {
      case "name":
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case "totalRuns":
        aVal = a.totalRuns;
        bVal = b.totalRuns;
        break;
      case "successRate":
        aVal = a.totalRuns > 0 ? a.successCount / a.totalRuns : 0;
        bVal = b.totalRuns > 0 ? b.successCount / b.totalRuns : 0;
        break;
      case "lastRun":
        aVal = a.lastRun.date;
        bVal = b.lastRun.date;
        break;
      case "lastStatus":
        aVal = a.lastRun.status;
        bVal = b.lastRun.status;
        break;
      default:
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
    }

    if (typeof aVal === "string" && typeof bVal === "string") {
      return direction === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    if (aVal < bVal) return direction === "asc" ? -1 : 1;
    if (aVal > bVal) return direction === "asc" ? 1 : -1;
    return 0;
  });
}
