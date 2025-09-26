import type { WorkflowDefinition } from "@deco/sdk";
import { useWorkflowByUriV2 } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Background,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserInfo } from "../common/table/table-cells.tsx";
import { format } from "date-fns";
import { WorkflowSinkNode } from "./nodes/workflow-sink-node.tsx";
import { WorkflowSourceNode } from "./nodes/workflow-source-node.tsx";
import { WorkflowStepDisplayNode } from "./nodes/workflow-step-display-node.tsx";

// Extended workflow type for display (includes optional metadata)
export interface DisplayWorkflow
  extends Omit<
    WorkflowDefinition,
    "id" | "createdAt" | "updatedAt" | "executionState"
  > {
  id?: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  executionState?: Record<string, unknown>;
}

// Node types for the display canvas
const nodeTypes = {
  "workflow-source": WorkflowSourceNode,
  "workflow-sink": WorkflowSinkNode,
  "workflow-step": WorkflowStepDisplayNode,
};

interface WorkflowDisplayCanvasProps {
  resourceUri: string;
  onRefresh?: () => Promise<void>;
}

/**
 * Read-only workflow display canvas that shows workflows as a horizontal flow
 * No interactions - just visual representation
 */
export function WorkflowDisplayCanvas({
  resourceUri,
  onRefresh,
}: WorkflowDisplayCanvasProps) {
  const {
    data: resource,
    isLoading: isLoading,
    error,
    refetch,
  } = useWorkflowByUriV2(resourceUri);
  const effectiveWorkflow = resource?.data;
  const formattedUpdatedAt = useMemo(() => {
    if (!resource?.updated_at) return null;
    try {
      return format(new Date(resource.updated_at), "MMM d, yyyy 'at' h:mm a");
    } catch {
      return null;
    }
  }, [resource?.updated_at]);

  // Local loading state for refresh functionality
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Convert workflow to React Flow format for display
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return convertWorkflowToDisplayFlow(
      effectiveWorkflow || {
        name: resourceUri,
        description: "",
        inputSchema: {},
        outputSchema: {},
        steps: [],
      },
    );
  }, [effectiveWorkflow, resourceUri]);

  // React Flow state
  const [nodes, setNodes] = useNodesState<Node>(initialNodes);
  const [edges, setEdges] = useEdgesState<Edge>(initialEdges);

  // Update nodes when workflow changes
  useEffect(() => {
    if (!effectiveWorkflow) return;
    const { nodes: newNodes, edges: newEdges } =
      convertWorkflowToDisplayFlow(effectiveWorkflow);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [effectiveWorkflow, setNodes, setEdges]);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    if (onRefresh) {
      try {
        setIsRefreshing(true);
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
      return;
    }
    try {
      setIsRefreshing(true);
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, isRefreshing, resourceUri, refetch]);

  return (
    <div className="h-screen w-full flex flex-col">
      {/* Header with refresh button */}
      <div className="flex items-center justify-between p-4 border-b bg-white">
        <div>
          <h1 className="text-xl font-semibold">
            {effectiveWorkflow?.name || resourceUri || "Workflow"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {effectiveWorkflow?.description}
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing || isLoading}
          variant="outline"
          size="sm"
          className="min-w-[100px]"
        >
          <Icon
            name="refresh"
            size={16}
            className={`mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {/* Main canvas */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{
            padding: 0.1,
            minZoom: 0.3,
            maxZoom: 1.2,
          }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          preventScrolling={false}
        >
          <Background />
        </ReactFlow>
      </div>
    </div>
  );
}

/**
 * Convert workflow definition to React Flow nodes and edges for display
 */
function convertWorkflowToDisplayFlow(workflow: DisplayWorkflow) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Create source node (workflow input)
  const sourceNode: Node = {
    id: "source",
    type: "workflow-source",
    position: { x: 50, y: 100 },
    data: {
      title: "Workflow Input",
      description: "Input parameters for the workflow",
      schema: workflow.inputSchema,
    },
  };
  nodes.push(sourceNode);

  // Create step nodes
  workflow.steps.forEach((step, index) => {
    const stepNode: Node = {
      id: `step-${index}`,
      type: "workflow-step",
      position: { x: 300 + index * 250, y: 100 },
      data: {
        step,
        index,
        integrationId:
          (step as { type?: string; def?: { integration?: string } }).type ===
          "tool_call"
            ? (step as { type?: string; def?: { integration?: string } }).def
                ?.integration
            : undefined,
      },
    };
    nodes.push(stepNode);

    // Create edges between nodes
    const sourceId = index === 0 ? "source" : `step-${index - 1}`;
    const targetId = `step-${index}`;

    const edge: Edge = {
      id: `edge-${sourceId}-${targetId}`,
      source: sourceId,
      target: targetId,
      type: "smoothstep",
      animated: false,
    };
    edges.push(edge);
  });

  // Create sink node (workflow output)
  const sinkNode: Node = {
    id: "sink",
    type: "workflow-sink",
    position: { x: 300 + workflow.steps.length * 250, y: 100 },
    data: {
      title: "Workflow Output",
      description: "Final output of the workflow",
      schema: workflow.outputSchema,
    },
  };
  nodes.push(sinkNode);

  // Connect last step to sink
  if (workflow.steps.length > 0) {
    const lastStepId = `step-${workflow.steps.length - 1}`;
    const sinkEdge: Edge = {
      id: `edge-${lastStepId}-sink`,
      source: lastStepId,
      target: "sink",
      type: "smoothstep",
      animated: false,
    };
    edges.push(sinkEdge);
  }

  return { nodes, edges };
}
