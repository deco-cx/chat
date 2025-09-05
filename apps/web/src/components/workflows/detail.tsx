// deno-lint-ignore-file no-explicit-any
import { useWorkflowStatus } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { useState } from "react";
import { useParams } from "react-router";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import { WorkflowFlowVisualization } from "./workflow-flow-visualization.tsx";

function tryParseJson(str: unknown): unknown {
  if (typeof str !== "string") {
    // If it's already an object, return it as-is
    // Don't convert objects to "[object Object]" strings
    return str;
  }
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return str;
  } catch {
    return str;
  }
}

function CopyButton({ value }: { value: unknown }) {
  const [copied, setCopied] = useState(false);
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(
      typeof value === "string" ? value : JSON.stringify(value, null, 2),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }
  return (
    <Button
      size="icon"
      variant="ghost"
      className="ml-2"
      onClick={handleCopy}
      title={copied ? "Copied!" : "Copy to clipboard"}
    >
      <Icon name={copied ? "check" : "content_copy"} size={16} />
    </Button>
  );
}

// JSON Tree Viewer Components
function ExpandableString({
  value,
  className,
  isQuoted = false,
}: {
  value: string;
  className: string;
  isQuoted?: boolean;
}) {
  const [showFull, setShowFull] = useState(false);

  // Ensure value is actually a string
  const stringValue = typeof value === "string" ? value : String(value);
  const isTruncated = stringValue.length > 100;

  const content =
    showFull || !isTruncated ? (
      stringValue
    ) : (
      <span>
        {stringValue.slice(0, 100)}
        <button
          type="button"
          className="text-primary hover:text-primary/80 underline ml-1 text-xs font-normal bg-transparent border-none cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(true);
          }}
          title="Click to show full content"
        >
          ... show {stringValue.length - 100} more chars
        </button>
      </span>
    );

  return (
    <span className={className}>
      {isQuoted && '"'}
      {content}
      {isQuoted && '"'}
      {showFull && isTruncated && (
        <button
          type="button"
          className="text-primary hover:text-primary/80 underline ml-2 text-xs font-normal bg-transparent border-none cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(false);
          }}
          title="Click to collapse"
        >
          collapse
        </button>
      )}
    </span>
  );
}

function JsonTreeNode({
  data,
  keyName,
  level = 0,
}: {
  data: unknown;
  keyName?: string;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  const getDataType = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return typeof value;
  };

  const getValuePreview = (value: unknown): string => {
    const type = getDataType(value);
    switch (type) {
      case "array": {
        const arr = value as unknown[];
        return `[${arr.length} items]`;
      }
      case "object": {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        return `{${keys.length} properties}`;
      }
      case "string": {
        const str = value as string;
        return str.length > 50 ? `"${str.slice(0, 50)}..."` : `"${str}"`;
      }
      case "null":
        return "null";
      default:
        return String(value);
    }
  };

  const getTypeColor = (value: unknown): string => {
    const type = getDataType(value);
    switch (type) {
      case "string":
        return "text-green-600 dark:text-green-400";
      case "number":
        return "text-blue-600 dark:text-blue-400";
      case "boolean":
        return "text-purple-600 dark:text-purple-400";
      case "null":
        return "text-gray-500 dark:text-gray-400";
      case "array":
        return "text-orange-600 dark:text-orange-400";
      case "object":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-700 dark:text-gray-300";
    }
  };

  const isExpandable = (value: unknown): boolean => {
    return (
      Array.isArray(value) || (typeof value === "object" && value !== null)
    );
  };

  const renderPrimitive = (value: unknown) => {
    const type = getDataType(value);
    const colorClass = getTypeColor(value);

    if (type === "string") {
      // Ensure we're definitely passing a string
      const stringValue = String(value);
      return (
        <ExpandableString value={stringValue} className={colorClass} isQuoted />
      );
    }

    return <span className={colorClass}>{getValuePreview(value)}</span>;
  };

  const renderKey = () => {
    if (!keyName) return null;
    return <span className="text-foreground font-medium">"{keyName}":</span>;
  };

  const indentLevel = level * 16;

  if (!isExpandable(data)) {
    return (
      <div
        className="flex items-start gap-2 py-1 font-mono text-sm"
        style={{ paddingLeft: `${indentLevel}px` }}
      >
        <span className="w-4"></span> {/* Space for expand icon */}
        {renderKey()}
        {renderPrimitive(data)}
      </div>
    );
  }

  const entries = Array.isArray(data)
    ? data.map((item, index) => [String(index), item] as const)
    : Object.entries(data as Record<string, unknown>).map(([key, value]) => {
        // Ensure we're not accidentally stringifying objects
        return [key, value] as const;
      });

  return (
    <div className="font-mono text-sm">
      <div
        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 rounded"
        style={{ paddingLeft: `${indentLevel}px` }}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <Icon
          name={isExpanded ? "expand_more" : "chevron_right"}
          size={16}
          className="text-muted-foreground flex-shrink-0"
        />
        {renderKey()}
        <span className={getTypeColor(data)}>{getValuePreview(data)}</span>
      </div>

      {isExpanded && (
        <div className="border-l border-border ml-2">
          {entries.map(([key, value]) => (
            <JsonTreeNode
              key={key}
              data={value}
              keyName={key}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function JsonTreeViewer({
  value,
  compact = false,
}: {
  value: unknown;
  compact?: boolean;
}) {
  const parsed = tryParseJson(value);

  // Handle simple string values
  if (typeof parsed === "string") {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <ExpandableString
          value={parsed}
          className="whitespace-pre-wrap break-words font-mono text-current"
          isQuoted
        />
      </div>
    );
  }

  // Handle null, undefined, or other primitive values
  if (parsed === null || parsed === undefined) {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-current">
          {parsed === null ? "null" : "undefined"}
        </pre>
      </div>
    );
  }

  // Handle other primitive values (numbers, booleans)
  if (typeof parsed !== "object") {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-current">
          {String(parsed)}
        </pre>
      </div>
    );
  }

  // Handle objects and arrays
  return (
    <div
      className={compact ? "max-h-64 overflow-y-auto" : "bg-muted rounded p-3"}
      onClick={(e) => e.stopPropagation()}
    >
      <JsonTreeNode data={parsed} />
    </div>
  );
}

function OutputField({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold mr-0">{label}:</span>
        <CopyButton value={value} />
      </div>
      <JsonTreeViewer value={value} />
    </div>
  );
}

function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" | "success" {
  if (status === "success" || status === "completed") return "success";
  if (status === "failed" || status === "errored") return "destructive";
  if (status === "running" || status === "in_progress") return "secondary";
  return "outline";
}

function getStatusIcon(status: string) {
  if (status === "success" || status === "completed") {
    return <Icon name="check_circle" size={18} className="text-success" />;
  } else if (status === "failed" || status === "error") {
    return <Icon name="error" size={18} className="text-destructive" />;
  } else if (status === "running") {
    return <Icon name="sync" size={18} className="text-primary" />;
  } else {
    return <Icon name="schedule" size={18} className="text-muted-foreground" />;
  }
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return "-";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "-";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m ${s % 60}s`;
}

// New function to preserve parallel structure
function processStepGraph(graph: any): any[] {
  if (!graph) return [];
  if (Array.isArray(graph)) {
    return graph.map((node) => processStepGraph(node)).flat();
  }

  switch (graph.type) {
    case "step":
      return [
        {
          id: graph.step.id,
          type: "step",
          node: graph,
          isParallel: false,
        },
      ];
    case "sleep":
      return [{ id: graph.id, type: "sleep", node: graph, isParallel: false }];
    case "sleepUntil":
      return [
        {
          id: graph.id,
          type: "sleepUntil",
          node: graph,
          isParallel: false,
        },
      ];
    case "waitForEvent":
      return [
        {
          id: graph.step.id,
          type: "waitForEvent",
          node: graph,
          isParallel: false,
        },
      ];
    case "parallel":
      // Return as a single parallel group
      return [
        {
          type: "parallel",
          isParallel: true,
          steps: graph.steps.map((step: any) => processStepGraph(step)).flat(),
        },
      ];
    case "if": {
      const result = [
        {
          id: graph.id,
          type: "if",
          node: graph,
          isParallel: false,
        },
      ];
      if (graph.if) result.push(...processStepGraph(graph.if));
      if (graph.else) result.push(...processStepGraph(graph.else));
      return result;
    }
    case "try": {
      const tryResult = [
        {
          id: graph.id,
          type: "try",
          node: graph,
          isParallel: false,
        },
      ];
      if (graph.try) tryResult.push(...processStepGraph(graph.try));
      if (graph.catch) tryResult.push(...processStepGraph(graph.catch));
      return tryResult;
    }
    default:
      if (graph.id) {
        return [
          {
            id: graph.id,
            type: graph.type || "unknown",
            node: graph,
            isParallel: false,
          },
        ];
      }
      return [];
  }
}

function InstanceDetailTab() {
  const { workflowName = "", instanceId = "" } = useParams();
  const { data } = useWorkflowStatus(workflowName, instanceId);

  // 🔍 DEBUG: API Response Structure
  console.log("🚀 WORKFLOW API DATA:", data);
  console.log("📋 WORKFLOW API RAW (copy me):", JSON.stringify(data, null, 2));

  const snapshot = data?.snapshot;
  const status =
    typeof snapshot === "string" ? snapshot : snapshot?.status || "unknown";

  const badgeVariant = getStatusBadgeVariant(status);
  const statusIcon = getStatusIcon(status);
  const context = typeof snapshot === "string" ? undefined : snapshot?.context;
  const stepGraph =
    typeof snapshot === "string" ? [] : snapshot?.serializedStepGraph || [];

  // Use new processStepGraph to preserve parallel structure
  const processedSteps = processStepGraph(stepGraph);

  // Map step IDs to run data
  const contextMap = context || {};

  // For duration, use the earliest startedAt and latest endedAt among steps
  const startedAts = Object.values(contextMap)
    .map((s: any) => s.startedAt)
    .filter((v): v is number => typeof v === "number");
  const endedAts = Object.values(contextMap)
    .map((s: any) => s.endedAt)
    .filter((v): v is number => typeof v === "number");
  const duration = formatDuration(
    startedAts.length
      ? new Date(Math.min(...startedAts)).toISOString()
      : undefined,
    endedAts.length ? new Date(Math.max(...endedAts)).toISOString() : undefined,
  );

  return (
    <ScrollArea className="h-full">
      <div className="w-full px-4 sm:px-6 py-8">
        <div className="max-w-8xl mx-auto">
          <Card className="p-0 mb-6 shadow-lg border-2 border-muted">
            <CardContent className="p-4 sm:p-6 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-2">
                <div className="flex items-center gap-2 sm:gap-3 flex-1 flex-wrap">
                  {statusIcon}
                  <span className="text-xl font-bold">Status</span>
                  <Badge
                    variant={badgeVariant}
                    className="text-base px-3 py-1 capitalize"
                  >
                    {status}
                  </Badge>
                  <Icon
                    name="timer"
                    size={18}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-base">Duration:</span>
                  <span className="text-sm font-mono bg-muted rounded px-2 py-1">
                    {duration}
                  </span>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon
                    name="key"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-sm">Instance ID:</span>
                  <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                    {instanceId}
                  </span>
                  <CopyButton value={instanceId} />
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon
                    name="calendar_today"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-sm">Started:</span>
                  <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                    {startedAts.length
                      ? new Date(Math.min(...startedAts)).toLocaleString()
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon
                    name="calendar_today"
                    size={16}
                    className="text-muted-foreground"
                  />
                  <span className="font-semibold text-sm">Ended:</span>
                  <span className="text-xs font-mono bg-muted rounded px-2 py-1">
                    {endedAts.length
                      ? new Date(Math.max(...endedAts)).toLocaleString()
                      : "-"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="p-3 sm:p-4 mb-4">
            <OutputField label="Input Params" value={context?.input} />
            <OutputField
              label="Output"
              value={
                typeof snapshot === "string" ? undefined : snapshot?.result
              }
            />
          </Card>
          <h2 className="text-lg font-semibold mb-4">Steps</h2>

          {/* React Flow-based workflow visualization */}
          <WorkflowFlowVisualization
            processedSteps={processedSteps}
            contextMap={contextMap}
            workflowStatus={status}
          />
        </div>
      </div>
    </ScrollArea>
  );
}

const tabs: Record<string, Tab> = {
  instance: {
    Component: InstanceDetailTab,
    title: "Instance Details",
    active: true,
    initialOpen: true,
  },
};

function WorkflowDetailPage() {
  const { instanceId } = useParams();

  return (
    <PageLayout
      hideViewsButton
      tabs={tabs}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Workflows", link: "/workflows" },
            {
              label: `Instance ${instanceId?.slice(0, 8)}...`,
            },
          ]}
        />
      }
    />
  );
}

export default WorkflowDetailPage;
