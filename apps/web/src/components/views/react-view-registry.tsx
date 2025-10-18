import { useMemo } from "react";
import { DocumentDetail } from "../documents/document-detail.tsx";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { ToolDetail } from "../tools/tool-detail.tsx";
import { WorkflowDisplay } from "../workflow-builder/workflow-display-canvas.tsx";
import { WorkflowRunDetail } from "../workflows/workflow-run-detail.tsx";
import { ViewDetail } from "./view-detail.tsx";

interface ReactViewProps {
  url: string;
}

const WELL_KNOWN_VIEWS = {
  workflow_detail: WorkflowDisplay,
  workflow_run_detail: WorkflowRunDetail,
  tool_detail: ToolDetail,
  document_detail: DocumentDetail,
  view_detail: ViewDetail,
};

/**
 * Renders built-in React views based on a react:// URL.
 * Currently supports:
 * - react://workflow_detail?uri=<rsc-uri>
 * - react://tool_detail?uri=<rsc-uri>
 * - react://document_detail?uri=<rsc-uri>
 * - react://view_detail?uri=<rsc-uri>
 */
export function ReactViewRenderer({ url }: ReactViewProps) {
  const { key } = useMemo(() => parseReactUrl(url), [url]);
  const { resourceUri } = useResourceRoute();

  if (!resourceUri) return null;

  const ViewComponent = WELL_KNOWN_VIEWS[key as keyof typeof WELL_KNOWN_VIEWS];

  if (ViewComponent) {
    return <ViewComponent resourceUri={resourceUri} />;
  }

  return null;
}

function parseReactUrl(url: string): { key: string; params: URLSearchParams } {
  try {
    const u = new URL(url);
    const key = u.host; // e.g., workflow_detail
    return { key, params: u.searchParams };
  } catch {
    return { key: "", params: new URLSearchParams() };
  }
}
