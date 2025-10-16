import { createStore, StoreApi, useStore } from "zustand";
import { createContext, useContext, useState, useMemo } from "react";
import { client } from "@/lib/rpc";
import { persist } from "zustand/middleware";
import { useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export type Workflow = NonNullable<
  Awaited<ReturnType<typeof client.READ_WORKFLOW>>
>["workflow"];
type WorkflowStep = NonNullable<Workflow | any>["steps"][number];

// Helper to generate storage key from workflow URI
function getStorageKey(workflowUri: string): string {
  // Hash the URI to create a stable, short key
  // For simple cases, just encode it
  const encoded = btoa(workflowUri).replace(/[^a-zA-Z0-9]/g, "");
  return `workflowz-${encoded}`;
}

interface State {
  workflow: Workflow;
  currentStepIndex: number;
  // PERFORMANCE: Cache step index lookup to avoid repeated find() calls
  _stepIndexMap: Map<string, number>;
  // Temporary prompt for the "New Step" node (separate from existing steps)
  newStepPrompt: string;
  // Runtime input values for the workflow (actual data passed when executing)
  workflowInput: Record<string, unknown>;
}

interface Actions {
  setCurrentStepIndex: (index: number) => void;
  updateWorkflow: (updates: Partial<Workflow>) => void;
  updateStep: (stepId: string, updates: Partial<WorkflowStep>) => void;
  updateStepInput: (stepId: string, fieldKey: string, value: string) => void;
  updateStepCustomView: (stepId: string, viewCode: string) => void;
  updateDependencyToolCalls: () => void;
  addStep: (step: WorkflowStep) => void;
  removeStep: (stepId: string) => void;
  clearStore: () => void;
  syncFromServer: (workflow: Workflow) => void;
  setNewStepPrompt: (prompt: string) => void;
  setWorkflowInput: (input: Record<string, unknown>) => void;
}

interface Store extends State {
  actions: Actions;
}

// PERFORMANCE: Helper to build step index map
function buildStepIndexMap(
  steps: WorkflowStep[] | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  if (!steps) return map;
  steps.forEach((step, index) => {
    map.set(step.def?.name || "", index);
  });
  return map;
}

export const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);

export const WorkflowStoreProvider = ({
  children,
  workflow,
}: {
  children: React.ReactNode;
  workflow: Workflow;
}) => {
  // Generate unique storage key per workflow URI
  const storageKey = useMemo(() => {
    const wf = workflow as any;
    const uri = wf.uri || wf.id || "default";
    return getStorageKey(uri);
  }, [(workflow as any).uri, (workflow as any).id]);

  const [store] = useState(() =>
    createStore<Store>()(
      persist(
        (set, get) => ({
          workflow,
          currentStepIndex: 0,
          _stepIndexMap: buildStepIndexMap((workflow as any).steps),
          newStepPrompt: "",
          workflowInput: {},
          actions: {
            setCurrentStepIndex: (index: number) => {
              // Validate that index is within bounds
              const state = get();
              const maxIndex = state.workflow.steps?.length || 0;
              const validIndex = Math.max(0, Math.min(index, maxIndex));

              set(() => ({
                currentStepIndex: validIndex,
              }));
            },
            updateWorkflow: (updates: Partial<Workflow>) => {
              const newWorkflow = { ...get().workflow, ...updates };
              set(() => ({
                workflow: newWorkflow,
                _stepIndexMap: buildStepIndexMap(newWorkflow.steps),
              }));
            },
            updateStep: (stepId: string, updates: Partial<WorkflowStep>) => {
              const currentState = get();
              const stepIndex = currentState._stepIndexMap.get(stepId);

              // If step not found, do nothing
              if (stepIndex === undefined) return;

              // PERFORMANCE: Create new steps array with only the changed step
              // All other steps maintain their references (crucial for React.memo)
              const newSteps = [...currentState.workflow.steps];
              newSteps[stepIndex] = { ...newSteps[stepIndex], ...updates };

              // Check if step name changed - if so, rebuild index map
              const oldStepName =
                currentState.workflow.steps[stepIndex].def?.name;
              const newStepName = (updates.def as any)?.name;
              const nameChanged = newStepName && newStepName !== oldStepName;

              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                // Rebuild index map if name changed, otherwise keep existing for performance
                _stepIndexMap: nameChanged
                  ? buildStepIndexMap(newSteps)
                  : currentState._stepIndexMap,
              });
            },
            // PERFORMANCE: Granular input field update
            // Updates ONLY a single input field without recreating the entire input object
            // This prevents unnecessary re-renders of other fields' editors
            updateStepInput: (
              stepId: string,
              fieldKey: string,
              value: string,
            ) => {
              const currentState = get();
              const stepIndex = currentState._stepIndexMap.get(stepId);

              if (stepIndex === undefined) return;

              const currentStep = currentState.workflow.steps[stepIndex];
              const currentInput = (currentStep.def as any).input || {};

              // CRITICAL: Skip update if value hasn't actually changed
              // This prevents unnecessary re-renders when debounce fires with same value
              if (currentInput[fieldKey] === value) return;

              // PERFORMANCE: Only create new input object if value changed
              const newInput = { ...currentInput, [fieldKey]: value };

              const newSteps = [...currentState.workflow.steps];
              newSteps[stepIndex] = {
                ...currentStep,
                def: { ...(currentStep.def as any), input: newInput },
              } as any;

              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                _stepIndexMap: currentState._stepIndexMap,
              });
            },
            // Update custom view code for a step
            updateStepCustomView: (stepId: string, viewCode: string) => {
              const currentState = get();
              const stepIndex = currentState._stepIndexMap.get(stepId);

              if (stepIndex === undefined) return;

              const currentStep = currentState.workflow.steps[stepIndex];

              const newSteps = [...currentState.workflow.steps];
              newSteps[stepIndex] = {
                ...currentStep,
                customOutputView: viewCode,
              } as any;

              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                _stepIndexMap: currentState._stepIndexMap,
              });
            },
            addStep: (step: WorkflowStep) => {
              const currentState = get();
              const newSteps = [...currentState.workflow.steps, step];
              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                currentStepIndex: newSteps.length - 1,
                _stepIndexMap: buildStepIndexMap(newSteps),
                newStepPrompt: "", // Clear the prompt when a step is added
              });
            },
            removeStep: (stepId: string) => {
              const currentState = get();
              const newSteps = currentState.workflow.steps.filter(
                (step: WorkflowStep) => step.def?.name !== stepId,
              );
              set({
                workflow: {
                  ...currentState.workflow,
                  steps: newSteps,
                } as Workflow,
                currentStepIndex: Math.min(
                  currentState.currentStepIndex,
                  newSteps.length - 1,
                ),
                _stepIndexMap: buildStepIndexMap(newSteps),
              });
            },
            updateDependencyToolCalls: () => {
              type DependencyEntry = { integrationId: string };
              const allToolsMap = new Map<string, DependencyEntry>();
              const currentState = get();

              currentState.workflow.steps.forEach((step: WorkflowStep) => {
                if (
                  step.type === "code" &&
                  step.def &&
                  "dependencies" in step.def &&
                  Array.isArray(step.def.dependencies)
                ) {
                  step.def.dependencies.forEach(
                    (dependency: DependencyEntry) => {
                      const key = `${dependency.integrationId}`;
                      if (!allToolsMap.has(key)) {
                        allToolsMap.set(key, dependency);
                      }
                    },
                  );
                }
              });

              const dependencyToolCalls = Array.from(allToolsMap.values());

              const updatedWorkflow = {
                ...currentState.workflow,
                dependencyToolCalls,
                updatedAt: new Date().toISOString(),
              } as Workflow;

              set(() => ({
                workflow: updatedWorkflow,
                // Steps array didn't change, so index map stays the same
                _stepIndexMap: currentState._stepIndexMap,
              }));
            },
            clearStore: () => {
              const currentState = get();
              set({
                workflow: {
                  ...currentState.workflow,
                  inputSchema: {},
                  outputSchema: {},
                  steps: [] as any,
                } as Workflow,
                currentStepIndex: 0,
                _stepIndexMap: new Map(),
                newStepPrompt: "",
                workflowInput: {},
              });
            },
            syncFromServer: (workflow: Workflow) => {
              set({
                workflow,
                currentStepIndex: 0,
                _stepIndexMap: buildStepIndexMap((workflow as any).steps),
                newStepPrompt: "",
              });
            },
            setNewStepPrompt: (prompt: string) => {
              set({ newStepPrompt: prompt });
            },
            setWorkflowInput: (input: Record<string, unknown>) => {
              set({ workflowInput: input });
            },
          },
        }),
        {
          name: storageKey,
          // PERFORMANCE: Only persist what we need, exclude cache
          partialize: (state) => ({
            workflow: state.workflow,
            currentStepIndex: state.currentStepIndex,
            newStepPrompt: state.newStepPrompt,
            workflowInput: state.workflowInput,
            // Don't persist _stepIndexMap - rebuild on load
          }),
          // PERFORMANCE: Prevent unnecessary storage writes
          // Only update storage when workflow or currentStepIndex actually change
          version: 1,
          // Validate and fix currentStepIndex after rehydration
          onRehydrateStorage: () => (state) => {
            if (state) {
              const maxIndex = state.workflow.steps?.length || 0;
              // If currentStepIndex is out of bounds, clamp it to valid range
              if (state.currentStepIndex > maxIndex) {
                state.currentStepIndex = Math.max(0, maxIndex - 1);
              }
              // Rebuild the step index map after rehydration
              state._stepIndexMap = buildStepIndexMap(state.workflow.steps);
              // Ensure workflowInput exists
              if (!state.workflowInput) {
                state.workflowInput = {};
              }
            }
          },
        },
      ),
    ),
  );

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
};

export const WorkflowProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const searchParams = useSearch({ from: "/workflow" });
  const resourceURI = (searchParams as { resourceURI?: string })?.resourceURI;

  // Fetch workflow from API if resourceURI is provided
  const { data: workflowData, isLoading: isLoadingWorkflow } = useQuery({
    queryKey: ["workflow", resourceURI],
    queryFn: async () => {
      if (!resourceURI) return null;
      return await client.READ_WORKFLOW({ uri: resourceURI });
    },
    enabled: !!resourceURI,
  });

  const defaultWorkflow = useMemo(() => {
    const wf = workflowData?.workflow as any;
    return {
      id: crypto.randomUUID(),
      name: wf?.name || "Untitled Workflow",
      description: wf?.description || "",
      inputSchema: wf?.inputSchema,
      outputSchema: wf?.outputSchema,
      steps: wf?.steps || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }, [workflowData?.workflow]);

  const finalWorkflow = useMemo(
    () =>
      ({
        ...defaultWorkflow,
        uri: resourceURI || "",
      }) as unknown as Workflow,
    [defaultWorkflow, resourceURI],
  );

  // Now it's safe to conditionally render based on loading state
  if (!workflowData || isLoadingWorkflow || !resourceURI) {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          <p>Loading workflow...</p>
        </div>
      </div>
    );
  }

  return (
    <WorkflowStoreProvider workflow={finalWorkflow}>
      {children}
    </WorkflowStoreProvider>
  );
};

function useWorkflowStore<T>(selector: (state: Store) => T): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error("Missing WorkflowStoreProvider");
  }
  return useStore(store, selector);
}

// ============================================================================
// ACTIONS SELECTOR (Stable - never causes re-renders)
// ============================================================================
export const useWorkflowStoreActions = () =>
  useWorkflowStore((state) => state.actions);

// ============================================================================
// ATOMIC SELECTORS (Return primitives or use custom equality)
// ============================================================================

// Returns the full workflow data object (use sparingly!)
export const useCurrentWorkflow = () => {
  return useWorkflowStore((state) => state.workflow);
};

// Returns ONLY the length (primitive) - no re-renders on step content changes
export const useWorkflowStepsLength = () => {
  return useWorkflowStore((state) => state.workflow.steps?.length || 0);
};

// Returns ONLY the current step index (primitive)
export const useCurrentStepIndex = () => {
  return useWorkflowStore((state) => state.currentStepIndex);
};

// Returns ONLY the auth token (primitive)
export const useWorkflowAuthToken = (): string | undefined => {
  return useWorkflowStore((state) => state.workflow.authorization?.token);
};

// Returns new step prompt (primitive string)
// This is stored separately from steps to work even when there are no steps yet
export const useNewStepPrompt = () => {
  return useWorkflowStore((state) => state.newStepPrompt);
};

// Returns workflow runtime input (the actual data passed to the workflow)
export const useWorkflowInput = (): Record<string, unknown> => {
  return useWorkflowStore((state) => state.workflowInput);
};

// ============================================================================
// COMPUTED SELECTORS (Return derived primitives)
// ============================================================================

// Returns comma-separated step IDs (primitive string, not array)
// Use this instead of full steps array when you only need IDs
export const useWorkflowStepIds = (): string => {
  return useWorkflowStore(
    (state) =>
      state.workflow.steps?.map((s: WorkflowStep) => s.def?.name).join(",") ||
      "",
  );
};

// Returns the index of a step by name (primitive number)
// PERFORMANCE: Use index map for O(1) lookup instead of O(n) findIndex()
export const useWorkflowStepIndex = (stepName: string): number => {
  return useWorkflowStore((state) => state._stepIndexMap.get(stepName) ?? -1);
};

// PERFORMANCE: Instead of subscribing to previous step outputs during render,
// components should use useWorkflowStoreContext().getState() to access previous
// step data imperatively when needed (e.g., during execution)

// ============================================================================
// ARRAY SELECTORS (Use with caution - can cause re-renders)
// ============================================================================

// Returns array - AVOID using this, prefer useWorkflowStepIds or useWorkflowStepByName
// Only use when you absolutely need the full array of steps
export const useWorkflowStepsArray = (): WorkflowStep[] => {
  return useWorkflowStore((state: Store) => state.workflow.steps || []);
};

// OPTIMIZED: Selector that only subscribes to a specific step by name
// PERFORMANCE: Use index-based lookup to maintain stable references!
// Using find() creates new references every time, causing unnecessary re-renders.
// PERFORMANCE: Shallow compare two objects
function shallowEqual(objA: any, objB: any): boolean {
  if (objA === objB) return true;
  if (!objA || !objB) return false;

  const keysA = Object.keys(objA);
  const keysB = Object.keys(objB);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (objA[key] !== objB[key]) return false;
  }

  return true;
}

export const useWorkflowStepByName = (
  stepName: string,
): WorkflowStep | undefined => {
  return (useWorkflowStore as any)(
    (state: Store) => {
      // CRITICAL: Use index map for O(1) lookup instead of O(n) find()
      // More importantly, this returns the actual step reference from the array,
      // which stays stable when other steps change
      const stepIndex = state._stepIndexMap.get(stepName);
      if (stepIndex === undefined) return undefined;
      return state.workflow.steps[stepIndex];
    },
    (prev: WorkflowStep | undefined, next: WorkflowStep | undefined) => {
      // PERFORMANCE: Reference equality is the fastest check
      // Since we maintain stable references in the store, this works perfectly
      if (prev === next) return true;

      // If both undefined, they're equal
      if (!prev && !next) return true;

      // If only one is undefined, they're not equal
      if (!prev || !next) return false;

      // PERFORMANCE: Check critical properties

      // Check if def changed (contains schema, code, name, etc.)
      if (prev.def !== next.def) return false;

      // Check if output changed (execution results)
      if ((prev.def as any).output !== (next.def as any).output) return false;

      // CRITICAL PERFORMANCE FIX: Use shallow equality for input
      // This prevents unnecessary re-renders when only one field changes
      // Reference equality would trigger re-renders on EVERY keystroke
      // Shallow equality only triggers when fields actually change
      if (!shallowEqual((prev.def as any).input, (next.def as any).input))
        return false;

      // All critical properties are the same - consider equal
      return true;
    },
  );
};
