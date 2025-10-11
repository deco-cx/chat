import { type NodeProps, Handle, Position } from "reactflow";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { RichTextEditor } from "../../RichTextEditor";
import { useWorkflowStore } from "../../../store/workflowStore";
import { useGenerateStep } from "../../../hooks/useGenerateStep";
import { useMentionItems } from "../../../hooks/useMentionItems";
import type { WorkflowStep } from "../../../types/workflow";

export function NewStepNode(_props: NodeProps) {
  const workflow = useWorkflowStore((state) => state.getCurrentWorkflow());
  const prompt = useWorkflowStore((state) => state.prompt);
  const setPrompt = useWorkflowStore((state) => state.setPrompt);
  const addStep = useWorkflowStore((state) => state.addStep);
  const setCurrentStepIndex = useWorkflowStore(
    (state) => state.setCurrentStepIndex,
  );
  const generateStepMutation = useGenerateStep();
  const mentions = useMentionItems(workflow);

  const handleGenerateStep = () => {
    if (!prompt.trim() || !workflow) {
      console.warn("⚠️ Empty prompt or no workflow");
      return;
    }

    console.log("⚡ [NewStepNode] Generating step with prompt:", prompt);

    const previousSteps = workflow.steps.map((step: WorkflowStep) => ({
      id: step.id,
      name: step.title,
      outputSchema: step.outputSchema || {},
    }));

    generateStepMutation.mutate(
      { objective: prompt, previousSteps },
      {
        onSuccess: (generatedStep) => {
          console.log("✅ Step generated successfully:", generatedStep);

          const step = generatedStep.step;

          console.log("💾 [NewStepNode] Adding generated step to store");

          addStep(workflow.id, {
            title: step.name,
            description: step.description,
            status: "pending",
            toolCalls: step.primaryTool ? [step.primaryTool] : [],
            icon: step.icon,
            inputSchema: step.inputSchema,
            outputSchema: step.outputSchema,
            input: step.input,
            inputDescription: step.inputDescription,
            code: step.code,
            inputView: step.inputView,
            outputView: step.outputView,
          });

          // Navigate to the newly created step
          setCurrentStepIndex(workflow.id, workflow.steps.length);
          setPrompt("");
        },
        onError: (error) => {
          console.error("❌ Failed to generate step:", error);
        },
      },
    );
  };

  return (
    <div className="bg-secondary border-2 border-dashed border-border rounded-xl p-[2px] w-[640px]">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between h-10 px-4 py-2 rounded-t-xl overflow-clip">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="stars" size={16} className="shrink-0 text-foreground" />
          <span className="text-sm font-medium text-foreground leading-5 truncate">
            New step
          </span>
          <div className="size-5 shrink-0 ml-auto" />
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-col rounded-xl overflow-clip">
        {/* Input Section */}
        <div className="bg-background border-b border-border p-4">
          <div
            className="nodrag"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2">
              <label className="text-sm font-medium text-foreground">
                What should this step do?
              </label>
            </div>
            <RichTextEditor
              value={prompt}
              onChange={(value) => setPrompt(value)}
              placeholder="Type @ to mention tools or steps"
              mentions={mentions}
              minHeight="120px"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-background flex items-center justify-end gap-2 p-4">
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              onClick={handleGenerateStep}
              disabled={!prompt.trim() || generateStepMutation.isPending}
              className="bg-primary-light text-primary-dark hover:bg-[#c5e015] h-8 px-3 py-2 rounded-xl text-sm font-medium leading-5 nodrag"
            >
              {generateStepMutation.isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-dark/20 border-t-primary-dark rounded-full animate-spin" />
                  Generating...
                </span>
              ) : (
                "Generate step"
              )}
            </Button>
          </div>
        </div>
      </div>

      {generateStepMutation.isError && (
        <div className="mx-2 mb-2 p-3 bg-destructive/10 border border-destructive/50 rounded-lg">
          <p className="text-sm text-destructive m-0">
            {generateStepMutation.error?.message || "Failed to generate step"}
          </p>
        </div>
      )}
    </div>
  );
}
