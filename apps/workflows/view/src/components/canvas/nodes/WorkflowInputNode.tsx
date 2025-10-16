import { type NodeProps, Handle, Position } from "reactflow";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import {
  useCurrentWorkflow,
  useWorkflowInput,
  useWorkflowStoreActions,
} from "@/store/workflow";
import { memo, useState, useCallback, useMemo } from "react";
import { Badge } from "@deco/ui/components/badge.tsx";

export const WorkflowInputNode = memo(function WorkflowInputNode(
  _props: NodeProps,
) {
  const workflow = useCurrentWorkflow();
  const workflowInput = useWorkflowInput();
  const { setWorkflowInput } = useWorkflowStoreActions();
  const [jsonText, setJsonText] = useState(() => {
    // Initialize with existing input or empty object
    const hasInput = workflowInput && Object.keys(workflowInput).length > 0;
    return JSON.stringify(hasInput ? workflowInput : {}, null, 2);
  });
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);

  const inputSchema = workflow?.inputSchema;

  // Extract required fields from schema
  const requiredFields = useMemo(() => {
    if (
      !inputSchema ||
      typeof inputSchema !== "object" ||
      !("required" in inputSchema)
    ) {
      return [];
    }
    return (inputSchema.required as string[]) || [];
  }, [inputSchema]);

  // Get schema properties for display
  const schemaProperties = useMemo(() => {
    if (
      !inputSchema ||
      typeof inputSchema !== "object" ||
      !("properties" in inputSchema)
    ) {
      return {};
    }
    return (inputSchema.properties as Record<string, any>) || {};
  }, [inputSchema]);

  const handleApply = useCallback(() => {
    try {
      const parsed = JSON.parse(jsonText);
      setWorkflowInput(parsed);
      setError("");
      setSuccess(true);
      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(`Invalid JSON: ${(err as Error).message}`);
      setSuccess(false);
    }
  }, [jsonText, setWorkflowInput]);

  const handleTextChange = useCallback((value: string) => {
    setJsonText(value);
    setError("");
    setSuccess(false);
  }, []);

  // Generate example data from schema
  const generateExample = useCallback(() => {
    const example: Record<string, any> = {};

    for (const [key, schema] of Object.entries(schemaProperties)) {
      const fieldSchema = schema as Record<string, any>;
      const fieldType = fieldSchema.type;

      if (fieldType === "string") {
        example[key] =
          fieldSchema.enum && fieldSchema.enum.length > 0
            ? fieldSchema.enum[0]
            : "";
      } else if (fieldType === "number" || fieldType === "integer") {
        example[key] = 0;
      } else if (fieldType === "boolean") {
        example[key] = false;
      } else if (fieldType === "array") {
        example[key] = [];
      } else if (fieldType === "object") {
        example[key] = {};
      }
    }

    const exampleJson = JSON.stringify(example, null, 2);
    setJsonText(exampleJson);
    setError("");
    setSuccess(false);
  }, [schemaProperties]);

  // Hide this node if workflow doesn't have an inputSchema or has no properties
  const workflowHasInputSchema =
    inputSchema &&
    typeof inputSchema === "object" &&
    Object.keys(inputSchema).length > 0;

  if (!workflowHasInputSchema || Object.keys(schemaProperties).length === 0) {
    return null;
  }

  return (
    <div className="bg-foreground border border-border rounded-xl p-[2px] w-[640px] shadow-lg relative">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* Header */}
      <div className="flex items-center justify-between h-10 px-4 py-2 rounded-t-xl overflow-clip bg-foreground">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Icon name="input" size={16} className="shrink-0 text-background" />
          <span className="text-sm font-medium text-background leading-5 truncate">
            Workflow Input
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className="text-xs h-5 px-2 bg-background/20 text-background border-background/30"
          >
            Required
          </Badge>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-4 bg-background rounded-b-xl">
        {/* Schema info */}
        {Object.keys(schemaProperties).length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-foreground">
              Expected fields:
            </div>
            <div className="space-y-1 bg-muted/30 rounded-lg p-3 border border-border/50">
              {Object.entries(schemaProperties).map(([key, schema]) => {
                const fieldSchema = schema as Record<string, any>;
                const isRequired = requiredFields.includes(key);
                return (
                  <div key={key} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-foreground font-medium">
                      {key}
                      {isRequired && (
                        <span className="text-destructive ml-0.5">*</span>
                      )}
                    </span>
                    <span className="text-muted-foreground">
                      ({fieldSchema.type || "any"})
                    </span>
                    {fieldSchema.description && (
                      <span className="flex-1 text-muted-foreground">
                        - {fieldSchema.description}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* JSON input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Input data (JSON):
            </label>
            <Button
              size="sm"
              variant="outline"
              onClick={generateExample}
              className="h-7 text-xs"
            >
              <Icon name="auto_fix_high" size={14} className="mr-1" />
              Generate example
            </Button>
          </div>
          <Textarea
            value={jsonText}
            onChange={(e) => handleTextChange(e.target.value)}
            className="font-mono text-xs min-h-[160px] resize-y bg-muted/50 border-border"
            placeholder={`{\n  "field": "value"\n}`}
          />
          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 flex items-start gap-2">
              <Icon name="error" size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="text-xs text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 rounded-lg p-2.5 flex items-start gap-2">
              <Icon name="check_circle" size={14} className="shrink-0 mt-0.5" />
              <span>Input applied successfully!</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            onClick={handleApply}
            size="sm"
            className="bg-foreground hover:bg-foreground/90 text-background"
          >
            <Icon name="check" size={14} className="mr-1.5" />
            Apply input
          </Button>
        </div>
      </div>
    </div>
  );
});
