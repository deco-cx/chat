/**
 * WORKFLOW STORE - Zustand state management
 *
 * Simple wrapper around storage.ts
 * All persistence logic is in storage.ts for easy swapping later
 */

import { create } from "zustand";
import type { Workflow, WorkflowStep } from "../types/workflow";
import {
  loadWorkflows,
  saveWorkflows,
  createWorkflowInStorage,
  addStepToWorkflow,
  updateStepInWorkflow,
  setWorkflowStepIndex,
  clearWorkflows,
  type WorkflowStorage,
} from "../lib/storage";

interface WorkflowState {
  // State
  storage: WorkflowStorage;
  isPlaying: boolean;
  viewMode: "json" | "view";
  editingCode: boolean;
  editedCode: string;
  prompt: string;
  inputValues: Record<string, string>;

  // Custom Views State
  creatingView: boolean;
  activeView: string; // "json", "view1", "view2", etc
  newViewName: string;
  viewPurpose: string;

  // Actions
  createWorkflow: (name: string, description: string) => string;
  getWorkflow: (id: string) => Workflow | undefined;
  getCurrentWorkflow: () => Workflow | undefined;
  setCurrentWorkflow: (id: string) => void;
  addStep: (
    workflowId: string,
    step: Omit<WorkflowStep, "id" | "createdAt" | "updatedAt">,
  ) => WorkflowStep;
  updateStep: (
    workflowId: string,
    stepId: string,
    updates: Partial<WorkflowStep>,
  ) => void;
  deleteStep: (workflowId: string, stepId: string) => void;
  duplicateStep: (workflowId: string, stepId: string) => void;
  setCurrentStepIndex: (workflowId: string, index: number) => void;
  importWorkflow: (workflow: Workflow) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setViewMode: (mode: "json" | "view") => void;
  setEditingCode: (editing: boolean, code?: string) => void;
  setPrompt: (prompt: string) => void;
  setInputValue: (key: string, value: string) => void;
  setCreatingView: (creating: boolean) => void;
  setActiveView: (view: string) => void;
  setNewViewName: (name: string) => void;
  setViewPurpose: (purpose: string) => void;
  addOutputView: (
    workflowId: string,
    stepId: string,
    viewName: string,
    viewCode: string,
  ) => void;
  addInputView: (
    workflowId: string,
    stepId: string,
    fieldName: string,
    viewName: string,
    viewCode: string,
  ) => void;
  updateCanvasPosition: (
    workflowId: string,
    nodeId: string,
    position: { x: number; y: number },
  ) => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Initial state from localStorage
  storage: loadWorkflows(),
  isPlaying: false,
  viewMode: "view",
  editingCode: false,
  editedCode: "",
  prompt: "",
  inputValues: {},
  creatingView: false,
  activeView: "json",
  newViewName: "",
  viewPurpose: "",

  createWorkflow: (name, description) => {
    const { storage, workflowId } = createWorkflowInStorage(
      get().storage,
      name,
      description,
    );
    set({ storage });
    return workflowId;
  },

  getWorkflow: (id) => {
    return get().storage.workflows[id];
  },

  getCurrentWorkflow: () => {
    const { storage } = get();
    if (!storage.currentWorkflowId) return undefined;
    return storage.workflows[storage.currentWorkflowId];
  },

  setCurrentWorkflow: (id) => {
    set((state) => ({
      storage: {
        ...state.storage,
        currentWorkflowId: id,
      },
    }));
  },

  addStep: (workflowId, stepData) => {
    const { storage, step } = addStepToWorkflow(
      get().storage,
      workflowId,
      stepData,
    );
    set({ storage });
    return step;
  },

  updateStep: (workflowId, stepId, updates) => {
    console.log("🔄 [Store] Updating step:", stepId, updates);
    const newStorage = updateStepInWorkflow(
      get().storage,
      workflowId,
      stepId,
      updates,
    );
    set({ storage: newStorage });
    console.log("🔄 [Store] State updated, should re-render");
  },

  deleteStep: (workflowId, stepId) => {
    console.log("🗑️ [Store] Deleting step:", stepId);
    const currentStorage = get().storage;
    const workflow = currentStorage.workflows[workflowId];
    if (!workflow) return;

    const updatedSteps = workflow.steps.filter((s) => s.id !== stepId);
    const updatedWorkflow = { ...workflow, steps: updatedSteps };
    const newStorage = {
      ...currentStorage,
      workflows: {
        ...currentStorage.workflows,
        [workflowId]: updatedWorkflow,
      },
    };

    saveWorkflows(newStorage);
    set({ storage: newStorage });
  },

  duplicateStep: (workflowId, stepId) => {
    console.log("📋 [Store] Duplicating step:", stepId);
    const currentStorage = get().storage;
    const workflow = currentStorage.workflows[workflowId];
    if (!workflow) return;

    const stepToDuplicate = workflow.steps.find((s) => s.id === stepId);
    if (!stepToDuplicate) return;

    // Create a copy with a new ID and title
    const newStepId = `step_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const duplicatedStep: WorkflowStep = {
      ...stepToDuplicate,
      id: newStepId,
      title: `${stepToDuplicate.title} (Copy)`,
      status: "pending",
      output: undefined,
      error: undefined,
      logs: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Insert after the original step
    const stepIndex = workflow.steps.findIndex((s) => s.id === stepId);
    const updatedSteps = [
      ...workflow.steps.slice(0, stepIndex + 1),
      duplicatedStep,
      ...workflow.steps.slice(stepIndex + 1),
    ];

    const updatedWorkflow = { ...workflow, steps: updatedSteps };
    const newStorage = {
      ...currentStorage,
      workflows: {
        ...currentStorage.workflows,
        [workflowId]: updatedWorkflow,
      },
    };

    saveWorkflows(newStorage);
    set({ storage: newStorage });
  },

  setCurrentStepIndex: (workflowId, index) => {
    const storage = setWorkflowStepIndex(get().storage, workflowId, index);
    set({ storage });
  },

  importWorkflow: (workflow) => {
    console.log("📥 [Store] Importing workflow:", workflow.id);
    const currentStorage = get().storage;

    // Add imported workflow to storage
    const newStorage: WorkflowStorage = {
      ...currentStorage,
      workflows: {
        ...currentStorage.workflows,
        [workflow.id]: {
          ...workflow,
          updatedAt: new Date().toISOString(),
        },
      },
      currentWorkflowId: workflow.id,
    };

    set({ storage: newStorage });
    saveWorkflows(newStorage);

    console.log("✅ [Store] Workflow imported successfully");
  },

  setIsPlaying: (isPlaying) => {
    set({ isPlaying });
    console.log("🎵 [Store] Player state:", isPlaying ? "Playing" : "Paused");
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
    console.log("👁️ [Store] View mode:", mode);
  },

  setEditingCode: (editing, code) => {
    set({
      editingCode: editing,
      ...(code !== undefined ? { editedCode: code } : {}),
    });
    console.log("📝 [Store] Editing code:", editing);
  },

  setPrompt: (prompt) => {
    set({ prompt });
    console.log("💬 [Store] Prompt updated, length:", prompt.length);
  },

  setInputValue: (key, value) => {
    set((state) => ({
      inputValues: { ...state.inputValues, [key]: value },
    }));
    console.log("🔤 [Store] Input value updated:", key);
  },

  setCreatingView: (creating) => {
    set({ creatingView: creating });
    console.log("🎨 [Store] Creating view:", creating);
  },

  setActiveView: (view) => {
    set({ activeView: view });
    console.log("👁️ [Store] Active view:", view);
  },

  setNewViewName: (name) => {
    set({ newViewName: name });
    console.log("📝 [Store] New view name:", name);
  },

  setViewPurpose: (purpose) => {
    set({ viewPurpose: purpose });
    console.log("🎯 [Store] View purpose:", purpose);
  },

  addOutputView: (workflowId, stepId, viewName, viewCode) => {
    console.log("💾 [Store] Adding output view:", viewName);

    const currentStorage = get().storage;
    const workflow = currentStorage.workflows[workflowId];
    if (!workflow) {
      console.warn("⚠️ [Store] Workflow not found:", workflowId);
      return;
    }

    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step) {
      console.warn("⚠️ [Store] Step not found:", stepId);
      return;
    }

    const outputViews = { ...(step.outputViews || {}), [viewName]: viewCode };
    const newStorage = updateStepInWorkflow(
      currentStorage,
      workflowId,
      stepId,
      { outputViews },
    );

    set({ storage: newStorage });
    console.log(
      "✅ [Store] Output view added:",
      viewName,
      "Total views:",
      Object.keys(outputViews).length,
    );
  },

  addInputView: (workflowId, stepId, _fieldName, viewName, viewCode) => {
    console.log("💾 [Store] Adding input view:", viewName);

    const currentStorage = get().storage;
    const workflow = currentStorage.workflows[workflowId];
    if (!workflow) {
      console.warn("⚠️ [Store] Workflow not found:", workflowId);
      return;
    }

    const step = workflow.steps.find((s) => s.id === stepId);
    if (!step) {
      console.warn("⚠️ [Store] Step not found:", stepId);
      return;
    }

    const inputViews = { ...(step.inputViews || {}), [viewName]: viewCode };
    const newStorage = updateStepInWorkflow(
      currentStorage,
      workflowId,
      stepId,
      { inputViews },
    );

    set({ storage: newStorage });
    console.log(
      "✅ [Store] Input view added:",
      viewName,
      "Total input views:",
      Object.keys(inputViews).length,
    );
  },

  updateCanvasPosition: (workflowId, nodeId, position) => {
    console.log("🎯 [Store] Updating canvas position:", nodeId, position);

    const currentStorage = get().storage;
    const newPositions = {
      ...(currentStorage.canvasPositions || {}),
      [nodeId]: position,
    };

    const newStorage = {
      ...currentStorage,
      canvasPositions: newPositions,
    };

    saveWorkflows(newStorage);
    set({ storage: newStorage });
  },

  reset: () => {
    clearWorkflows();
    set({
      storage: loadWorkflows(),
      isPlaying: false,
      viewMode: "view",
      editingCode: false,
      editedCode: "",
      prompt: "",
      inputValues: {},
      creatingView: false,
      activeView: "json",
      newViewName: "",
      viewPurpose: "",
    });
    console.log("🔄 [Store] Complete reset");
  },
}));
