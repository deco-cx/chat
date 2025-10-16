/**
 * VIEW RENDERER - Simple & Predictable
 *
 * Renders custom views from step outputView/inputView
 * SIMPLIFIED: Just the essentials that work!
 */

import type { ReactNode } from "react";

export interface ViewNode {
  type: "container" | "text" | "heading" | "card" | "badge" | "list";
  data?: string;
  text?: string;
  children?: ViewNode[];
  variant?: "default" | "success" | "warning" | "error";
}

interface ViewRendererProps {
  view: ViewNode;
  data: Record<string, unknown>;
}

/**
 * Resolve data path like "poem" or "result.field"
 */
function getData(data: Record<string, unknown>, path?: string): unknown {
  if (!path) return null;

  const parts = path.split(".");
  let current: unknown = data;

  for (const part of parts) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Render view - SIMPLE & PREDICTABLE
 */
export function ViewRenderer({ view, data }: ViewRendererProps): ReactNode {
  const value = view.data ? getData(data, view.data) : view.text;
  const displayText = String(value || "");

  switch (view.type) {
    case "container":
      return (
        <div className="flex flex-col gap-4">
          {view.children?.map((child, i) => (
            <ViewRenderer key={i} view={child} data={data} />
          ))}
        </div>
      );

    case "card":
      return (
        <div className="rounded-xl border border-border bg-card/50 p-6">
          {view.children?.map((child, i) => (
            <ViewRenderer key={i} view={child} data={data} />
          ))}
        </div>
      );

    case "heading":
      return (
        <h3 className="text-xl font-bold text-foreground mb-2">
          {displayText}
        </h3>
      );

    case "text":
      return <p className="text-foreground leading-relaxed">{displayText}</p>;

    case "badge":
      const variantColors = {
        success: "bg-success/20 text-success border-success/30",
        warning: "bg-warning/20 text-warning border-warning/30",
        error: "bg-destructive/20 text-destructive border-destructive/30",
        default: "bg-primary/20 text-primary border-primary/30",
      };
      const colorClass = variantColors[view.variant || "default"];

      return (
        <span
          className={`inline-block px-3 py-1 rounded-md border text-sm font-medium ${colorClass}`}
        >
          {displayText}
        </span>
      );

    case "list":
      const items = Array.isArray(value) ? value : [];
      return (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-foreground flex items-start gap-2">
              <span className="text-success flex-shrink-0">•</span>
              <span>{String(item)}</span>
            </li>
          ))}
        </ul>
      );

    default:
      return (
        <div className="p-4 bg-warning/10 border border-warning rounded text-sm text-warning">
          Unknown type: {view.type}
        </div>
      );
  }
}

/**
 * Fallback: Render JSON if no custom view
 */
export function JsonFallback({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <pre className="text-sm text-foreground font-mono overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
