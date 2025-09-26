import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@deco/ui/components/button.tsx";
import { useWorkflowContext } from "../../../contexts/workflow-context.tsx";

export function NavigationBar() {
  const {
    state,
    navigateToStep,
    nextStep,
    previousStep,
    canNavigateBack,
    canNavigateForward,
    startEditing,
  } = useWorkflowContext();

  return (
    <div className="h-20 bg-white border-t flex items-center justify-between px-6">
      {/* Previous Button */}
      <Button
        variant="ghost"
        size="lg"
        onClick={previousStep}
        disabled={!canNavigateBack}
        className="shrink-0"
      >
        <ChevronLeft className="w-6 h-6" />
      </Button>

      {/* Step Pills */}
      <div className="flex items-center gap-3 overflow-x-auto max-w-3xl mx-4 py-2">
        {state.workflow.steps.map((step, index) => (
          <button
            key={step.def.name}
            type="button"
            onClick={() => navigateToStep(index)}
            className={`
              px-5 py-2.5 rounded-full text-sm font-medium transition-all whitespace-nowrap
              ${
                index === state.currentStepIndex
                  ? "bg-blue-500 text-white shadow-md scale-105"
                  : "bg-muted text-foreground hover:bg-accent"
              }
            `}
          >
            {step.def.name || `Step ${index + 1}`}
          </button>
        ))}

        {/* Add Step Button */}
        <button
          type="button"
          onClick={() => startEditing()}
          className="px-5 py-2.5 rounded-full text-sm font-medium 
                     bg-muted text-muted-foreground hover:bg-accent 
                     border-2 border-dashed border-border
                     transition-all whitespace-nowrap"
        >
          <Plus className="w-4 h-4 inline mr-1" />
          Add Step
        </button>
      </div>

      {/* Next Button */}
      <Button
        variant="ghost"
        size="lg"
        onClick={nextStep}
        disabled={!canNavigateForward}
        className="shrink-0"
      >
        <ChevronRight className="w-6 h-6" />
      </Button>
    </div>
  );
}
