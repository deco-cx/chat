/**
 * Storage API - LocalStorage wrapper for workflows
 * All persistence logic centralized here
 */

import type { Workflow, WorkflowStep } from "../types/workflow";

const STORAGE_KEY = "deco_workflows";

export interface WorkflowStorage {
  workflows: Record<string, Workflow>;
  currentWorkflowId: string | null;
  canvasPositions?: Record<string, { x: number; y: number }>;
}

/**
 * Load all workflows from localStorage
 */
export function loadWorkflows(): WorkflowStorage {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return { workflows: {}, currentWorkflowId: null };
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error("Failed to load workflows:", error);
    return { workflows: {}, currentWorkflowId: null };
  }
}

/**
 * Save all workflows to localStorage
 */
export function saveWorkflows(storage: WorkflowStorage): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    console.error("Failed to save workflows:", error);
  }
}

/**
 * Create a new workflow
 */
export function createWorkflowInStorage(
  storage: WorkflowStorage,
  name: string,
  description: string,
): { storage: WorkflowStorage; workflowId: string } {
  const id = `workflow_${Date.now()}`;
  const now = new Date().toISOString();

  const workflow: Workflow = {
    id,
    name,
    description,
    steps: [],
    currentStepIndex: 0,
    createdAt: now,
    updatedAt: now,
  };

  const newStorage: WorkflowStorage = {
    workflows: {
      ...storage.workflows,
      [id]: workflow,
    },
    currentWorkflowId: id,
  };

  saveWorkflows(newStorage);
  return { storage: newStorage, workflowId: id };
}

/**
 * Add a step to a workflow
 */
export function addStepToWorkflow(
  storage: WorkflowStorage,
  workflowId: string,
  stepData: Omit<WorkflowStep, "id" | "createdAt" | "updatedAt">,
): { storage: WorkflowStorage; step: WorkflowStep } {
  const workflow = storage.workflows[workflowId];
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const stepId = `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();

  const step: WorkflowStep = {
    ...stepData,
    id: stepId,
    createdAt: now,
    updatedAt: now,
  };

  const updatedWorkflow: Workflow = {
    ...workflow,
    steps: [...workflow.steps, step],
    updatedAt: now,
  };

  const newStorage: WorkflowStorage = {
    ...storage,
    workflows: {
      ...storage.workflows,
      [workflowId]: updatedWorkflow,
    },
  };

  saveWorkflows(newStorage);
  return { storage: newStorage, step };
}

/**
 * Update a step in a workflow
 */
export function updateStepInWorkflow(
  storage: WorkflowStorage,
  workflowId: string,
  stepId: string,
  updates: Partial<WorkflowStep>,
): WorkflowStorage {
  const workflow = storage.workflows[workflowId];
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const stepIndex = workflow.steps.findIndex((s) => s.id === stepId);
  if (stepIndex === -1) {
    throw new Error(`Step ${stepId} not found in workflow ${workflowId}`);
  }

  const now = new Date().toISOString();
  const updatedSteps = [...workflow.steps];
  updatedSteps[stepIndex] = {
    ...updatedSteps[stepIndex],
    ...updates,
    updatedAt: now,
  };

  const updatedWorkflow: Workflow = {
    ...workflow,
    steps: updatedSteps,
    updatedAt: now,
  };

  const newStorage: WorkflowStorage = {
    ...storage,
    workflows: {
      ...storage.workflows,
      [workflowId]: updatedWorkflow,
    },
  };

  saveWorkflows(newStorage);
  return newStorage;
}

/**
 * Set the current step index in a workflow
 */
export function setWorkflowStepIndex(
  storage: WorkflowStorage,
  workflowId: string,
  index: number,
): WorkflowStorage {
  const workflow = storage.workflows[workflowId];
  if (!workflow) {
    throw new Error(`Workflow ${workflowId} not found`);
  }

  const updatedWorkflow: Workflow = {
    ...workflow,
    currentStepIndex: index,
    updatedAt: new Date().toISOString(),
  };

  const newStorage: WorkflowStorage = {
    ...storage,
    workflows: {
      ...storage.workflows,
      [workflowId]: updatedWorkflow,
    },
  };

  saveWorkflows(newStorage);
  return newStorage;
}

/**
 * Clear all workflows from storage
 */
export function clearWorkflows(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear workflows:", error);
  }
}
