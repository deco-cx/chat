import { WorkflowDefinition } from "@deco/sdk";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StepExecution {
  start?: string;
  end?: string;
  error?: { name?: string; message?: string } | null;
  success?: boolean;
}

export interface State {
  workflow: WorkflowDefinition;
  stepOutputs: Record<string, unknown>;
  stepInputs: Record<string, unknown>;
  stepExecutions: Record<string, StepExecution>;
}

export interface Actions {
  setStepOutput: (stepName: string, output: unknown) => void;
  setStepInput: (stepName: string, input: unknown) => void;
  setStepExecutionStart: (stepName: string) => void;
  setStepExecutionEnd: (
    stepName: string,
    success: boolean,
    error?: { name?: string; message?: string },
  ) => void;
}

export interface Store extends State {
  actions: Actions;
}

export const createWorkflowStore = (initialState: Pick<State, "workflow">) => {
  // Create a unique storage key based on the workflow name
  const storageKey = `workflow-store-${initialState.workflow.name}`;

  return create<Store>()(
    persist(
      (set) => ({
        ...initialState,
        stepOutputs: {},
        stepInputs: {},
        stepExecutions: {},
        actions: {
          setStepOutput: (stepName, output) =>
            set((state) => ({
              stepOutputs: { ...state.stepOutputs, [stepName]: output },
            })),
          setStepInput: (stepName, input) =>
            set((state) => ({
              stepInputs: { ...state.stepInputs, [stepName]: input },
            })),
          setStepExecutionStart: (stepName) =>
            set((state) => ({
              stepExecutions: {
                ...state.stepExecutions,
                [stepName]: {
                  start: new Date().toISOString(),
                  end: undefined,
                  error: null,
                  success: undefined,
                },
              },
            })),
          setStepExecutionEnd: (stepName, success, error) =>
            set((state) => {
              const prev = state.stepExecutions[stepName] || {};
              return {
                stepExecutions: {
                  ...state.stepExecutions,
                  [stepName]: {
                    ...prev,
                    end: new Date().toISOString(),
                    success,
                    error: error || null,
                  },
                },
              };
            }),
        },
      }),
      {
        name: storageKey,
        partialize: (state) => ({
          stepOutputs: state.stepOutputs,
          stepInputs: state.stepInputs,
        }),
      },
    ),
  );
};
