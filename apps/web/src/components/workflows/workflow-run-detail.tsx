import { useWorkflowByUriV2 } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Suspense, lazy, useMemo, useState } from "react";
import { EmptyState } from "../common/empty-state.tsx";
import { UserInfo } from "../common/table/table-cells.tsx";
import { getStatusBadgeVariant } from "./utils.ts";
import { WorkflowStepCard } from "./workflow-step-card.tsx";
import { DetailSection } from "../common/detail-section.tsx";
import { WorkflowStoreProvider } from "../../stores/workflows/provider.tsx";
import { useWorkflowRunQuery } from "../workflow-builder/workflow-display-canvas.tsx";

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

  async function handleCopy() {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      globalThis.window.alert("Clipboard API unavailable");
      return;
    }

    const payload = JSON.stringify(data, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch (error) {
      console.error("Failed to copy workflow run data", error);
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

  const jsonString = JSON.stringify(data, null, 2);

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
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-8 w-8"
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} />
          </Button>
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

export function WorkflowRunDetail(_: { resourceUri?: string } = {}) {
  const runQuery = useWorkflowRunQuery(true);

  const workflowUri = runQuery.data?.data?.workflowURI;

  const { data: workflowResource, isLoading: isLoadingWorkflow } =
    useWorkflowByUriV2(workflowUri!);
  const workflow = workflowResource?.data;

  const isLoading = runQuery.isLoading || (workflowUri && isLoadingWorkflow);
  const run = runQuery.data;

  // All hooks must be called unconditionally at the top
  const headerTitle = useMemo(
    () => run?.data?.name || "Workflow Run",
    [run?.data?.name],
  );

  const status = run?.data?.status || "unknown";
  const badgeVariant = getStatusBadgeVariant(status);

  // Calculate duration using timestamps from backend
  const duration = useMemo(() => {
    const startTime = run?.data?.startTime;
    const endTime = run?.data?.endTime;
    if (!startTime) return null;
    const ms = (endTime || Date.now()) - startTime;
    if (ms < 0) return null;
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m ${s % 60}s`;
  }, [run?.data?.startTime, run?.data?.endTime]);

  // Use processed data directly from backend
  const input = useMemo(
    () => run?.data?.workflowStatus?.params?.input,
    [run?.data?.workflowStatus],
  );
  const output = useMemo(
    () => run?.data?.finalResult,
    [run?.data?.finalResult],
  );
  const error = run?.data?.error;

  // Early returns after all hooks
  if (isLoading) {
    return (
      <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (runQuery.isError || !run || !workflow) {
    return (
      <EmptyState
        icon="error"
        title="Failed to load workflow run"
        description={(runQuery.error as Error)?.message || "Run not found"}
      />
    );
  }

  const startedBy = run.data.workflowStatus?.params?.context?.startedBy;
  const steps = run.data.workflowStatus?.steps || [];

  return (
    <WorkflowStoreProvider workflow={workflow}>
      <ScrollArea className="h-full w-full">
        <div className="flex flex-col">
          {/* Header with status and metadata */}
          <DetailSection>
            {/* Title and Status */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h1 className="text-2xl font-medium">{headerTitle}</h1>
              <Badge variant={badgeVariant} className="capitalize">
                {status}
              </Badge>
            </div>

            {/* Metadata Row */}
            <div className="flex items-center gap-4 flex-wrap text-sm">
              <div className="flex items-center gap-2">
                <Icon
                  name="calendar_month"
                  size={16}
                  className="text-muted-foreground"
                />
                <span className="font-mono text-sm uppercase">
                  {run.data.startTime
                    ? new Date(run.data.startTime).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "-"}
                </span>
              </div>

              <div className="h-3 w-px bg-border" />

              <div className="flex items-center gap-2">
                <Icon
                  name="schedule"
                  size={16}
                  className="text-muted-foreground"
                />
                <span className="font-mono text-sm">{duration || "-"}</span>
              </div>

              <div className="h-3 w-px bg-border" />

              {startedBy?.id && (
                <UserInfo
                  userId={startedBy.id}
                  size="sm"
                  noTooltip
                  showEmail={false}
                />
              )}
            </div>

            {/* Error Alert */}
            {error && (
              <Alert className="bg-destructive/5 border-none">
                <Icon name="error" className="h-4 w-4 text-destructive" />
                <AlertTitle className="text-destructive">Error</AlertTitle>
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </DetailSection>

          {/* Input / Output */}
          <DetailSection title="Input & Output">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <div className="min-w-0 flex">
                <JsonViewer data={input} title="Input" matchHeight />
              </div>

              <div className="min-w-0 flex">
                {status === "completed" || status === "success" ? (
                  <JsonViewer data={output} title="Output" matchHeight />
                ) : (
                  <div className="space-y-2 w-full">
                    <p className="font-mono text-sm text-muted-foreground uppercase">
                      Output
                    </p>
                    <div className="bg-muted rounded-xl min-h-[200px] max-h-[300px] flex items-center justify-center p-4">
                      <div className="text-xs text-muted-foreground italic text-center">
                        Output will be available when the workflow completes
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DetailSection>

          {/* Steps */}
          <DetailSection title="Steps">
            {steps.length > 0 ? (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-[700px] space-y-0">
                  {run.data.workflowStatus?.steps?.map((step, idx) => {
                    return (
                      <div key={idx}>
                        {idx > 0 && (
                          <div className="h-10 w-full flex justify-center">
                            <div className="w-px bg-border" />
                          </div>
                        )}
                        <Suspense fallback={<Spinner />}>
                          <WorkflowStepCard
                            stepName={step.name || `Step ${idx + 1}`}
                            type="runtime"
                          />
                        </Suspense>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground italic py-4">
                No steps available
              </div>
            )}
          </DetailSection>
        </div>
      </ScrollArea>
    </WorkflowStoreProvider>
  );
}
