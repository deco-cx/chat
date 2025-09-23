import { useCallback } from "react";
import type { Edge, Node } from "@xyflow/react";
import {
  useStartSandboxWorkflow,
  useUpsertSandboxWorkflow,
} from "./sandbox-workflows.ts";
import type { WorkflowDefinition as Workflow, WorkflowStepDefinition as WorkflowStep } from "../mcp/workflows/schemas.ts";

/**
 * Hook for managing workflow builder state and operations
 * Uses the new unified step model where every step is autonomous code
 */
export function useWorkflowBuilder(workflow: Workflow) {
  /**
   * Convert workflow to React Flow nodes and edges
   * Simple, debuggable conversion in one place
   */
  const convertWorkflowToFlow = useCallback((workflow: Workflow) => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Convert each step to a node
    workflow.steps.forEach((step, index) => {
      const nodeId = step.id || `step-${index}`;

      // Create node with properly typed data
      const node: Node = {
        id: nodeId,
        type: "workflow-step", // Single unified node type
        position: {
          x: index * 300, // More spacing for better visibility
          y: 100,
        },
        data: {
          step,
          index,
          isFirst: index === 0,
          isLast: index === workflow.steps.length - 1,
        } satisfies Record<string, unknown>, // Ensure data matches React Flow's expected type
      };

      nodes.push(node);

      // Create edges between consecutive steps
      if (index > 0) {
        const prevNodeId = workflow.steps[index - 1].id || `step-${index - 1}`;
        edges.push({
          id: `edge-${prevNodeId}-${nodeId}`,
          source: prevNodeId,
          target: nodeId,
          type: "smoothstep",
        });
      }
    });

    return { nodes, edges };
  }, []);

  /**
   * Convert React Flow nodes back to workflow format
   * Simple reverse conversion, maintains order by x position
   */
  const convertFlowToWorkflow = useCallback(
    (nodes: Node[], _edges: Edge[]): Workflow => {
      // Sort nodes by x position to maintain step order
      const sortedNodes = [...nodes].sort(
        (a, b) => a.position.x - b.position.x,
      );

      // Extract steps from sorted nodes
      const steps: WorkflowStep[] = sortedNodes
        .filter((node) => node.type === "workflow-step")
        .map((node, index) => {
          const stepData = node.data.step as WorkflowStep;
          return {
            ...stepData,
            id: stepData.id || `step-${index}`,
          };
        });

      return {
        ...workflow,
        steps,
        updatedAt: new Date().toISOString(),
      };
    },
    [workflow],
  );

  // Hooks for API operations
  const upsertWorkflow = useUpsertSandboxWorkflow();
  const startWorkflow = useStartSandboxWorkflow();

  /**
   * Save workflow to backend
   * Temporarily converts to old format until backend is updated
   */
  const handleSaveWorkflow = useCallback(
    async (workflowToSave: Workflow) => {
      try {
        // Convert new step format to old format temporarily
        // TODO: Remove this conversion when backend supports new format
        const legacySteps = workflowToSave.steps.map((step) => ({
          type: "code" as const, // All steps are now code type
          def: {
            name: step.title,
            description: step.description,
            execute:
              step.code ||
              `export default async function(ctx) {
              // ${step.prompt}
              return {};
            }`,
            inputSchema: step.inputSchema || {},
            outputSchema: step.outputSchema || {},
          },
        }));

        const sandboxWorkflow = {
          name: workflowToSave.name,
          description: workflowToSave.description,
          inputSchema:
            (workflowToSave.inputSchema as Record<string, unknown>) || {},
          outputSchema:
            (workflowToSave.outputSchema as Record<string, unknown>) || {},
          steps: legacySteps,
        };

        await upsertWorkflow.mutateAsync(sandboxWorkflow);
        console.log("Workflow saved successfully:", workflowToSave.name);
        return true;
      } catch (error) {
        console.error("Failed to save workflow:", error);
        throw error;
      }
    },
    [upsertWorkflow],
  );

  /**
   * Execute workflow with optional input
   */
  const handleRunWorkflow = useCallback(
    async (workflowToRun: Workflow, input?: Record<string, unknown>) => {
      try {
        const result = await startWorkflow.mutateAsync({
          name: workflowToRun.name,
          input: input || {},
        });

        console.log("Workflow started successfully:", result);
        return result;
      } catch (error) {
        console.error("Failed to run workflow:", error);
        throw error;
      }
    },
    [startWorkflow],
  );

  /**
   * Add a new step to the workflow
   */
  const addStep = useCallback(
    (step: WorkflowStep, _position?: { x: number; y: number }) => {
      const newStep: WorkflowStep = {
        ...step,
        id: step.id || `step-${Date.now()}`,
      };

      const newWorkflow: Workflow = {
        ...workflow,
        steps: [...workflow.steps, newStep],
        updatedAt: new Date().toISOString(),
      };

      return newWorkflow;
    },
    [workflow],
  );

  /**
   * Update an existing step
   */
  const updateStep = useCallback(
    (stepId: string, updates: Partial<WorkflowStep>) => {
      const newWorkflow: Workflow = {
        ...workflow,
        steps: workflow.steps.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step,
        ),
        updatedAt: new Date().toISOString(),
      };

      return newWorkflow;
    },
    [workflow],
  );

  /**
   * Remove a step from the workflow
   */
  const removeStep = useCallback(
    (stepId: string) => {
      const newWorkflow: Workflow = {
        ...workflow,
        steps: workflow.steps.filter((step) => step.id !== stepId),
        updatedAt: new Date().toISOString(),
      };

      return newWorkflow;
    },
    [workflow],
  );

  return {
    // Conversion functions
    convertWorkflowToFlow,
    convertFlowToWorkflow,

    // API operations
    handleSaveWorkflow,
    handleRunWorkflow,

    // Step management
    addStep,
    updateStep,
    removeStep,

    // Status from mutations
    isSaving: upsertWorkflow.isPending,
    isRunning: startWorkflow.isPending,
    saveError: upsertWorkflow.error,
    runError: startWorkflow.error,
  };
}
