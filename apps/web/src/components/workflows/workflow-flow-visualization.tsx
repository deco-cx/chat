// deno-lint-ignore-file no-explicit-any
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addEdge,
  Background,
  type Connection,
  Controls,
  type Edge,
  Handle,
  MarkerType,
  type Node,
  Panel,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { JsonTreeViewer } from "../common/json-tree-viewer.tsx";

// Start Node Component
function StartNode({ data }: { data: any }) {
  const showHandles = data?.showHandles !== false;

  return (
    <div className="flex items-center justify-center w-16 h-16 bg-success rounded-full border-2 border-success-foreground shadow-lg relative">
      <Icon name="play_arrow" size={24} />
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
          background: showHandles ? "#22c55e" : "transparent",
          border: showHandles ? "2px solid #ffffff" : "none",
          width: 16,
          height: 16,
          borderRadius: "50%",
          zIndex: 10,
          opacity: showHandles ? 1 : 0,
        }}
      />
    </div>
  );
}

// End Node Component
function EndNode({ data }: { data: any }) {
  const showHandles = data?.showHandles !== false;

  return (
    <div className="flex items-center justify-center w-16 h-16 bg-muted rounded-full border-2 border-muted-foreground shadow-lg relative">
      <Icon name="stop" size={24} />
      <Handle
        type="target"
        position={Position.Top}
        style={{
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
          background: showHandles ? "#6b7280" : "transparent",
          border: showHandles ? "2px solid #ffffff" : "none",
          width: 16,
          height: 16,
          borderRadius: "50%",
          zIndex: 10,
          opacity: showHandles ? 1 : 0,
        }}
      />
    </div>
  );
}

// Copy Button Component (matches the one in detail.tsx)
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

// Utility functions
function formatStepId(id: string): string {
  return id
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
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

function getStepStatus(stepData: any, workflowStatus: string): string {
  if (!stepData) return "pending";
  if (stepData.error) return "failed";
  if (stepData.output && !stepData.error) return "completed";
  if (stepData.startedAt && !stepData.endedAt) return "running";
  if (!stepData.startedAt && !stepData.endedAt) return "pending";
  if (stepData.endedAt && !stepData.output && !stepData.error) return "skipped";
  // Fallback: if workflow is done but step has no data, mark as skipped
  if (
    (workflowStatus === "failed" ||
      workflowStatus === "completed" ||
      workflowStatus === "success") &&
    !stepData.startedAt
  ) {
    return "skipped";
  }
  return "pending";
}

function getStatusBadgeVariant(
  status: string,
): "default" | "destructive" | "secondary" | "outline" | "success" {
  if (status === "success" || status === "completed") return "success";
  if (status === "failed" || status === "errored") return "destructive";
  if (status === "running" || status === "in_progress") return "secondary";
  return "outline";
}

// Step Detail Content Component with toggleable sections (for Flow visualization)
function StepDetailContentFlow({
  hasError,
  hasInput,
  hasOutput,
  stepData,
}: {
  hasError: boolean;
  hasInput: boolean;
  hasOutput: boolean;
  stepData: any;
}) {
  const [activeSection, setActiveSection] = useState<
    "input" | "output" | "error" | null
  >(() => {
    // Auto-open the first available section
    if (hasError) return "error";
    if (hasInput) return "input";
    if (hasOutput) return "output";
    return null;
  });

  const toggleSection = (section: "input" | "output" | "error") => {
    setActiveSection(activeSection === section ? null : section);
  };

  return (
    <div className="space-y-4 py-4">
      {/* Error Section */}
      {hasError && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection("error")}
            className="w-full flex items-center justify-between p-4 bg-destructive/5 hover:bg-destructive/10 rounded-lg border border-destructive/20 transition-colors"
          >
            <h3 className="text-lg font-semibold text-destructive flex items-center gap-2">
              <Icon name="error" size={20} />
              Error
            </h3>
            <div className="flex items-center gap-2">
              <CopyButton value={stepData.error} />
              <Icon
                name={activeSection === "error" ? "expand_less" : "expand_more"}
                size={20}
                className="text-destructive"
              />
            </div>
          </button>
          {activeSection === "error" && (
            <Card className="border-destructive/30 mt-2">
              <CardContent className="p-4 max-h-[600px] overflow-y-auto">
                <JsonTreeViewer value={stepData.error} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Input Section */}
      {hasInput && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection("input")}
            className="w-full flex items-center justify-between p-4 bg-primary/5 hover:bg-primary/10 rounded-lg border border-primary/20 transition-colors"
          >
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
              <Icon name="input" size={20} />
              Input
            </h3>
            <div className="flex items-center gap-2">
              <CopyButton value={stepData.payload} />
              <Icon
                name={activeSection === "input" ? "expand_less" : "expand_more"}
                size={20}
                className="text-primary"
              />
            </div>
          </button>
          {activeSection === "input" && (
            <Card className="border-primary/30 mt-2">
              <CardContent className="p-4 max-h-[600px] overflow-y-auto">
                <JsonTreeViewer value={stepData.payload} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Output Section */}
      {hasOutput && (
        <div>
          <button
            type="button"
            onClick={() => toggleSection("output")}
            className="w-full flex items-center justify-between p-4 bg-success/5 hover:bg-success/10 rounded-lg border border-success/20 transition-colors"
          >
            <h3 className="text-lg font-semibold text-success flex items-center gap-2">
              <Icon name="check_circle" size={20} />
              Output
            </h3>
            <div className="flex items-center gap-2">
              <CopyButton value={stepData.output} />
              <Icon
                name={
                  activeSection === "output" ? "expand_less" : "expand_more"
                }
                size={20}
                className="text-success"
              />
            </div>
          </button>
          {activeSection === "output" && (
            <Card className="border-success/30 mt-2">
              <CardContent className="p-4 max-h-[600px] overflow-y-auto">
                <JsonTreeViewer value={stepData.output} />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

// Step Detail Modal Component
function StepDetailModal({
  step,
  isOpen,
  onClose,
}: {
  step: any;
  isOpen: boolean;
  onClose: () => void;
}) {
  const stepTitle = formatStepId(step?.data?.label || "");
  const hasError = step?.data?.stepData?.error;
  const hasOutput = step?.data?.stepData?.output;
  const hasInput = step?.data?.stepData?.payload;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="!max-w-[85vw] !w-[85vw] max-h-[90vh] overflow-hidden flex flex-col sm:!max-w-[85vw]">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-semibold">
                {stepTitle}
              </DialogTitle>
              <Badge
                variant={getStatusBadgeVariant(step?.data?.status || "")}
                className="text-sm"
              >
                {step?.data?.status}
              </Badge>
              {step?.data?.duration && (
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Icon name="timer" size={16} />
                  <span>{step.data.duration}</span>
                </div>
              )}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <StepDetailContentFlow
            hasError={hasError}
            hasInput={hasInput}
            hasOutput={hasOutput}
            stepData={step.data.stepData}
          />
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

// Custom Node Component for React Flow
function WorkflowStepNode({
  data,
  selected,
}: {
  data: any;
  selected?: boolean;
}) {
  let cardClasses =
    "relative transition-all duration-200 cursor-pointer hover:shadow-md";
  let borderClasses = "";
  let bgClasses = "";

  if (data.status === "skipped") {
    cardClasses += " opacity-60";
    borderClasses = "border-muted";
    bgClasses = "bg-muted/30";
  } else if (data.status === "failed") {
    borderClasses = "border-destructive";
    bgClasses = "bg-destructive/10";
  } else if (data.status === "running") {
    borderClasses = "border-primary";
    bgClasses = "bg-primary/10";
  } else if (data.status === "completed") {
    borderClasses = "border-success";
    bgClasses = "bg-success/10";
  } else {
    borderClasses = "border-muted";
    bgClasses = "bg-card";
  }

  if (selected) {
    borderClasses = "border-primary border-2";
  }

  const statusIcon = () => {
    switch (data.status) {
      case "completed":
        return <Icon name="check_circle" size={16} />;
      case "failed":
        return <Icon name="error" size={16} />;
      case "running":
        return <Icon name="hourglass_empty" size={16} />;
      case "skipped":
        return <Icon name="remove_circle" size={16} />;
      default:
        return <Icon name="radio_button_unchecked" size={16} />;
    }
  };

  const showHandles = data?.showHandles !== false;

  return (
    <div className="relative">
      {/* Input Handle - positioned absolutely to ensure visibility */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          top: -8,
          left: "50%",
          transform: "translateX(-50%)",
          background: showHandles ? "#3b82f6" : "transparent",
          border: showHandles ? "2px solid #ffffff" : "none",
          width: 16,
          height: 16,
          borderRadius: "50%",
          zIndex: 10,
          opacity: showHandles ? 1 : 0,
        }}
      />

      <Card
        className={`${cardClasses} ${borderClasses} ${bgClasses} w-48 min-h-[80px]`}
        onClick={data.onClick}
      >
        <CardContent className="p-3 flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex-shrink-0">{statusIcon()}</div>
              <h3 className="font-semibold text-sm truncate">{data.label}</h3>
            </div>
            <div className="text-muted-foreground flex-shrink-0">
              <Icon name="open_in_new" size={14} />
            </div>
          </div>

          {data.duration && (
            <div className="text-xs font-medium flex items-center gap-1 mt-1">
              <Icon name="timer" size={12} />
              {data.duration}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Output Handle - positioned absolutely to ensure visibility */}
      <Handle
        type="source"
        position={Position.Bottom}
        style={{
          bottom: -8,
          left: "50%",
          transform: "translateX(-50%)",
          background: showHandles ? "#3b82f6" : "transparent",
          border: showHandles ? "2px solid #ffffff" : "none",
          width: 16,
          height: 16,
          borderRadius: "50%",
          zIndex: 10,
          opacity: showHandles ? 1 : 0,
        }}
      />
    </div>
  );
}

// Custom Node Types
const nodeTypes = {
  workflowStep: WorkflowStepNode,
  startNode: StartNode,
  endNode: EndNode,
};

// Layout algorithm with improved parallel step alignment
function calculateLayout(
  steps: any[],
  contextMap: any,
  workflowStatus: string,
  onNodeClick: (node: any) => void,
  showHandles: boolean,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  let yPosition = 100;
  const xCenterPosition = 400; // Increased center position for better spacing
  const verticalSpacing = 180;
  const horizontalSpacing = 240; // Reduced spacing for parallel steps to bring them closer
  const nodeWidth = 192; // 48 * 4 = 192px (w-48)
  const startEndNodeWidth = 64; // 16 * 4 = 64px (w-16)
  const startEndGap = 70; // Reduced gap between start/end nodes and workflow steps
  const endGap = 30; // Reduced gap between last step and end node

  // Add Start Node - properly centered and closer to first step
  nodes.push({
    id: "start-node",
    type: "startNode",
    position: {
      x: xCenterPosition - startEndNodeWidth / 2,
      y: yPosition - startEndGap,
    },
    data: { label: "Start", showHandles },
    deletable: false,
    selectable: false,
  });

  yPosition += 20; // Reduced space after start node

  steps.forEach((step, index) => {
    if (step.isParallel) {
      // Handle parallel steps with more spacing for better curved arrows
      const parallelSteps = step.steps;
      const totalWidth =
        parallelSteps.length * nodeWidth +
        (parallelSteps.length - 1) * (horizontalSpacing - nodeWidth);
      const startX = xCenterPosition - totalWidth / 2;

      parallelSteps.forEach((parallelStep: any, parallelIndex: number) => {
        const stepData = contextMap[parallelStep.id];
        const status = getStepStatus(stepData, workflowStatus);
        const duration = formatDuration(
          stepData?.startedAt
            ? new Date(stepData.startedAt).toISOString()
            : undefined,
          stepData?.endedAt
            ? new Date(stepData.endedAt).toISOString()
            : undefined,
        );

        const nodeData = {
          label: formatStepId(parallelStep.id),
          status: status,
          stepData,
          duration,
          isParallel: true,
          showHandles,
          onClick: () =>
            onNodeClick({
              id: parallelStep.id,
              data: {
                label: formatStepId(parallelStep.id),
                status,
                stepData,
                duration,
              },
            }),
        };

        // Calculate position with increased spacing for better curves
        const nodeX = startX + parallelIndex * horizontalSpacing;

        nodes.push({
          id: parallelStep.id,
          type: "workflowStep",
          position: {
            x: nodeX,
            y: yPosition,
          },
          data: nodeData,
        });

        // Connect to previous step if exists
        if (index > 0) {
          const prevStep = steps[index - 1];
          if (prevStep.isParallel) {
            // Connect from all previous parallel steps to this step
            prevStep.steps.forEach((prevParallelStep: any) => {
              edges.push({
                id: `edge-${prevParallelStep.id}-${parallelStep.id}`,
                source: prevParallelStep.id,
                target: parallelStep.id,
                type: "smoothstep", // Use smoothstep for better curved appearance
                animated: status === "running",
                style: {
                  stroke: status === "running" ? "#3b82f6" : "#6b7280",
                  strokeWidth: 2,
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: status === "running" ? "#3b82f6" : "#6b7280",
                },
              });
            });
          } else {
            edges.push({
              id: `edge-${prevStep.id}-${parallelStep.id}`,
              source: prevStep.id,
              target: parallelStep.id,
              type: "smoothstep", // Use smoothstep for better curved appearance
              animated: status === "running",
              style: {
                stroke: status === "running" ? "#3b82f6" : "#6b7280",
                strokeWidth: 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: status === "running" ? "#3b82f6" : "#6b7280",
              },
            });
          }
        }
      });
    } else {
      // Handle single steps - properly centered
      const stepData = contextMap[step.id];
      const status = getStepStatus(stepData, workflowStatus);
      const duration = formatDuration(
        stepData?.startedAt
          ? new Date(stepData.startedAt).toISOString()
          : undefined,
        stepData?.endedAt
          ? new Date(stepData.endedAt).toISOString()
          : undefined,
      );

      const nodeData = {
        label: formatStepId(step.id),
        status: status,
        stepData,
        duration,
        isParallel: false,
        showHandles,
        onClick: () =>
          onNodeClick({
            id: step.id,
            data: { label: formatStepId(step.id), status, stepData, duration },
          }),
      };

      nodes.push({
        id: step.id,
        type: "workflowStep",
        position: {
          x: xCenterPosition - nodeWidth / 2, // Properly center the node
          y: yPosition,
        },
        data: nodeData,
      });

      // Connect to previous step if exists
      if (index > 0) {
        const prevStep = steps[index - 1];
        if (prevStep.isParallel) {
          // Connect from all previous parallel steps to this step
          prevStep.steps.forEach((prevParallelStep: any) => {
            edges.push({
              id: `edge-${prevParallelStep.id}-${step.id}`,
              source: prevParallelStep.id,
              target: step.id,
              type: "smoothstep", // Use smoothstep for better curved appearance
              animated: status === "running",
              style: {
                stroke: status === "running" ? "#3b82f6" : "#6b7280",
                strokeWidth: 2,
              },
              markerEnd: {
                type: MarkerType.ArrowClosed,
                color: status === "running" ? "#3b82f6" : "#6b7280",
              },
            });
          });
        } else {
          edges.push({
            id: `edge-${prevStep.id}-${step.id}`,
            source: prevStep.id,
            target: step.id,
            type: "default", // Keep default for sequential steps
            animated: status === "running",
            style: {
              stroke: status === "running" ? "#3b82f6" : "#6b7280",
              strokeWidth: 2,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: status === "running" ? "#3b82f6" : "#6b7280",
            },
          });
        }
      }
    }

    yPosition += verticalSpacing;
  });

  // Add End Node - properly centered and closer to last step
  nodes.push({
    id: "end-node",
    type: "endNode",
    position: {
      x: xCenterPosition - startEndNodeWidth / 2,
      y: yPosition - endGap, // Move end node closer by subtracting instead of adding
    },
    data: { label: "End", showHandles },
    deletable: false,
    selectable: false,
  });

  // Connect Start node to first step(s)
  if (steps.length > 0) {
    const firstStep = steps[0];
    if (firstStep.isParallel) {
      // Connect start to all parallel steps with smooth curves
      firstStep.steps.forEach((parallelStep: any) => {
        edges.push({
          id: `edge-start-node-${parallelStep.id}`,
          source: "start-node",
          target: parallelStep.id,
          type: "smoothstep", // Use smoothstep for better curved appearance
          style: {
            stroke: "#6b7280",
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#6b7280",
          },
        });
      });
    } else {
      // Connect start to single first step
      edges.push({
        id: `edge-start-node-${firstStep.id}`,
        source: "start-node",
        target: firstStep.id,
        type: "default", // Keep straight line for single connection
        style: {
          stroke: "#6b7280",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#6b7280",
        },
      });
    }
  }

  // Connect last step(s) to End node
  if (steps.length > 0) {
    const lastStep = steps[steps.length - 1];
    if (lastStep.isParallel) {
      // Connect all last parallel steps to end with smooth curves
      lastStep.steps.forEach((parallelStep: any) => {
        edges.push({
          id: `edge-${parallelStep.id}-end-node`,
          source: parallelStep.id,
          target: "end-node",
          type: "smoothstep", // Use smoothstep for better curved appearance
          style: {
            stroke: "#6b7280",
            strokeWidth: 2,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: "#6b7280",
          },
        });
      });
    } else {
      // Connect last single step to end
      edges.push({
        id: `edge-${lastStep.id}-end-node`,
        source: lastStep.id,
        target: "end-node",
        type: "default", // Keep straight line for single connection
        style: {
          stroke: "#6b7280",
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#6b7280",
        },
      });
    }
  }

  return { nodes, edges };
}

// Main Workflow Visualization Component
interface WorkflowFlowVisualizationProps {
  processedSteps: any[];
  contextMap: any;
  workflowStatus: string;
}

export function WorkflowFlowVisualization({
  processedSteps,
  contextMap,
  workflowStatus,
}: WorkflowFlowVisualizationProps) {
  const [selectedStep, setSelectedStep] = useState<any>(null);
  const showHandles = false; // Toggle this to show/hide the blue handle dots (keeps connections working)

  // Handle node click
  const handleNodeClick = useCallback((node: any) => {
    setSelectedStep(node);
  }, []);

  // Calculate layout
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      calculateLayout(
        processedSteps,
        contextMap,
        workflowStatus,
        handleNodeClick,
        showHandles,
      ),
    [processedSteps, contextMap, workflowStatus, handleNodeClick, showHandles],
  );

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when data changes
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = calculateLayout(
      processedSteps,
      contextMap,
      workflowStatus,
      handleNodeClick,
      showHandles,
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [
    processedSteps,
    contextMap,
    workflowStatus,
    handleNodeClick,
    showHandles,
    setNodes,
    setEdges,
  ]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds: Edge[]) => addEdge(params, eds)),
    [setEdges],
  );

  // Count step statuses for summary
  const statusCounts = useMemo(() => {
    const counts = {
      completed: 0,
      failed: 0,
      running: 0,
      pending: 0,
      skipped: 0,
    };
    nodes.forEach((node: Node) => {
      const status = node.data?.status as string;
      if (status && typeof status === "string" && status in counts) {
        counts[status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [nodes]);

  return (
    <div className="w-full h-[700px] relative bg-card rounded-lg border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{
          padding: 0.1,
          includeHiddenNodes: false,
        }}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={20}
          size={1}
          color="hsl(var(--muted-foreground))"
          style={{ opacity: 0.3 }}
        />
        <Controls
          position="bottom-right"
          showZoom
          showFitView
          showInteractive={false}
        />

        {/* Status Summary Panel */}
        <Panel position="top-left">
          <Card className="bg-card/90 backdrop-blur-sm border shadow-lg">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <Icon name="analytics" size={16} />
                Workflow Status
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-success rounded-full"></div>
                  <span>{statusCounts.completed} completed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full"></div>
                  <span>{statusCounts.failed} failed</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                  <span>{statusCounts.running} running</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                  <span>
                    {statusCounts.pending + statusCounts.skipped} pending
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Panel>

        {/* Instructions Panel */}
        <Panel position="top-right">
          <Card className="bg-card/90 backdrop-blur-sm border shadow-lg max-w-xs">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Icon name="mouse" size={12} />
                  <span>Click nodes for details</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="zoom_in" size={12} />
                  <span>Scroll to zoom</span>
                </div>
                <div className="flex items-center gap-2">
                  <Icon name="pan_tool" size={12} />
                  <span>Drag to pan</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </Panel>
      </ReactFlow>

      {/* Step Detail Modal */}
      {selectedStep && (
        <StepDetailModal
          step={selectedStep}
          isOpen={!!selectedStep}
          onClose={() => setSelectedStep(null)}
        />
      )}
    </div>
  );
}
