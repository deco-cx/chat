import { useWorkflowByUriV2 } from "@deco/sdk";
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { WorkflowErrorState } from "../../pages/workflow-builder/workflow-error-state.tsx";
import { WorkflowLoadingSkeleton } from "../../pages/workflow-builder/workflow-loading-skeleton.tsx";
import { WorkflowDisplayCanvas } from "../workflow-builder/workflow-display-canvas.tsx";
import { DecopilotProvider } from "../decopilot/context.tsx";

export function WorkflowView() {
  const [searchParams] = useSearchParams();

  // Extract workflow URI from the URL parameters
  const workflowUri = useMemo(() => {
    const viewUrl = searchParams.get("viewUrl");
    if (!viewUrl) return null;

    try {
      const url = new URL(viewUrl.replace("internal://", "https://internal/"));
      return url.searchParams.get("uri");
    } catch {
      return null;
    }
  }, [searchParams]);

  if (!workflowUri) {
    return (
      <WorkflowErrorState error="Missing workflow URI in URL parameters" />
    );
  }

  const { isLoading, error, refetch, data: workflow } = useWorkflowByUriV2(workflowUri);

  // Prepare decopilot context value for workflow view
  const decopilotContextValue = useMemo(() => {
    if (!workflowUri) return {};
    
    const rules: string[] = [
      `You are helping with a workflow view. The current workflow URI is "${workflowUri}". Focus on operations related to workflow execution, monitoring, and management.`,
      `When working with this workflow, prioritize operations that help users understand the workflow structure, monitor execution status, and manage workflow instances. Consider the workflow's current state and execution history when providing assistance.`,
    ];
    
    return {
      rules,
    };
  }, [workflowUri]);

  if (isLoading) return <WorkflowLoadingSkeleton />;
  if (error)
    return <WorkflowErrorState error={error?.message || "Unknown error"} />;
  // If not found, fallback handled by canvas blank state

  return (
    <DecopilotProvider value={decopilotContextValue}>
      <WorkflowDisplayCanvas
        resourceUri={workflowUri}
        onRefresh={async () => {
          await refetch();
        }}
      />
    </DecopilotProvider>
  );
}
