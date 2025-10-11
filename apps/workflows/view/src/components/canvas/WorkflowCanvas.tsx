import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import ReactFlow, {
  ReactFlowProvider,
  useReactFlow,
  type Node,
  type Edge,
  Background,
} from "reactflow";
import { useWorkflowStore } from "../../store/workflowStore";
import { StepNode, NewStepNode, PlusButtonNode } from "./nodes";

export interface WorkflowCanvasRef {
  centerOnStep: (index: number) => void;
  centerOnNext: () => void;
  centerOnPrev: () => void;
}

const CARD_WIDTH = 640;
const CARD_GAP = 200;

const nodeTypes = {
  step: StepNode,
  newStep: NewStepNode,
  plusButton: PlusButtonNode,
};

const Inner = forwardRef<WorkflowCanvasRef>(function Inner(_, ref) {
  const rf = useReactFlow();
  const workflow = useWorkflowStore((s) => s.getCurrentWorkflow());
  const setIndex = useWorkflowStore((s) => s.setCurrentStepIndex);
  const currentStepIndex = useWorkflowStore(
    (s) => s.getCurrentWorkflow()?.currentStepIndex ?? 0,
  );

  const isCenteringRef = useRef<boolean>(false);
  const lockedXRef = useRef<number | null>(null);
  const hasInitializedRef = useRef<boolean>(false);
  const lastScrollTimeRef = useRef<number>(0);

  const stepIds = useMemo(
    () => workflow?.steps.map((s) => s.id).join(",") || "",
    [workflow?.steps],
  );

  const nodes = useMemo(() => {
    if (!workflow) return [];

    const result: Node[] = [];
    const Y_POSITION = 0; // All nodes at same Y level for proper centering

    // Case 1: No steps yet - show new step node
    if (workflow.steps.length === 0) {
      result.push({
        id: "new",
        type: "newStep",
        position: { x: 0, y: Y_POSITION },
        data: {},
        draggable: false,
      });
      return result;
    }

    // Case 2: Create step nodes horizontally aligned
    workflow.steps.forEach((step, index) => {
      const stepX = index * (CARD_WIDTH + CARD_GAP);

      result.push({
        id: step.id,
        type: "step",
        position: { x: stepX, y: Y_POSITION },
        data: { stepId: step.id },
        draggable: false,
      });
    });

    // Case 3: Add appropriate node at the end
    const nextX = workflow.steps.length * (CARD_WIDTH + CARD_GAP);

    if (currentStepIndex === workflow.steps.length) {
      // User is on the "new step" screen - show new step node
      result.push({
        id: "new",
        type: "newStep",
        position: { x: nextX, y: Y_POSITION },
        data: {},
        draggable: false,
      });
    } else {
      // User is viewing a step - show plus button centered vertically
      result.push({
        id: "plus-end",
        type: "plusButton",
        position: {
          x:
            (workflow.steps.length - 1) * (CARD_WIDTH + CARD_GAP) +
            CARD_WIDTH +
            80,
          y: Y_POSITION - 24, // Center the 48px button (half of button height)
        },
        data: {
          onClick: () => {
            if (workflow) {
              setIndex(workflow.id, workflow.steps.length);
            }
          },
        },
        draggable: false,
      });
    }

    return result;
  }, [stepIds, workflow, currentStepIndex, setIndex]);

  const edges = useMemo<Edge[]>(() => {
    if (!workflow) return [];

    const result: Edge[] = [];

    // Connect all consecutive step nodes
    for (let i = 0; i < workflow.steps.length - 1; i++) {
      result.push({
        id: `${workflow.steps[i].id}-${workflow.steps[i + 1].id}`,
        source: workflow.steps[i].id,
        target: workflow.steps[i + 1].id,
        animated: true,
      });
    }

    // Connect last step to new step node when on "new step" screen
    if (
      workflow.steps.length > 0 &&
      currentStepIndex === workflow.steps.length
    ) {
      result.push({
        id: `${workflow.steps[workflow.steps.length - 1].id}-new`,
        source: workflow.steps[workflow.steps.length - 1].id,
        target: "new",
        animated: true,
      });
    }

    return result;
  }, [stepIds, workflow, currentStepIndex]);

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!workflow || node.type === "plusButton") return;

      if (node.id === "new") {
        if (currentStepIndex !== workflow.steps.length) {
          setIndex(workflow.id, workflow.steps.length);
        }
        return;
      }

      const stepIndex = workflow.steps.findIndex((s) => s.id === node.id);
      if (stepIndex !== -1 && stepIndex !== currentStepIndex) {
        setIndex(workflow.id, stepIndex);
      }
    },
    [workflow, currentStepIndex, setIndex],
  );

  // Center on active step when currentStepIndex changes
  useEffect(() => {
    if (!workflow || nodes.length === 0 || isCenteringRef.current) return;

    let targetNode: Node | undefined;

    if (currentStepIndex === workflow.steps.length) {
      targetNode = nodes.find((n) => n.id === "new");
    } else if (currentStepIndex < workflow.steps.length) {
      const stepId = workflow.steps[currentStepIndex]?.id;
      targetNode = nodes.find((n) => n.id === stepId);
    }

    if (targetNode) {
      const centerX = targetNode.position.x + CARD_WIDTH / 2;

      const timer = setTimeout(() => {
        isCenteringRef.current = true;

        // On first load, center both X and Y to align cards in viewport center
        // Estimate card height ~300px, so center is at Y=150
        // After that, only center X and preserve Y scroll position
        const ESTIMATED_CARD_CENTER = 200;
        const targetY = hasInitializedRef.current
          ? rf.getViewport().y
          : -ESTIMATED_CARD_CENTER + globalThis.innerHeight / 2;

        rf.setViewport(
          {
            x: -centerX + globalThis.innerWidth / 2,
            y: targetY,
            zoom: 1,
          },
          { duration: hasInitializedRef.current ? 500 : 0 },
        );

        setTimeout(
          () => {
            lockedXRef.current = rf.getViewport().x;
            isCenteringRef.current = false;
            hasInitializedRef.current = true;
          },
          hasInitializedRef.current ? 550 : 50,
        );
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [currentStepIndex, workflow, nodes, rf]);

  // Lock horizontal position, allow vertical scrolling
  const handleMove = useCallback(
    (_event: unknown, viewport: { x: number; y: number }) => {
      if (isCenteringRef.current || lockedXRef.current === null) return;

      // Restore X position only, preserve Y for scrolling
      if (Math.abs(viewport.x - lockedXRef.current) > 5) {
        rf.setViewport(
          { x: lockedXRef.current, y: viewport.y, zoom: 1 },
          { duration: 0 },
        );
      }
    },
    [rf],
  );

  // Handle horizontal scroll to navigate between steps, allow vertical scroll
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (!workflow || isCenteringRef.current) return;

      // Detect horizontal scroll
      const isHorizontalScroll =
        Math.abs(event.deltaX) > Math.abs(event.deltaY);

      if (isHorizontalScroll) {
        // Prevent horizontal scroll to avoid shaking
        event.preventDefault();
        event.stopPropagation();

        const now = Date.now();
        const timeSinceLastScroll = now - lastScrollTimeRef.current;

        // Debounce: only trigger navigation if 600ms have passed since last scroll
        if (timeSinceLastScroll < 600) return;

        const scrollAmount = event.deltaX;

        // Threshold to trigger navigation
        if (Math.abs(scrollAmount) > 10) {
          lastScrollTimeRef.current = now;

          if (scrollAmount > 0) {
            // Scroll right -> next step
            const nextIndex = Math.min(
              currentStepIndex + 1,
              workflow.steps.length,
            );
            if (nextIndex !== currentStepIndex) {
              setIndex(workflow.id, nextIndex);
            }
          } else {
            // Scroll left -> previous step
            const prevIndex = Math.max(currentStepIndex - 1, 0);
            if (prevIndex !== currentStepIndex) {
              setIndex(workflow.id, prevIndex);
            }
          }
        }
      } else {
        // Allow vertical scroll by updating viewport Y position
        const currentViewport = rf.getViewport();
        rf.setViewport(
          {
            x: currentViewport.x,
            y: currentViewport.y - event.deltaY,
            zoom: 1,
          },
          { duration: 0 },
        );
      }
    },
    [workflow, currentStepIndex, setIndex, rf],
  );

  useImperativeHandle(
    ref,
    () => ({
      centerOnStep: (index: number) => {
        if (workflow) setIndex(workflow.id, index);
      },
      centerOnNext: () => {
        if (workflow) {
          const nextIndex = Math.min(
            currentStepIndex + 1,
            workflow.steps.length,
          );
          setIndex(workflow.id, nextIndex);
        }
      },
      centerOnPrev: () => {
        if (workflow) {
          const prevIndex = Math.max(currentStepIndex - 1, 0);
          setIndex(workflow.id, prevIndex);
        }
      },
    }),
    [workflow, currentStepIndex, setIndex],
  );

  return (
    <div onWheel={handleWheel} className="h-full w-full overflow-x-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={onNodeClick}
        onMove={handleMove}
        nodeTypes={nodeTypes}
        fitView={false}
        fitViewOptions={{ maxZoom: 1, minZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag={false}
        panOnScroll={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling
        minZoom={1}
        maxZoom={1}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        className="bg-background [&_.react-flow__pane]:!cursor-default [&_.react-flow__renderer]:cursor-default"
        proOptions={{ hideAttribution: true }}
        nodeOrigin={[0, 0.5]}
      >
        <Background color="hsl(var(--border))" gap={16} />
      </ReactFlow>
    </div>
  );
});

export default function WorkflowCanvas(
  _props: {},
  ref: React.Ref<WorkflowCanvasRef>,
) {
  return (
    <ReactFlowProvider>
      <Inner ref={ref} />
    </ReactFlowProvider>
  );
}

export const WorkflowCanvasWithRef = forwardRef(WorkflowCanvas);
