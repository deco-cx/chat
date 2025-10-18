import { Badge } from "@deco/ui/components/badge.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense, lazy, useMemo, useState, useSyncExternalStore } from "react";
import { getStatusBadgeVariant } from "./utils.ts";
import {
  StepInput,
  useWorkflowRunQuery,
} from "../workflow-builder/workflow-display-canvas.tsx";
import {
  useWorkflowStepOutput,
  useWorkflowStepExecution,
} from "../../stores/workflows/hooks.ts";

function deepParse(value: unknown, depth = 0): unknown {
  if (typeof value !== "string") {
    return value;
  }

  // Try to parse the string as JSON
  try {
    const parsed = JSON.parse(value);
    // If successful, recursively parse the result in case it's nested
    return deepParse(parsed, depth + 1);
  } catch (_err) {
    // If parsing fails, check if it looks like truncated JSON
    const trimmed = value.trim();
    if (trimmed.startsWith("{") && !trimmed.endsWith("}")) {
      // Truncated JSON object - try to fix it
      try {
        // Close any open strings and objects
        let fixed = trimmed;
        // If ends with [truncated output], remove it
        // Add closing quote if string is open
        const quoteCount = (fixed.match(/"/g) || []).length;
        if (quoteCount % 2 !== 0) {
          fixed += '"';
        }
        // Add closing brace
        fixed += "}";
        const parsed = JSON.parse(fixed);
        return parsed;
      } catch {
        // If fix didn't work, return as string
        return value;
      }
    }
    // Not truncated JSON or couldn't fix, return as string
    return value;
  }
}

const LazyHighlighter = lazy(() => import("../chat/lazy-highlighter.tsx"));

function JsonViewer({
  data,
  title,
  matchHeight = false,
}: {
  data: unknown;
  title: string;
  matchHeight?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const parsedData = useMemo(() => deepParse(data), [data]);

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      globalThis.window.alert("Clipboard API unavailable");
      return;
    }

    const payload = JSON.stringify(parsedData, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Failed to copy data", error);
    }
  }

  if (data === null || data === undefined) {
    return (
      <div className="space-y-2">
        <p className="font-mono text-sm text-muted-foreground uppercase">
          {title}
        </p>
        <div className="text-xs text-muted-foreground italic p-2">
          No {title.toLowerCase()}
        </div>
      </div>
    );
  }

  const jsonString = JSON.stringify(parsedData, null, 2);

  return (
    <div
      className={`space-y-2 min-w-0 w-full ${matchHeight ? "h-full flex flex-col" : ""}`}
    >
      <p className="font-mono text-sm text-muted-foreground uppercase">
        {title}
      </p>
      <div
        className={`relative bg-muted rounded-xl ${matchHeight ? "min-h-[200px]" : ""} max-h-[300px] overflow-auto w-full ${matchHeight ? "flex-1" : ""}`}
      >
        <div className="absolute right-2 top-2 z-10 flex items-center gap-1 bg-background rounded-xl shadow-sm">
          <button
            type="button"
            onClick={handleCopy}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground"
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} />
          </button>
        </div>
        <div
          className={`overflow-x-auto w-full ${matchHeight ? "h-full" : ""}`}
        >
          <Suspense
            fallback={
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {jsonString}
              </pre>
            }
          >
            <LazyHighlighter
              language="json"
              content={jsonString}
              fillHeight={matchHeight}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

function StepError({ error }: { error: unknown }) {
  if (!error) return null;

  const errorObj = error as { name?: string; message?: string };

  return (
    <div className="text-xs bg-destructive/10 text-destructive rounded p-2">
      <div className="font-semibold">{String(errorObj.name || "Error")}</div>
      <div className="mt-1">
        {String(errorObj.message || "An error occurred")}
      </div>
    </div>
  );
}

/**
 * Derives the step status from execution properties (works for both runtime and definition steps)
 */
function deriveStepStatus(execution: {
  success?: boolean | null;
  error?: { message?: string; name?: string } | null;
  start?: string | null;
  end?: string | null;
}): string | undefined {
  if (
    !execution.success &&
    !execution.error &&
    !execution.start &&
    !execution.end
  )
    return;
  // If step has error, it failed
  if (execution.error) return "failed";

  // If step has ended successfully
  if (execution.end && execution.success === true) return "completed";

  // If step has ended but not successfully
  if (execution.end && execution.success === false) return "failed";

  // If step has started but not ended, it's running
  if (execution.start && !execution.end) return "running";

  // Otherwise, it's pending
  return "pending";
}
interface WorkflowStepCardProps {
  stepName: string;
  type: "definition" | "runtime";
}

// Sub-components using composition pattern
function StepIcon() {
  return (
    <div className="shrink-0 mt-0.5">
      <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
        <Icon name="bolt" size={18} />
      </div>
    </div>
  );
}

interface StepTitleProps {
  stepName: string;
  description?: string;
}

function StepTitle({ stepName, description }: StepTitleProps) {
  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      <span className="font-medium text-base truncate">{String(stepName)}</span>
      {description && (
        <span className="text-sm text-muted-foreground">{description}</span>
      )}
    </div>
  );
}

interface StepDurationProps {
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
}

function formatDuration(milliseconds: number): string {
  const ms = milliseconds % 1000;
  const totalSeconds = Math.floor(milliseconds / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}.${ms.toString().padStart(3, "0")}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}.${ms.toString().padStart(3, "0")}s`;
  }
  return `${seconds}.${ms.toString().padStart(3, "0")}s`;
}

// Time subscription for useSyncExternalStore
function subscribeToTime(callback: () => void) {
  const interval = setInterval(callback, 50);
  return () => clearInterval(interval);
}

function getTimeSnapshot() {
  return Date.now();
}

function StepDuration({ startTime, endTime, status }: StepDurationProps) {
  // Only subscribe to time updates when step is running
  const shouldSubscribe = status === "running" && startTime && !endTime;

  const currentTime = useSyncExternalStore(
    shouldSubscribe ? subscribeToTime : () => () => {}, // No-op subscription when not needed
    getTimeSnapshot,
    getTimeSnapshot, // Server snapshot (same as client for time)
  );

  if (!startTime) return null;

  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : currentTime;
  const duration = Math.max(0, end - start);

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      <Icon name="schedule" size={14} />
      <span className="font-mono text-xs">{formatDuration(duration)}</span>
    </div>
  );
}

interface StepTimeInfoProps {
  startTime?: string | null;
  endTime?: string | null;
  status?: string;
}

function StepTimeInfo({ startTime, endTime, status }: StepTimeInfoProps) {
  if (!startTime) return null;

  return (
    <div className="flex items-center gap-4 text-xs mt-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon name="play_arrow" size={14} />
        <span className="font-mono uppercase">
          {new Date(startTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {endTime && (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Icon name="check" size={14} />
          <span className="font-mono uppercase">
            {new Date(endTime).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      )}

      <StepDuration startTime={startTime} endTime={endTime} status={status} />
    </div>
  );
}

interface StepStatusBadgeProps {
  status: string;
}

function StepStatusBadge({ status }: StepStatusBadgeProps) {
  return (
    <Badge
      variant={getStatusBadgeVariant(status)}
      className="capitalize text-xs shrink-0"
    >
      {status}
    </Badge>
  );
}

interface StepHeaderProps {
  stepName: string;
  description?: string;
  status?: string;
  startTime?: string | null;
  endTime?: string | null;
}

function StepHeader({
  stepName,
  description,
  status,
  startTime,
  endTime,
}: StepHeaderProps) {
  const isFailed = status === "failed";

  return (
    <div className={`p-4 space-y-2 ${isFailed ? "text-destructive" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <StepIcon />
          <div className="flex flex-col gap-1 flex-1 min-w-0">
            <StepTitle stepName={stepName} description={description} />
            <StepTimeInfo
              startTime={startTime}
              endTime={endTime}
              status={status}
            />
          </div>
        </div>
        {status && <StepStatusBadge status={status} />}
      </div>
    </div>
  );
}

interface StepOutputProps {
  output: unknown;
}

function StepOutput({ output }: StepOutputProps) {
  if (output === undefined || output === null) return null;

  return <JsonViewer data={output} title="Output" />;
}

interface StepAttemptsProps {
  attempts: Array<{
    success?: boolean | null;
    error?: { message?: string; name?: string } | null;
    start?: string | null;
    end?: string | null;
  }>;
}

function StepAttempts({ attempts }: StepAttemptsProps) {
  if (!attempts || attempts.length <= 1) return null;

  return (
    <details className="text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
        {attempts.length} attempts
      </summary>
      <div className="mt-2 space-y-2 pl-4">
        {attempts.map((attempt, attemptIdx) => (
          <div key={attemptIdx} className="border-l-2 pl-2 py-1">
            <div className="flex items-center gap-2">
              <span>Attempt {attemptIdx + 1}</span>
              {attempt.success ? (
                <Icon name="check_circle" size={12} className="text-success" />
              ) : (
                <Icon name="error" size={12} className="text-destructive" />
              )}
            </div>
            {attempt.error && (
              <div className="text-destructive mt-1">
                {String(attempt.error.message || "Error")}
              </div>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

interface StepContentProps {
  error?: { name?: string; message?: string } | null;
  output?: unknown;
  attempts?: Array<{
    success?: boolean | null;
    error?: { message?: string; name?: string } | null;
    start?: string | null;
    end?: string | null;
  }>;
}

function StepContent({ error, output, attempts }: StepContentProps) {
  const hasContent =
    error ||
    (output !== undefined && output !== null) ||
    (attempts && attempts.length > 1);

  if (!hasContent) return null;

  return (
    <div className="bg-background rounded-xl p-3 space-y-3">
      <StepError error={error} />
      <StepOutput output={output} />
      <StepAttempts attempts={attempts || []} />
    </div>
  );
}

export function WorkflowStepCard({ stepName, type }: WorkflowStepCardProps) {
  const stepOutput = useWorkflowStepOutput(stepName);
  const stepExecution = useWorkflowStepExecution(stepName);
  const runData = useWorkflowRunQuery();
  const isInteractive = type === "definition";

  const runtimeStep = useMemo(() => {
    if (type === "runtime") {
      return runData?.data?.data?.workflowStatus?.steps?.find(
        (step) => step.name === stepName,
      );
    }
    return undefined;
  }, [runData?.data?.data?.workflowStatus?.steps, type, stepName]);

  // Get execution data from either runtime or definition store
  const execution = useMemo(() => {
    if (type === "definition" && stepExecution) {
      return stepExecution;
    }
    if (type === "runtime" && runtimeStep) {
      return {
        start: runtimeStep.start,
        end: runtimeStep.end,
        error: runtimeStep.error,
        success: runtimeStep.success,
      };
    }
    return undefined;
  }, [type, stepExecution, runtimeStep]);

  const output = useMemo(() => {
    if (type === "definition") {
      return stepOutput;
    }
    return runtimeStep?.output;
  }, [stepOutput, runtimeStep, type]);

  // Derive status for both definition and runtime steps
  const status = useMemo(() => {
    if (execution) {
      return deriveStepStatus(execution);
    }
    return undefined;
  }, [execution]);

  return (
    <div className={`rounded-xl p-0.5 bg-muted`}>
      <StepHeader
        stepName={stepName}
        status={status}
        startTime={execution?.start}
        endTime={execution?.end}
      />
      {isInteractive && <StepInput stepName={stepName} />}
      <StepContent
        output={output}
        error={execution?.error}
        attempts={runtimeStep?.attempts}
      />
    </div>
  );
}
