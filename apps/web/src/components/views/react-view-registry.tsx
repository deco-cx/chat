import { useMemo } from "react";
import { useResourceRoute } from "../resources-v2/route-context.tsx";
import { WorkflowDisplayCanvas } from "../workflow-builder/workflow-display-canvas.tsx";

interface ReactViewProps {
  url: string;
}

const WELL_KNOWN_VIEWS = {
  workflow_detail: WorkflowDisplayCanvas,
};

/**
 * Renders built-in React views based on a react:// URL.
 * Currently supports: react://workflow_detail?uri=<rsc-uri>
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
