import { Icon } from "@deco/ui/components/icon.js";
import { Button } from "@deco/ui/components/button.tsx";
import { useState, useMemo, useRef, useEffect } from "react";
import { GenerateOutputViewModal } from "../../GenerateOutputViewModal";
import { CustomViewModal } from "../../CustomViewModal";
import { useGenerateOutputView } from "../../../hooks/useGenerateOutputView";
import {
  useWorkflowStoreActions,
  useWorkflowStepByName,
} from "@/store/workflow";
import { toast } from "sonner";

interface StepExecutionResult {
  success: boolean;
  output?: unknown;
  duration?: number;
  logs?: Array<{ type: string; content: string }>;
  error?: unknown;
  resolvedInput?: Record<string, unknown>;
  resolutionErrors?: Array<{ ref: string; error: string }>;
}

interface StepOutputProps {
  step: StepExecutionResult;
  stepName?: string;
  outputSchema?: Record<string, unknown>;
}

export function StepOutput({ step, stepName, outputSchema }: StepOutputProps) {
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showExpandedView, setShowExpandedView] = useState(false);
  const [viewMode, setViewMode] = useState<"custom" | "json">("custom");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const workflowActions = useWorkflowStoreActions();
  const workflowStep = useWorkflowStepByName(stepName || "");
  const customViewCode = (workflowStep as any)?.customOutputView;

  const generateViewMutation = useGenerateOutputView();

  const jsonString = useMemo(
    () =>
      typeof step.output === "object"
        ? JSON.stringify(step.output, null, 2)
        : String(step.output ?? ""),
    [step.output],
  );

  const lines = useMemo(() => jsonString.split("\n"), [jsonString]);

  // Pre-inject data into viewCode for preview iframe
  const viewCodeWithData = useMemo(() => {
    if (!customViewCode) return "";

    // Inject data directly into the HTML before the iframe loads it
    const dataScript = `
      <script>
        window.viewData = ${JSON.stringify(step.output)};
        console.log('✅ [StepOutput] Data pre-injected:', window.viewData);
      </script>
    `;

    // Insert data script right after opening <div> or at the start
    if (customViewCode.includes("<div")) {
      // Insert after first opening div tag
      return customViewCode.replace(/(<div[^>]*>)/, `$1${dataScript}`);
    }
    // Prepend if no div found
    return dataScript + customViewCode;
  }, [customViewCode, step.output]);

  function handleGenerateView(purpose: string) {
    if (!stepName || !outputSchema) {
      toast.error("Missing step information");
      return;
    }

    const outputSample = jsonString.substring(0, 100);

    generateViewMutation.mutate(
      {
        stepId: stepName,
        stepName,
        outputSchema,
        outputSample,
        viewName: "default",
        purpose,
      },
      {
        onSuccess: (result) => {
          workflowActions.updateStepCustomView(stepName, result.viewCode);
          setShowGenerateModal(false);
          setViewMode("custom");
          toast.success("Custom view generated successfully!");
        },
        onError: (error) => {
          console.error("❌ Failed to generate view:", error);
          toast.error(`Failed to generate view: ${error.message}`);
        },
      },
    );
  }

  // Auto-switch to custom view when it's generated
  useEffect(() => {
    if (customViewCode && viewMode === "json") {
      setViewMode("custom");
    }
  }, [customViewCode]);

  const showCustomView = customViewCode && viewMode === "custom";

  return (
    <div className="bg-background p-4 flex flex-col gap-3 relative rounded-b-xl max-h-[300px] overflow-hidden">
      <div
        className="nodrag flex flex-col gap-3 overflow-hidden"
        style={{ cursor: "default" }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with metrics */}
        <div className="flex items-center justify-between shrink-0">
          <p className="font-mono text-sm text-muted-foreground uppercase">
            EXECUTION RESULT
          </p>
          <div className="flex items-center gap-2 px-1">
            {step.duration && (
              <div className="flex items-center gap-1">
                <Icon name="schedule" size={16} className="text-purple-light" />
                <span className="font-mono text-sm text-muted-foreground">
                  {step.duration}ms
                </span>
              </div>
            )}

            {/* Expand View Button */}
            {customViewCode && viewMode === "custom" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowExpandedView(true)}
                className="h-6 px-2"
                title="Expand view"
              >
                <Icon name="open_in_full" size={16} />
              </Button>
            )}

            {/* View Mode Toggle */}
            {customViewCode && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setViewMode((prev) => (prev === "custom" ? "json" : "custom"))
                }
                className="h-6 px-2"
                title={
                  viewMode === "custom" ? "Show raw JSON" : "Show custom view"
                }
              >
                <Icon
                  name={viewMode === "custom" ? "code" : "visibility"}
                  size={16}
                />
              </Button>
            )}

            {/* Generate View Button */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowGenerateModal(true)}
              className="h-6 px-2"
              title={
                customViewCode
                  ? "Regenerate custom view"
                  : "Generate custom view"
              }
            >
              <Icon name="auto_awesome" size={16} />
            </Button>
          </div>
        </div>

        {/* Custom View (iframe) - Preview */}
        {showCustomView ? (
          <div
            data-scrollable="true"
            className="border border-border rounded bg-muted/30 flex-1 min-h-0 relative group"
            style={{
              maxHeight: "200px",
              minHeight: "120px",
              overflowY: "auto",
              overflowX: "hidden",
              pointerEvents: "auto",
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <iframe
              ref={iframeRef}
              srcDoc={viewCodeWithData}
              style={{
                width: "100%",
                minHeight: "120px",
                border: "none",
                background: "transparent",
              }}
              sandbox="allow-scripts allow-same-origin"
              title="Custom Output View"
            />
          </div>
        ) : (
          /* Raw JSON View */
          <div
            data-scrollable="true"
            className="border border-border rounded bg-muted/30 flex-1 min-h-0"
            style={{
              maxHeight: "200px",
              minHeight: "100px",
              overflowY: "auto",
              overflowX: "hidden",
              cursor: "text",
              pointerEvents: "auto",
            }}
            onWheel={(e) => {
              e.stopPropagation();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex gap-5 p-4">
              {/* Line numbers */}
              <div className="flex flex-col font-mono text-xs text-muted-foreground leading-[1.5] opacity-50 select-none shrink-0">
                {lines.map((_, i) => (
                  <span key={i + 1}>{i + 1}</span>
                ))}
              </div>

              {/* Code content */}
              <div className="flex-1 min-w-0">
                <pre className="font-mono text-xs text-foreground leading-[1.5] m-0 whitespace-pre-wrap break-words">
                  {jsonString}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Generate View Modal */}
      <GenerateOutputViewModal
        open={showGenerateModal}
        onOpenChange={setShowGenerateModal}
        onGenerate={handleGenerateView}
        isLoading={generateViewMutation.isPending}
      />

      {/* Expanded View Modal */}
      {customViewCode && (
        <CustomViewModal
          open={showExpandedView}
          onOpenChange={setShowExpandedView}
          viewCode={customViewCode}
          outputData={step.output}
          stepName={stepName || "Step"}
        />
      )}
    </div>
  );
}
