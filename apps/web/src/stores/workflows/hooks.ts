import { useShallow } from "zustand/react/shallow";
import { useWorkflowStore } from "./provider";

export function useWorkflowName() {
  return useWorkflowStore((state) => state.workflow.name);
}

export function useWorkflowDescription() {
  return useWorkflowStore((state) => state.workflow.description);
}

export function useWorkflowStepNames() {
  return useWorkflowStore(
    useShallow((state) => state.workflow.steps.map((step) => step.def.name)),
  );
}

export function useWorkflowStepInput(stepName: string) {
  const step = useWorkflowStore((state) =>
    state.workflow.steps.find((step) => step.def.name === stepName),
  );
  const stepInput = useWorkflowStore((state) => state.stepInputs[stepName]);
  if (
    stepInput !== undefined &&
    typeof stepInput === "object" &&
    stepInput !== null &&
    Object.keys(stepInput).length > 0
  ) {
    return stepInput;
  }
  return step?.input;
}

export function useWorkflowFirstStepInput() {
  return useWorkflowStore(
    (state) => state.stepInputs[state.workflow.steps[0].def.name],
  );
}

export function useWorkflowStepOutput(stepName: string) {
  return useWorkflowStore((state) => state.stepOutputs[stepName]);
}

export function useWorkflowStepDefinition(stepName: string) {
  return useWorkflowStore(
    (state) =>
      state.workflow.steps.find((step) => step.def.name === stepName)?.def,
  );
}

export function useWorkflowStepOutputs() {
  return useWorkflowStore(useShallow((state) => state.stepOutputs));
}
export function useWorkflowUri() {
  const name = useWorkflowStore((state) => state.workflow.name);
  return `rsc://i:workflows-management/workflow/${name}`;
}

export function useWorkflowActions() {
  return useWorkflowStore(useShallow((state) => state.actions));
}

export function useWorkflowStepExecution(stepName: string) {
  return useWorkflowStore((state) => state.stepExecutions[stepName]);
}
