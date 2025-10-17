import type { MCPTool } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { lazy, Suspense, useEffect, useState } from "react";
import { Form } from "@deco/ui/components/form.tsx";
import { useForm } from "react-hook-form";
import { ajvResolver } from "@hookform/resolvers/ajv";
import type { JSONSchema7 } from "json-schema";
import { generateDefaultValues } from "../json-schema/utils/generate-default-values.ts";
import JSONSchemaForm, { type SchemaType } from "../json-schema/index.tsx";
import { useCopy } from "../../hooks/use-copy.ts";
import { cn } from "@deco/ui/lib/utils.ts";

const LazyHighlighter = lazy(() => import("../chat/lazy-highlighter.tsx"));

interface ToolCallFormProps {
  tool: MCPTool;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  rawMode: boolean;
  readOnly?: boolean;
}

// Helper function to properly serialize Error objects
function serializeForDisplay(obj: unknown): string {
  return JSON.stringify(
    obj,
    (_, value) => {
      // Handle Error objects specifically
      if (value instanceof Error) {
        return {
          name: value.name,
          message: value.message,
          stack: value.stack,
        };
      }
      return value;
    },
    2,
  );
}

function TreeNode({
  nodeKey,
  value,
  level = 0,
}: {
  nodeKey?: string;
  value: unknown;
  level?: number;
}) {
  const [isOpen, setIsOpen] = useState(level === 0);
  const indent = level * 16;

  const getValueType = (val: unknown): string => {
    if (val === null) return "null";
    if (Array.isArray(val)) return "array";
    if (typeof val === "object") return "object";
    return typeof val;
  };

  const getCount = (val: unknown): number | null => {
    if (Array.isArray(val)) return val.length;
    if (val && typeof val === "object") return Object.keys(val).length;
    return null;
  };

  const isExpandable = (val: unknown): boolean => {
    return (
      (Array.isArray(val) && val.length > 0) ||
      (val !== null &&
        typeof val === "object" &&
        Object.keys(val as object).length > 0)
    );
  };

  const valueType = getValueType(value);
  const count = getCount(value);
  const canExpand = isExpandable(value);

  // Render primitive values
  if (!canExpand) {
    return (
      <div
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 text-sm leading-normal"
      >
        <div className="w-4 flex-shrink-0" />{" "}
        {/* Space for chevron alignment */}
        {nodeKey && (
          <span className="text-[#82AAFF] flex-shrink-0">{nodeKey}:</span>
        )}
        {value === null ? (
          <span className="text-[#C792EA] break-words">null</span>
        ) : typeof value === "boolean" ? (
          <span className="text-[#C792EA] break-words">{value.toString()}</span>
        ) : typeof value === "number" ? (
          <span className="text-[#F78C6C] break-words">{value}</span>
        ) : typeof value === "string" ? (
          <span className="text-[#C3E88D] break-words">{value}</span>
        ) : (
          <span className="text-[#EEFFFF] break-words">{String(value)}</span>
        )}
      </div>
    );
  }

  // Render expandable objects/arrays
  const entries = Array.isArray(value)
    ? value.map((item, index) => [index.toString(), item] as const)
    : Object.entries(value as Record<string, unknown>);

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        style={{ paddingLeft: `${indent}px` }}
        className="flex items-start gap-2 py-1 w-full text-left hover:bg-white/5 transition-colors rounded leading-normal"
      >
        <Icon
          name="chevron_right"
          className={cn(
            "w-4 h-4 text-[#546E7A] transition-transform flex-shrink-0 mt-0.5",
            isOpen && "rotate-90",
          )}
        />
        {nodeKey && (
          <span className="text-[#82AAFF] flex-shrink-0">{nodeKey}</span>
        )}
        <span className="text-[#546E7A]">
          {valueType}{" "}
          {count !== null && (
            <span className="text-[#89DDFF]">{`{${count}}`}</span>
          )}
        </span>
      </button>
      {isOpen && (
        <div>
          {entries.map(([key, val]) => (
            <TreeNode key={key} nodeKey={key} value={val} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function JsonTreeView({ data }: { data: unknown }) {
  return (
    <div
      className="p-4 text-sm overflow-auto rounded-lg max-h-[500px]"
      style={{ background: "#263238" }}
    >
      <TreeNode value={data} level={0} />
    </div>
  );
}

export function RawJsonView({ json }: { json: unknown }) {
  const { copied, handleCopy } = useCopy();
  const serializedJson = serializeForDisplay(json);
  const [viewMode, setViewMode] = useState<"code" | "tree">("code");
  const [showButtons, setShowButtons] = useState(false);

  return (
    <div
      className="relative w-full min-w-0"
      onMouseEnter={() => setShowButtons(true)}
      onMouseLeave={() => setShowButtons(false)}
    >
      {showButtons && (
        <div className="absolute top-2 right-2 flex items-center bg-background gap-0.5 shadow-sm rounded-md z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              setViewMode((prev) => (prev === "code" ? "tree" : "code"));
            }}
            className="size-8 rounded-none rounded-l-md hover:bg-accent/50 transition-colors"
            title={viewMode === "code" ? "Show tree view" : "Show code view"}
          >
            <Icon
              name={viewMode === "code" ? "account_tree" : "code"}
              className="w-4 h-4 text-muted-foreground"
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy(serializedJson);
            }}
            className="size-8 rounded-none rounded-r-md hover:bg-accent/50 transition-colors"
            title="Copy JSON"
          >
            <Icon
              name={copied ? "check" : "content_copy"}
              className="w-4 h-4 text-muted-foreground"
            />
          </Button>
        </div>
      )}

      <div className="overflow-x-auto overflow-y-auto max-h-[500px] min-w-0">
        {viewMode === "code" ? (
          <Suspense
            fallback={
              <pre
                className="p-4 text-xs whitespace-pre-wrap break-all rounded-lg m-0"
                style={{ background: "#263238", color: "#EEFFFF" }}
              >
                <code className="select-text cursor-auto">
                  {serializedJson}
                </code>
              </pre>
            }
          >
            <LazyHighlighter language="json" content={serializedJson} />
          </Suspense>
        ) : (
          <JsonTreeView data={json} />
        )}
      </div>
    </div>
  );
}

export function ToolCallForm({
  tool,
  onSubmit,
  onCancel,
  isLoading,
  rawMode,
  readOnly,
}: ToolCallFormProps) {
  const [payload, setPayload] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Initialize form with default values based on the schema
  const form = useForm<Record<string, SchemaType>>({
    defaultValues: generateDefaultValues(tool.inputSchema as JSONSchema7),
    // The type is correct, somehow it fails on ajv
    // deno-lint-ignore no-explicit-any
    resolver: ajvResolver(tool.inputSchema as any),
  });

  // Sync form values with raw JSON when toggling modes
  useEffect(() => {
    if (rawMode) {
      try {
        // Convert form data to JSON string when switching to raw mode
        setPayload(JSON.stringify(form.getValues(), null, 2));
      } catch (_err) {
        setPayload("{}");
      }
    } else {
      try {
        // Parse JSON and update form when switching to form mode
        const parsedPayload = JSON.parse(payload || "{}");
        form.reset(parsedPayload);
      } catch (_err) {
        // If JSON is invalid, show error but don't switch modes
        setError(
          "Invalid JSON payload. Please fix before switching to form mode.",
        );
      }
    }
  }, [rawMode]);

  const handleRawSubmit = async () => {
    try {
      const parsedPayload = JSON.parse(payload);
      setError(null);
      await onSubmit(parsedPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON payload");
    }
  };

  const handleFormSubmit = form.handleSubmit(async (data) => {
    try {
      setError(null);
      await onSubmit(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error submitting form");
    }
  });

  return (
    <div className="space-y-4">
      {rawMode ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Input Schema</div>
            <RawJsonView json={tool.inputSchema} />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-sm font-medium">Raw JSON Payload</div>
            <Textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              placeholder="Enter JSON payload..."
              className="font-mono bg-background"
              rows={10}
              disabled={isLoading}
            />
            {error && (
              <div className="text-sm text-destructive mt-2">{error}</div>
            )}
          </div>

          <div className="flex gap-2 mt-4">
            <Button
              onClick={handleRawSubmit}
              className="flex-1 gap-2"
              disabled={isLoading || readOnly}
            >
              {isLoading ? (
                <>
                  <Spinner size="xs" />
                  Processing...
                </>
              ) : (
                "Execute Tool Call"
              )}
            </Button>
            {isLoading && (
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex items-center gap-2"
              >
                <Icon name="close" />
                Cancel
              </Button>
            )}
          </div>
        </div>
      ) : (
        <Form {...form}>
          <JSONSchemaForm
            schema={tool.inputSchema as JSONSchema7}
            form={form}
            disabled={isLoading}
            onSubmit={handleFormSubmit}
            error={error}
            submitButton={
              <Button
                type="submit"
                className="flex-1 gap-2"
                disabled={isLoading || readOnly}
              >
                {isLoading ? (
                  <>
                    <Spinner size="xs" />
                    Processing...
                  </>
                ) : (
                  "Execute Tool Call"
                )}
              </Button>
            }
          />
        </Form>
      )}
    </div>
  );
}
