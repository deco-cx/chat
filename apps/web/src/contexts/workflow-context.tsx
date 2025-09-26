import { createContext, ReactNode, useContext, useReducer } from "react";
import type { StepExecutionResult, WorkflowDefinition, WorkflowStep } from "@deco/sdk";
import { useExecuteWorkflowStep, useUpsertSandboxWorkflow } from "@deco/sdk";

// ============= State Types =============

interface WorkflowState {
  // Core workflow data
  workflow: WorkflowDefinition;

  // UI state
  currentStepIndex: number;
  isEditing: boolean;
  editingStepId: string | null;

  // Execution state
  isExecuting: boolean;
  executionResults: Record<string, StepExecutionResult>;

  // Developer tools
  showDevBar: boolean;
  devBarTab: "state" | "config" | "logs" | "debug";

  // Workflow metadata
  isDirty: boolean;
  isSaving: boolean;
  lastSaved: string | null;

  // Error handling
  error: string | null;
}

// ============= Action Types =============

type WorkflowAction =
  | { type: "SET_WORKFLOW"; payload: WorkflowDefinition }
  | { type: "ADD_STEP"; payload: WorkflowStep }
  | {
      type: "UPDATE_STEP";
      payload: { stepId: string; updates: Partial<WorkflowStep> };
    }
  | { type: "DELETE_STEP"; payload: string }
  | { type: "REORDER_STEPS"; payload: { from: number; to: number } }
  | { type: "NAVIGATE_TO_STEP"; payload: number }
  | { type: "NEXT_STEP" }
  | { type: "PREVIOUS_STEP" }
  | { type: "START_EDITING"; payload: string | null }
  | { type: "STOP_EDITING" }
  | { type: "START_EXECUTION"; payload: string }
  | {
      type: "EXECUTION_COMPLETE";
      payload: { stepId: string; result: StepExecutionResult };
    }
  | { type: "EXECUTION_ERROR"; payload: { stepId: string; error: string } }
  | { type: "TOGGLE_DEV_BAR" }
  | { type: "SET_DEV_TAB"; payload: "state" | "config" | "logs" | "debug" }
  | { type: "MARK_DIRTY" }
  | { type: "MARK_CLEAN" }
  | { type: "START_SAVING" }
  | { type: "SAVE_COMPLETE"; payload: string }
  | { type: "SAVE_ERROR"; payload: string }
  | { type: "SET_ERROR"; payload: string | null };

// ============= Reducer =============

function workflowReducer(
  state: WorkflowState,
  action: WorkflowAction,
): WorkflowState {
  switch (action.type) {
    case "SET_WORKFLOW":
      return {
        ...state,
        workflow: action.payload,
        currentStepIndex: 0,
        isDirty: false,
      };

    case "ADD_STEP": {
      const newStep = action.payload;
      const insertIndex = state.currentStepIndex + 1;
      const newSteps = [
        ...state.workflow.steps.slice(0, insertIndex),
        newStep,
        ...state.workflow.steps.slice(insertIndex),
      ];

      return {
        ...state,
        workflow: {
          ...state.workflow,
          steps: newSteps,
          updatedAt: new Date().toISOString(),
        },
        currentStepIndex: insertIndex,
        isDirty: true,
      };
    }

    case "UPDATE_STEP": {
      const { stepId, updates } = action.payload;
      return {
        ...state,
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.map((step) =>
            step.id === stepId ? { ...step, ...updates } : step,
          ),
          updatedAt: new Date().toISOString(),
        },
        isDirty: true,
      };
    }

    case "DELETE_STEP": {
      const stepId = action.payload;

      return {
        ...state,
        workflow: {
          ...state.workflow,
          steps: state.workflow.steps.filter((s) => s.id !== stepId),
          updatedAt: new Date().toISOString(),
        },
        currentStepIndex: Math.min(
          state.currentStepIndex,
          state.workflow.steps.length - 2,
        ),
        isDirty: true,
      };
    }

    case "NAVIGATE_TO_STEP":
      return {
        ...state,
        currentStepIndex: Math.max(
          0,
          Math.min(action.payload, state.workflow.steps.length),
        ),
      };

    case "NEXT_STEP":
      return {
        ...state,
        currentStepIndex: Math.min(
          state.currentStepIndex + 1,
          state.workflow.steps.length,
        ),
      };

    case "PREVIOUS_STEP":
      return {
        ...state,
        currentStepIndex: Math.max(0, state.currentStepIndex - 1),
      };

    case "START_EDITING":
      return {
        ...state,
        isEditing: true,
        editingStepId: action.payload,
      };

    case "STOP_EDITING":
      return {
        ...state,
        isEditing: false,
        editingStepId: null,
      };

    case "START_EXECUTION":
      return {
        ...state,
        isExecuting: true,
      };

    case "EXECUTION_COMPLETE":
      return {
        ...state,
        isExecuting: false,
        executionResults: {
          ...state.executionResults,
          [action.payload.stepId]: action.payload.result,
        },
        workflow: {
          ...state.workflow,
          executionState: {
            ...state.workflow.executionState,
            [action.payload.stepId]: action.payload.result,
          },
        },
      };

    case "TOGGLE_DEV_BAR":
      return {
        ...state,
        showDevBar: !state.showDevBar,
      };

    case "SET_DEV_TAB":
      return {
        ...state,
        devBarTab: action.payload,
      };

    case "MARK_DIRTY":
      return { ...state, isDirty: true };

    case "MARK_CLEAN":
      return { ...state, isDirty: false };

    case "START_SAVING":
      return { ...state, isSaving: true };

    case "SAVE_COMPLETE":
      return {
        ...state,
        isSaving: false,
        isDirty: false,
        lastSaved: action.payload,
        error: null,
      };

    case "SAVE_ERROR":
      return {
        ...state,
        isSaving: false,
        error: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    default:
      return state;
  }
}

// ============= Context Provider =============

interface WorkflowContextValue {
  state: WorkflowState;
  dispatch: React.Dispatch<WorkflowAction>;

  // Computed values
  currentStep: WorkflowStep | null;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  totalSteps: number;

  // Helper functions
  navigateToStep: (index: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  addStep: (step: WorkflowStep) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  deleteStep: (stepId: string) => void;
  startEditing: (stepId?: string) => void;
  stopEditing: () => void;
  executeStep: (stepId: string) => Promise<void>;
  saveWorkflow: () => Promise<void>;
}

const WorkflowContext = createContext<WorkflowContextValue | null>(null);

export function WorkflowProvider({
  children,
  initialWorkflow,
}: {
  children: ReactNode;
  initialWorkflow: WorkflowDefinition;
}) {
  const [state, dispatch] = useReducer(workflowReducer, {
    workflow: initialWorkflow,
    currentStepIndex: 0,
    isEditing: false,
    editingStepId: null,
    isExecuting: false,
    executionResults: initialWorkflow.executionState || {},
    showDevBar: false,
    devBarTab: "state",
    isDirty: false,
    isSaving: false,
    lastSaved: null,
    error: null,
  });

  // Hooks for API calls
  const executeStep = useExecuteWorkflowStep();
  const _saveWorkflowMutation = useUpsertSandboxWorkflow();

  // Computed values
  const currentStep = state.workflow.steps[state.currentStepIndex] || null;
  const canNavigateBack = state.currentStepIndex > 0;
  const canNavigateForward =
    state.currentStepIndex < state.workflow.steps.length;
  const totalSteps = state.workflow.steps.length;

  // Helper functions
  const navigateToStep = (index: number) => {
    dispatch({ type: "NAVIGATE_TO_STEP", payload: index });
  };

  const nextStep = () => dispatch({ type: "NEXT_STEP" });
  const previousStep = () => dispatch({ type: "PREVIOUS_STEP" });

  const addStep = (step: WorkflowStep) => {
    dispatch({ type: "ADD_STEP", payload: step });
  };

  const updateStep = (stepId: string, updates: Partial<WorkflowStep>) => {
    dispatch({ type: "UPDATE_STEP", payload: { stepId, updates } });
  };

  const deleteStep = (stepId: string) => {
    dispatch({ type: "DELETE_STEP", payload: stepId });
  };

  const startEditing = (stepId?: string) => {
    dispatch({ type: "START_EDITING", payload: stepId || null });
  };

  const stopEditing = () => {
    dispatch({ type: "STOP_EDITING" });
  };

  const executeStepHandler = async (stepId: string) => {
    dispatch({ type: "START_EXECUTION", payload: stepId });

    try {
      // Find the step to execute
      const step = state.workflow.steps.find((s) => s.id === stepId);
      if (!step) {
        throw new Error(`Step ${stepId} not found`);
      }

      // Execute the step with real sandbox
      const result = await executeStep.mutateAsync({
        step,
        workflowInput: {}, // TODO: Get actual workflow input
        previousResults: state.executionResults,
      });

      dispatch({
        type: "EXECUTION_COMPLETE",
        payload: { stepId, result },
      });
    } catch (error) {
      dispatch({
        type: "EXECUTION_ERROR",
        payload: {
          stepId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  };

  const saveWorkflow = async () => {
    dispatch({ type: "START_SAVING" });

    try {
      // TODO: Call save API
      await new Promise((resolve) => setTimeout(resolve, 1000));

      dispatch({
        type: "SAVE_COMPLETE",
        payload: new Date().toISOString(),
      });
    } catch (error) {
      dispatch({
        type: "SAVE_ERROR",
        payload: error instanceof Error ? error.message : "Save failed",
      });
    }
  };

  const value: WorkflowContextValue = {
    state,
    dispatch,
    currentStep,
    canNavigateBack,
    canNavigateForward,
    totalSteps,
    navigateToStep,
    nextStep,
    previousStep,
    addStep,
    updateStep,
    deleteStep,
    startEditing,
    stopEditing,
    executeStep: executeStepHandler,
    saveWorkflow,
  };

  return (
    <WorkflowContext.Provider value={value}>
      {children}
    </WorkflowContext.Provider>
  );
}

export function useWorkflowContext() {
  const context = useContext(WorkflowContext);
  if (!context) {
    throw new Error("useWorkflowContext must be used within WorkflowProvider");
  }
  return context;
}
