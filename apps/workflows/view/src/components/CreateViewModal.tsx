/**
 * CREATE VIEW MODAL
 *
 * Modal for creating custom output views
 */

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
import { useWorkflowStore } from "../store/workflowStore";
import { useGenerateOutputView } from "../hooks/useGenerateOutputView";
import type { WorkflowStep } from "../types/workflow";

interface CreateViewModalProps {
  workflow: { id: string };
  step: WorkflowStep;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateViewModal({
  workflow,
  step,
  open,
  onOpenChange,
}: CreateViewModalProps) {
  const store = useWorkflowStore();
  const newViewName = useWorkflowStore((state) => state.newViewName);
  const viewPurpose = useWorkflowStore((state) => state.viewPurpose);

  const generateViewMutation = useGenerateOutputView();

  // Auto-generate next view name
  const existingViews = Object.keys(step.outputViews || {});
  const suggestedName =
    existingViews.length === 0 ? "view1" : `view${existingViews.length + 1}`;

  // Set suggested name if empty
  if (!newViewName && suggestedName) {
    store.setNewViewName(suggestedName);
  }

  const handleGenerate = () => {
    if (!newViewName.trim() || !viewPurpose.trim()) {
      alert("Please fill view name and purpose");
      return;
    }

    if (!step.output) {
      alert("Step must be executed before creating custom view");
      return;
    }

    console.log("🎨 [CreateViewModal] Generating view:", newViewName);

    const outputSample = JSON.stringify(step.output).substring(0, 100);

    generateViewMutation.mutate(
      {
        stepId: step.id,
        stepName: step.title,
        outputSchema: step.outputSchema || {},
        outputSample,
        viewName: newViewName,
        purpose: viewPurpose,
      },
      {
        onSuccess: (result) => {
          console.log("✅ [CreateViewModal] View generated successfully");

          // Add to Zustand store
          store.addOutputView(
            workflow.id,
            step.id,
            newViewName,
            result.viewCode,
          );

          // Set as active view
          store.setActiveView(newViewName);

          // Reset form
          store.setNewViewName("");
          store.setViewPurpose("");

          // Close modal
          onOpenChange(false);
        },
        onError: (error) => {
          console.error("❌ [CreateViewModal] Failed to generate view:", error);
          alert(`Failed to generate view: ${error.message}`);
        },
      },
    );
  };

  return createPortal(
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Create Custom View
          </DialogTitle>
          <DialogDescription>
            Generate a custom visualization for this step's output
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
              value={newViewName}
              onChange={(e) => store.setNewViewName(e.target.value)}
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
              value={viewPurpose}
              onChange={(e) => store.setViewPurpose(e.target.value)}
              placeholder="Show poem with beautiful typography and copy button"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Describe how you want the data displayed
            </p>
          </div>
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
              !newViewName.trim() ||
              !viewPurpose.trim() ||
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
