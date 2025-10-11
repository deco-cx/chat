/**
 * CREATE INPUT VIEW MODAL
 *
 * Modal for creating custom input views for workflow step fields
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@deco/ui/components/dialog.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useWorkflowStore } from "../store/workflowStore";
import { useGenerateInputView } from "../hooks/useGenerateInputView";
import type { WorkflowStep } from "../types/workflow";

interface CreateInputViewModalProps {
  workflow: { id: string; steps: WorkflowStep[] };
  step: WorkflowStep;
  fieldName: string;
  fieldSchema: Record<string, unknown>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInputViewModal({
  workflow,
  step,
  fieldName,
  fieldSchema,
  open,
  onOpenChange,
}: CreateInputViewModalProps) {
  const store = useWorkflowStore();
  const [viewName, setViewName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [selectedPreviousStepId, setSelectedPreviousStepId] =
    useState<string>("");

  const generateViewMutation = useGenerateInputView();

  // Get all previous steps
  const stepIndex = workflow.steps.findIndex((s) => s.id === step.id);
  const previousSteps = workflow.steps.slice(0, stepIndex);

  // Auto-generate next view name
  const existingViews = Object.keys(step.inputViews || {}).filter((key) =>
    key.startsWith(`${fieldName}_`),
  );
  const suggestedName =
    existingViews.length === 0
      ? `${fieldName}_view1`
      : `${fieldName}_view${existingViews.length + 1}`;

  // Set suggested name if empty
  if (!viewName && suggestedName) {
    setViewName(suggestedName);
  }

  const handleGenerate = () => {
    if (!viewName.trim() || !purpose.trim()) {
      alert("Please fill view name and purpose");
      return;
    }

    console.log("📝 [CreateInputViewModal] Generating input view:", viewName);

    // Get previous step output if selected
    let previousStepOutput: string | undefined;
    if (selectedPreviousStepId) {
      const prevStep = previousSteps.find(
        (s) => s.id === selectedPreviousStepId,
      );
      if (prevStep?.output) {
        previousStepOutput = JSON.stringify(prevStep.output).substring(0, 200);
      }
    }

    generateViewMutation.mutate(
      {
        stepId: step.id,
        fieldName,
        fieldSchema,
        previousStepId: selectedPreviousStepId || undefined,
        previousStepOutput,
        viewName,
        purpose,
      },
      {
        onSuccess: (result) => {
          console.log(
            "✅ [CreateInputViewModal] Input view generated successfully",
          );

          // Add to Zustand store
          store.addInputView(
            workflow.id,
            step.id,
            fieldName,
            viewName,
            result.viewCode,
          );

          // Reset form
          setViewName("");
          setPurpose("");
          setSelectedPreviousStepId("");

          // Close modal
          onOpenChange(false);
        },
        onError: (error) => {
          console.error(
            "❌ [CreateInputViewModal] Failed to generate input view:",
            error,
          );
          alert(`Failed to generate input view: ${error.message}`);
        },
      },
    );
  };

  return createPortal(
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Create Custom Input View
          </DialogTitle>
          <DialogDescription>
            Generate a custom input interface for field:{" "}
            <strong>{fieldName}</strong>
            <br />
            <span className="text-xs">
              The view can use data from previous steps to populate options
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Form */}
        <div className="flex flex-col gap-6">
          {/* View Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              View Name
            </label>
            <Input
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              placeholder={suggestedName}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Suggested: {suggestedName}
            </p>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">
              Purpose
            </label>
            <Textarea
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="Create a dropdown populated with categories from previous step, with search functionality"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Describe what the input view should do
            </p>
          </div>

          {/* Previous Step Selection (Optional) */}
          {previousSteps.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Use Data From Previous Step (Optional)
              </label>
              <Select
                value={selectedPreviousStepId}
                onValueChange={setSelectedPreviousStepId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-- None --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- None --</SelectItem>
                  {previousSteps.map((prevStep) => (
                    <SelectItem key={prevStep.id} value={prevStep.id}>
                      {prevStep.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1.5">
                Select a previous step to use its output data (e.g., for
                populating dropdowns)
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-3 justify-end pt-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={generateViewMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={
              !viewName.trim() ||
              !purpose.trim() ||
              generateViewMutation.isPending
            }
          >
            {generateViewMutation.isPending
              ? "Generating..."
              : "✨ Generate View"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>,
    document.body,
  );
}
