import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react";
import ReactFlow, {
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  Background,
  type NodeChange,
} from "reactflow";
import {
  StepNode,
  NewStepNode,
  PlusButtonNode,
  WorkflowInputNode,
} from "./nodes";
import {
  useWorkflowStoreActions,
  useCurrentStepIndex,
  useWorkflowStepIds,
  useWorkflowStepsLength,
  useWorkflowStepsArray,
  useCurrentWorkflow,
} from "@/store/workflow";

export interface WorkflowCanvasRef {
  centerOnStep: (index: number) => void;
  centerOnNext: () => void;
  centerOnPrev: () => void;
}

const CARD_WIDTH = 640;
const CARD_GAP = 200;

// Move nodeTypes outside component to prevent recreation on every render
const nodeTypes = {
  step: StepNode,
  newStep: NewStepNode,
  plusButton: PlusButtonNode,
  workflowInput: WorkflowInputNode,
};

const Inner = forwardRef<WorkflowCanvasRef>(function Inner(_, ref) {
  const rf = useReactFlow();
  const stepsLength = useWorkflowStepsLength();
  const currentStepIndex = useCurrentStepIndex();
  const { setCurrentStepIndex } = useWorkflowStoreActions();
  const steps = useWorkflowStepsArray();
  const workflow = useCurrentWorkflow();

  const isCenteringRef = useRef<boolean>(false);
  const lastScrollTimeRef = useRef<number>(0);
  const lastCenteredStepRef = useRef<number>(-1);

  // Initial mount flag to trigger centering on first render
  const isInitialMountRef = useRef(true);

  // OPTIMIZED: Subscribe to primitive string of step IDs instead of full array
  // This prevents re-renders when step content changes, only when IDs change
  const stepIds = useWorkflowStepIds();

  // Check if first step has inputSchema to decide whether to show workflow input node
  // Must be defined early so centerViewport can use it
  const showWorkflowInputNode = useMemo(() => {
    // First, check if workflow has an inputSchema
    const workflowInputSchema = workflow?.inputSchema;
    const workflowHasInputSchema =
      workflowInputSchema &&
      typeof workflowInputSchema === "object" &&
      Object.keys(workflowInputSchema).length > 0;

    if (!workflowHasInputSchema) {
      return false; // Don't show if workflow doesn't have inputSchema
    }

    const firstStep = steps[0];

    // Only show if first step doesn't have its own inputSchema
    if (firstStep) {
      const firstStepHasInputSchema =
        firstStep.def &&
        "inputSchema" in firstStep.def &&
        firstStep.def.inputSchema &&
        typeof firstStep.def.inputSchema === "object" &&
        Object.keys(firstStep.def.inputSchema).length > 0;

      return !firstStepHasInputSchema;
    }

    // If no steps yet and workflow has inputSchema, show it
    return true;
  }, [steps, workflow?.inputSchema]);

  // Calculate a rough initial viewport to prevent initial jump
  const initialViewport = useMemo(() => {
    const estimatedViewportWidth = window.innerWidth;

    // If workflow input node is visible and we're on step 0, position for input node
    if (showWorkflowInputNode && currentStepIndex === 0) {
      const inputNodeOffset = -(CARD_WIDTH + CARD_GAP);
      const centeredX =
        estimatedViewportWidth / 2 - (inputNodeOffset + CARD_WIDTH / 2);
      return { x: centeredX, y: 0, zoom: 1 };
    }

    // Otherwise, center on the current step (steps start at x=0)
    const stepX = currentStepIndex * (CARD_WIDTH + CARD_GAP);
    const centeredX = estimatedViewportWidth / 2 - (stepX + CARD_WIDTH / 2);

    // Y will be adjusted by the centering effect shortly after mount
    return { x: centeredX, y: 0, zoom: 1 };
  }, []); // Only calculate once on mount

  // Center the viewport using actual node measurements from ReactFlow
  const centerViewport = useCallback(
    (stepIndex: number, animated = true) => {
      if (stepsLength === 0 && stepIndex > 0) return;

      isCenteringRef.current = true;

      const animationDuration = animated ? 600 : 0;

      // For step 0 with workflow input node visible, fit both nodes
      if ((stepIndex === 0 || stepsLength === 0) && showWorkflowInputNode) {
        // Fit both input node and first step (or new step node) in view
        const inputNodeId = "workflow-input";
        const stepNames = stepIds.split(",").filter(Boolean);
        const targetNodeId = stepsLength > 0 ? stepNames[0] : "new";

        const nodesToFit = [inputNodeId, targetNodeId].filter(Boolean);

        rf.fitView({
          padding: 0.1,
          nodes: nodesToFit.map((id) => ({ id })),
          duration: animationDuration,
          maxZoom: 1,
          minZoom: 0.7,
        });
      } else {
        // Calculate the X position for the current step
        // When workflow input is not visible, steps start at x=0
        const stepX = stepIndex * (CARD_WIDTH + CARD_GAP);
        const targetX = stepX + CARD_WIDTH / 2;

        // Get actual node height from ReactFlow's measurements
        // Get node ID from stepIds string
        const stepNames = stepIds.split(",").filter(Boolean);
        const nodeId =
          stepIndex < stepNames.length ? stepNames[stepIndex] : "new";
        const node = rf.getNode(nodeId);
        // ReactFlow stores measured dimensions internally after render
        const nodeHeight =
          (node as any)?.measured?.height || node?.height || 250;
        const targetY = nodeHeight / 2;

        rf.setCenter(targetX, targetY, {
          zoom: 1,
          duration: animationDuration,
        });
      }

      // Allow movement after centering animation completes
      // Add extra buffer time to ensure animation fully completes
      const bufferTime = animated ? 100 : 50;
      setTimeout(() => {
        isCenteringRef.current = false;
      }, animationDuration + bufferTime);
    },
    [stepsLength, stepIds, rf, showWorkflowInputNode],
  );

  // Center viewport when current step changes - only if step actually changed
  // OPTIMIZED: Single centering effect, removed duplicate output-change effect
  useEffect(() => {
    const isInitial = isInitialMountRef.current;

    if (lastCenteredStepRef.current === currentStepIndex && !isInitial) {
      return; // Already centered on this step
    }

    lastCenteredStepRef.current = currentStepIndex;
    isInitialMountRef.current = false;

    // Clear any pending dimension change timers to prevent interference
    if (dimensionChangeTimerRef.current) {
      clearTimeout(dimensionChangeTimerRef.current);
      dimensionChangeTimerRef.current = null;
    }

    // Minimal delay to ensure nodes are rendered, then animate smoothly
    const delay = isInitial ? 150 : 0;
    const timer = setTimeout(() => {
      centerViewport(currentStepIndex, !isInitial);
    }, delay);

    return () => clearTimeout(timer);
  }, [currentStepIndex, centerViewport]);

  // Memoize the plus button onClick to prevent React Flow warnings
  const handlePlusClick = useCallback(() => {
    setCurrentStepIndex(stepsLength);
  }, [stepsLength, setCurrentStepIndex]);

  // Memoize the data object for plus button to maintain stable reference
  const plusButtonData = useMemo(
    () => ({ onClick: handlePlusClick }),
    [handlePlusClick],
  );

  // CRITICAL: Memoize node data objects to prevent React Flow re-renders
  // React Flow compares data objects by reference - new objects = full re-render!
  const nodeDataMap = useMemo(() => {
    const map = new Map<string, { stepId: string }>();
    const stepNames = stepIds.split(",").filter(Boolean);
    stepNames.forEach((stepName) => {
      map.set(stepName, { stepId: stepName });
    });
    return map;
  }, [stepIds]);

  // Memoize empty data object for new step node
  const newStepData = useMemo(() => ({}), []);

  const nodes = useMemo(() => {
    const result: Node[] = [];
    const Y_POSITION = 0; // All nodes at same Y level for proper centering

    // Add workflow input node at the beginning only if needed
    if (showWorkflowInputNode) {
      result.push({
        id: "workflow-input",
        type: "workflowInput",
        position: { x: -(CARD_WIDTH + CARD_GAP), y: Y_POSITION },
        data: newStepData, // Reuse empty data object
        draggable: false,
      });
    }

    // Case 1: No steps yet - show new step node
    if (stepsLength === 0) {
      result.push({
        id: "new",
        type: "newStep",
        position: { x: 0, y: Y_POSITION },
        data: newStepData,
        draggable: false,
      });
      return result;
    }

    // Case 2: Create step nodes horizontally aligned
    // Split stepIds to get individual step names
    const stepNames = stepIds.split(",").filter(Boolean);
    stepNames.forEach((stepName: string, index: number) => {
      const stepX = index * (CARD_WIDTH + CARD_GAP);

      result.push({
        id: stepName,
        type: "step",
        position: { x: stepX, y: Y_POSITION },
        data: nodeDataMap.get(stepName)!, // Use stable reference from map
        draggable: false,
      });
    });

    // Case 3: Add appropriate node at the end
    const nextX = stepsLength * (CARD_WIDTH + CARD_GAP);

    if (currentStepIndex === stepsLength) {
      // User is on the "new step" screen - show new step node
      result.push({
        id: "new",
        type: "newStep",
        position: { x: nextX, y: Y_POSITION },
        data: newStepData,
        draggable: false,
      });
    } else {
      // User is viewing a step - show plus button
      result.push({
        id: "plus-end",
        type: "plusButton",
        position: {
          x: (stepsLength - 1) * (CARD_WIDTH + CARD_GAP) + CARD_WIDTH + 80,
          y: Y_POSITION, // Aligned with step nodes
        },
        data: plusButtonData,
        draggable: false,
      });
    }

    return result;
  }, [
    nodeDataMap,
    newStepData,
    stepsLength,
    currentStepIndex,
    plusButtonData,
    showWorkflowInputNode,
  ]);

  // OPTIMIZED: Simplified dependencies - only depend on stepIds, not full steps array
  const edges = useMemo<Edge[]>(() => {
    const result: Edge[] = [];
    const stepNames = stepIds.split(",").filter(Boolean);

    // Connect workflow input to first step with distinctive styling (only if shown)
    if (showWorkflowInputNode) {
      if (stepNames.length > 0) {
        result.push({
          id: "workflow-input-to-first",
          source: "workflow-input",
          target: stepNames[0],
          animated: true,
          style: {
            stroke: "hsl(var(--foreground))",
            strokeWidth: 2,
            strokeDasharray: "5,5",
          },
        });
      } else {
        // Connect workflow input to new step node if no steps exist
        result.push({
          id: "workflow-input-to-new",
          source: "workflow-input",
          target: "new",
          animated: true,
          style: {
            stroke: "hsl(var(--foreground))",
            strokeWidth: 2,
            strokeDasharray: "5,5",
          },
        });
      }
    }

    if (stepsLength === 0) return result;

    // Connect all consecutive step nodes
    for (let i = 0; i < stepNames.length - 1; i++) {
      result.push({
        id: `${stepNames[i]}-${stepNames[i + 1]}`,
        source: stepNames[i],
        target: stepNames[i + 1],
        animated: true,
        style: {
          stroke: "hsl(var(--foreground))",
          strokeWidth: 2,
        },
      });
    }

    // Connect last step to new step node when on "new step" screen
    if (currentStepIndex === stepsLength && stepNames.length > 0) {
      result.push({
        id: `${stepNames[stepNames.length - 1]}-new`,
        source: stepNames[stepNames.length - 1],
        target: "new",
        animated: true,
        style: {
          stroke: "hsl(var(--foreground))",
          strokeWidth: 2,
          strokeDasharray: "5,5",
        },
      });
    }

    return result;
  }, [stepIds, stepsLength, currentStepIndex, showWorkflowInputNode]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === "plusButton") return;

      if (node.id === "new") {
        if (currentStepIndex !== stepsLength) {
          setCurrentStepIndex(stepsLength);
        }
        return;
      }

      // Find step index by name using stepIds string
      const stepNames = stepIds.split(",").filter(Boolean);
      const stepIndex = stepNames.indexOf(node.id);

      if (stepIndex !== -1 && stepIndex !== currentStepIndex) {
        setCurrentStepIndex(stepIndex);
      }
    },
    [stepIds, stepsLength, currentStepIndex, setCurrentStepIndex],
  );

  // Debounce timer ref for dimension changes
  const dimensionChangeTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup dimension timer on unmount
  useEffect(() => {
    return () => {
      if (dimensionChangeTimerRef.current) {
        clearTimeout(dimensionChangeTimerRef.current);
      }
    };
  }, []);

  // Handle node dimension changes - re-center when current node dimensions change
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // Check if any dimension change affects the current step
      const hasDimensionChange = changes.some((change) => {
        if (change.type === "dimensions" && change.dimensions) {
          // Get the node ID and check if it's the current step
          const stepNames = stepIds.split(",").filter(Boolean);
          const currentNodeId = stepNames[currentStepIndex] || "new";
          return change.id === currentNodeId || change.id === "workflow-input";
        }
        return false;
      });

      if (hasDimensionChange) {
        // Debounce re-centering to avoid multiple calls during rapid dimension changes
        if (dimensionChangeTimerRef.current) {
          clearTimeout(dimensionChangeTimerRef.current);
        }

        // Wait longer than animation duration before re-centering
        dimensionChangeTimerRef.current = setTimeout(() => {
          // Check again if we're still animating when timer fires
          if (!isCenteringRef.current) {
            centerViewport(currentStepIndex, false); // No animation to prevent jarring
          }
          dimensionChangeTimerRef.current = null;
        }, 800); // Longer than animation (600ms) + buffer (100ms) + safety margin
      }
    },
    [stepIds, currentStepIndex, centerViewport],
  );

  // Lock canvas - prevent any panning
  const handleMove = useCallback(() => {
    // Don't prevent centering animation from completing
    // We rely on panOnDrag={false} and other ReactFlow props to prevent manual panning
    return;
  }, []);

  // OPTIMIZED: Handle horizontal scroll to navigate between steps with minimal DOM traversal
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (isCenteringRef.current) return;

      // OPTIMIZED: Quick check using closest() - much faster than manual traversal
      const target = event.target as HTMLElement;

      // If target is inside a scrollable container, allow native scrolling
      // Mark scrollable containers with data-scrollable="true" attribute
      if (target.closest('[data-scrollable="true"]')) {
        return;
      }

      // Detect horizontal scroll
      const isHorizontalScroll =
        Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (isHorizontalScroll) {
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        const timeSinceLastScroll = now - lastScrollTimeRef.current;

        // Debounce: only trigger navigation if enough time has passed
        // Account for animation duration (600ms) + buffer (100ms) + safety margin
        if (timeSinceLastScroll < 750) return;

        const scrollAmount = event.deltaX;
        const maxSteps = stepsLength;

        // Threshold to trigger navigation
        if (Math.abs(scrollAmount) > 10) {
          lastScrollTimeRef.current = now;

          if (scrollAmount > 0) {
            // Scroll right -> next step
            const nextIndex = Math.min(currentStepIndex + 1, maxSteps);
            if (nextIndex !== currentStepIndex) {
              setCurrentStepIndex(nextIndex);
            }
          } else {
            // Scroll left -> previous step
            const prevIndex = Math.max(currentStepIndex - 1, 0);
            if (prevIndex !== currentStepIndex) {
              setCurrentStepIndex(prevIndex);
            }
          }
        }
      }
    },
    [stepsLength, currentStepIndex, setCurrentStepIndex],
  );

  useImperativeHandle(
    ref,
    () => ({
      centerOnStep: (index: number) => {
        setCurrentStepIndex(index);
      },
      centerOnNext: () => {
        const nextIndex = Math.min(currentStepIndex + 1, stepsLength);
        setCurrentStepIndex(nextIndex);
      },
      centerOnPrev: () => {
        const prevIndex = Math.max(currentStepIndex - 1, 0);
        setCurrentStepIndex(prevIndex);
      },
    }),
    [stepsLength, currentStepIndex, setCurrentStepIndex],
  );

  return (
    <div onWheel={handleWheel} className="h-full w-full overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onNodesChange={onNodesChange}
        onMove={handleMove}
        nodeTypes={nodeTypes}
        fitView={false}
        fitViewOptions={{ maxZoom: 1, minZoom: 0.7 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        minZoom={0.7}
        maxZoom={1}
        defaultViewport={initialViewport}
        className="h-full w-full bg-background [&_.react-flow__pane]:!cursor-default [&_.react-flow__renderer]:cursor-default"
        proOptions={{ hideAttribution: true }}
        nodeOrigin={[0, 0]}
      >
        <Background color="hsl(var(--border))" gap={16} />
      </ReactFlow>
    </div>
  );
});

const WorkflowCanvas = forwardRef<WorkflowCanvasRef>(
  function WorkflowCanvas(_props, ref) {
    return (
      <ReactFlowProvider>
        <Inner ref={ref} />
      </ReactFlowProvider>
    );
  },
);

export default WorkflowCanvas;
