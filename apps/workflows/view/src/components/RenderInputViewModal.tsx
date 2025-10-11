/**
 * RENDER INPUT VIEW MODAL
 *
 * Modal for rendering custom input views
 */

import { createPortal } from "react-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@deco/ui/components/dialog.tsx";
import { IframeViewRenderer } from "./IframeViewRenderer";
import type { WorkflowStep } from "../types/workflow";

interface RenderInputViewModalProps {
  workflow: { id: string; steps: WorkflowStep[] };
  step: WorkflowStep;
  fieldName: string;
  viewName: string;
  viewCode: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => void;
}

export function RenderInputViewModal({
  workflow,
  step,
  fieldName,
  viewName,
  viewCode,
  open,
  onOpenChange,
  onSubmit,
}: RenderInputViewModalProps) {
  // Get previous step data for this step
  const stepIndex = workflow.steps.findIndex((s) => s.id === step.id);
  const previousSteps = workflow.steps.slice(0, stepIndex);
  const previousStepResults: Record<string, unknown> = {};
  for (const s of previousSteps) {
    if (s.output) {
      previousStepResults[s.id] = s.output;
    }
  }

  return createPortal(
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {viewName.replace(`${fieldName}_`, "")}
          </DialogTitle>
          <DialogDescription>
            Custom input for: <strong>{fieldName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="mt-6">
          <IframeViewRenderer
            html={viewCode}
            data={previousStepResults}
            height="500px"
            onSubmit={(data) => {
              onSubmit(data);
              onOpenChange(false);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>,
    document.body,
  );
}
