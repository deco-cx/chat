import type { WorkflowDefinition } from "@deco/sdk";
import { useEffect } from "react";
import {
  useWorkflowContext,
  WorkflowProvider,
} from "../../contexts/workflow-context.tsx";
import { DeveloperBar } from "./components/developer-bar.tsx";
import { EmptyState } from "./components/empty-state.tsx";
import { NavigationBar } from "./components/navigation-bar.tsx";
import { StepSlide } from "./components/step-slide.tsx";
import { TopBar } from "./components/top-bar.tsx";
import { StepCreator } from "./step-creator.tsx";

export function SlideCanvas({ workflow }: { workflow: WorkflowDefinition }) {
  return (
    <WorkflowProvider initialWorkflow={workflow}>
      <SlideCanvasContent />
    </WorkflowProvider>
  );
}

function SlideCanvasContent() {
  const {
    state,
    currentStep,
    nextStep,
    previousStep,
    addStep,
    updateStep,
    startEditing,
    stopEditing,
  } = useWorkflowContext();

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "ArrowLeft":
          previousStep();
          break;
        case "ArrowRight":
          nextStep();
          break;
        case "Escape":
          if (state.isEditing) {
            stopEditing();
          }
          break;
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [state.isEditing, nextStep, previousStep, stopEditing]);

  return (
    <div className="h-screen flex flex-col bg-muted">
      {/* Top Bar */}
      <TopBar />

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        <div className="h-full transition-all duration-300">
          {state.isEditing ? (
            // Show StepCreator inline as a pseudo-step
            <StepCreator
              editingStep={state.editingStepId ? currentStep : null}
              workflow={state.workflow}
              onStepCreated={(step) => {
                if (state.editingStepId) {
                  updateStep(state.editingStepId, step);
                } else {
                  addStep(step);
                }
                stopEditing();
              }}
              onCancel={stopEditing}
            />
          ) : currentStep ? (
            // Show the current step
            <StepSlide step={currentStep} />
          ) : (
            // Show empty state
            <div className="h-full flex items-center justify-center">
              <EmptyState onCreateStep={() => startEditing()} />
            </div>
          )}
        </div>

        {/* Keyboard Navigation Hints */}
        {!state.isEditing && (
          <div className="absolute bottom-4 left-4 flex gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white rounded shadow text-xs font-mono">
                ←
              </kbd>
              <span>Previous</span>
            </div>
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 bg-white rounded shadow text-xs font-mono">
                →
              </kbd>
              <span>Next</span>
            </div>
          </div>
        )}

        {/* Step Counter */}
        {!state.isEditing && currentStep && (
          <div className="absolute bottom-4 right-4 text-sm text-muted-foreground">
            Step {state.currentStepIndex + 1} of {state.workflow.steps.length}
          </div>
        )}
      </div>

      {/* Navigation Bar */}
      {!state.isEditing && <NavigationBar />}

      {/* Developer Bar (Collapsible) */}
      {state.showDevBar && <DeveloperBar />}
    </div>
  );
}
