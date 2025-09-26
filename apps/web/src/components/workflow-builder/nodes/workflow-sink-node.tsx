import { Handle, type NodeProps, Position } from "@xyflow/react";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";

export interface WorkflowSinkNodeData {
  title: string;
  description?: string;
  schema?: Record<string, unknown>;
}

/**
 * Sink node representing workflow output
 * Green circle with workflow output information
 */
export function WorkflowSinkNode(props: NodeProps) {
  const { data } = props;

  if (!data || typeof data !== "object") {
    return null;
  }

  const title = "title" in data ? String(data.title) : "Workflow Output";
  const description =
    "description" in data ? String(data.description) : undefined;
  const schema =
    "schema" in data ? (data.schema as Record<string, unknown>) : undefined;

  return (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-success border-2 border-white"
      />

      <Card className="w-48 h-48 bg-success-foreground border-success/30 shadow-md">
        <CardContent className="flex flex-col items-center justify-center h-full p-4">
          <div className="w-12 h-12 bg-success rounded-full flex items-center justify-center mb-2">
            <span className="text-white font-bold text-lg">OUT</span>
          </div>
          <h3 className="text-sm font-semibold text-success text-center mb-1">
            {title}
          </h3>
          {description && (
            <p className="text-xs text-success text-center line-clamp-2">
              {String(description)}
            </p>
          )}
          {schema && (
            <Badge
              variant="secondary"
              className="text-xs mt-1 bg-success/20 text-success"
            >
              {
                Object.keys(
                  (
                    schema as Record<
                      string,
                      { properties?: Record<string, unknown> }
                    >
                  )?.properties || {},
                ).length
              }{" "}
              outputs
            </Badge>
          )}
        </CardContent>
      </Card>
    </>
  );
}
