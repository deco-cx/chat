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
import { useCurrentWorkflow } from "@/store/workflow";
import type { WorkflowStep } from "shared/types/workflows";

interface RenderInputViewModalProps {
  fieldName: string;
  viewName: string;
  viewCode: string;
  step: { name: string; output?: Record<string, unknown> };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Record<string, unknown>) => void;
}

export function RenderInputViewModal({
  fieldName,
  viewName,
  viewCode,
  step,
  open,
  onOpenChange,
  onSubmit,
}: RenderInputViewModalProps) {
  const workflow = useCurrentWorkflow();
  // Get previous step data for this step
  const stepIndex = workflow.steps?.findIndex(
    (s: WorkflowStep) => s.name === step.name,
  );
  const previousSteps = workflow.steps?.slice(0, stepIndex);
  const previousStepResults: Record<string, unknown> = {};
  // for (const s of previousSteps || []) {
  //   if (s.output) {
  //     previousStepResults[s.id] = s.output;
  //   }
  // }

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
