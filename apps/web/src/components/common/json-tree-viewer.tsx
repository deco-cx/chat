import { Icon } from "@deco/ui/components/icon.tsx";
import { useState } from "react";

function tryParseJson(str: unknown): unknown {
  if (typeof str !== "string") {
    // If it's already an object, return it as-is
    // Don't convert objects to "[object Object]" strings
    return str;
  }
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === "object" && parsed !== null) {
      return parsed;
    }
    return str;
  } catch {
    return str;
  }
}

// JSON Tree Viewer Components
function ExpandableString({
  value,
  className,
  isQuoted = false,
}: {
  value: string;
  className: string;
  isQuoted?: boolean;
}) {
  const [showFull, setShowFull] = useState(false);

  // Ensure value is actually a string
  const stringValue = typeof value === "string" ? value : String(value);
  const isTruncated = stringValue.length > 100;

  const content =
    showFull || !isTruncated ? (
      stringValue
    ) : (
      <span>
        {stringValue.slice(0, 100)}
        <button
          type="button"
          className="text-primary hover:text-primary/80 underline ml-1 text-xs font-normal bg-transparent border-none cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(true);
          }}
          title="Click to show full content"
        >
          ... show {stringValue.length - 100} more chars
        </button>
      </span>
    );

  return (
    <span className={className}>
      {isQuoted && '"'}
      {content}
      {isQuoted && '"'}
      {showFull && isTruncated && (
        <button
          type="button"
          className="text-primary hover:text-primary/80 underline ml-2 text-xs font-normal bg-transparent border-none cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowFull(false);
          }}
          title="Click to collapse"
        >
          collapse
        </button>
      )}
    </span>
  );
}

function JsonTreeNode({
  data,
  keyName,
  level = 0,
}: {
  data: unknown;
  keyName?: string;
  level?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels

  const getDataType = (value: unknown): string => {
    if (value === null) return "null";
    if (value === undefined) return "undefined";
    if (Array.isArray(value)) return "array";
    if (typeof value === "object") return "object";
    return typeof value;
  };

  const getValuePreview = (value: unknown): string => {
    const type = getDataType(value);
    switch (type) {
      case "array": {
        const arr = value as unknown[];
        return `[${arr.length} items]`;
      }
      case "object": {
        const obj = value as Record<string, unknown>;
        const keys = Object.keys(obj);
        return `{${keys.length} properties}`;
      }
      case "string": {
        const str = value as string;
        return str.length > 50 ? `"${str.slice(0, 50)}..."` : `"${str}"`;
      }
      case "null":
        return "null";
      default:
        return String(value);
    }
  };

  const getTypeColor = (value: unknown): string => {
    const type = getDataType(value);
    switch (type) {
      case "string":
        return "text-green-600 dark:text-green-400";
      case "number":
        return "text-blue-600 dark:text-blue-400";
      case "boolean":
        return "text-purple-600 dark:text-purple-400";
      case "null":
        return "text-gray-500 dark:text-gray-400";
      case "array":
        return "text-orange-600 dark:text-orange-400";
      case "object":
        return "text-red-600 dark:text-red-400";
      default:
        return "text-gray-700 dark:text-gray-300";
    }
  };

  const isExpandable = (value: unknown): boolean => {
    return (
      Array.isArray(value) || (typeof value === "object" && value !== null)
    );
  };

  const renderPrimitive = (value: unknown) => {
    const type = getDataType(value);
    const colorClass = getTypeColor(value);

    if (type === "string") {
      // Ensure we're definitely passing a string
      const stringValue = String(value);
      return (
        <ExpandableString value={stringValue} className={colorClass} isQuoted />
      );
    }

    return <span className={colorClass}>{getValuePreview(value)}</span>;
  };

  const renderKey = () => {
    if (!keyName) return null;
    return <span className="text-foreground font-medium">"{keyName}":</span>;
  };

  const indentLevel = level * 16;

  if (!isExpandable(data)) {
    return (
      <div
        className="flex items-start gap-2 py-1 font-mono text-sm"
        style={{ paddingLeft: `${indentLevel}px` }}
      >
        <span className="w-4"></span> {/* Space for expand icon */}
        {renderKey()}
        {renderPrimitive(data)}
      </div>
    );
  }

  const entries = Array.isArray(data)
    ? data.map((item, index) => [String(index), item] as const)
    : Object.entries(data as Record<string, unknown>).map(([key, value]) => {
        // Ensure we're not accidentally stringifying objects
        return [key, value] as const;
      });

  return (
    <div className="font-mono text-sm">
      <div
        className="flex items-center gap-2 py-1 cursor-pointer hover:bg-muted/30 rounded"
        style={{ paddingLeft: `${indentLevel}px` }}
        onClick={(e) => {
          e.stopPropagation();
          setIsExpanded(!isExpanded);
        }}
      >
        <Icon name={isExpanded ? "expand_more" : "chevron_right"} size={16} />
        {renderKey()}
        <span className={getTypeColor(data)}>{getValuePreview(data)}</span>
      </div>

      {isExpanded && (
        <div className="border-l border-border ml-2">
          {entries.map(([key, value]) => (
            <JsonTreeNode
              key={key}
              data={value}
              keyName={key}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function JsonTreeViewer({
  value,
  compact = false,
}: {
  value: unknown;
  compact?: boolean;
}) {
  const parsed = tryParseJson(value);

  // Handle simple string values
  if (typeof parsed === "string") {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <ExpandableString
          value={parsed}
          className="whitespace-pre-wrap break-words font-mono text-current"
          isQuoted
        />
      </div>
    );
  }

  // Handle null, undefined, or other primitive values
  if (parsed === null || parsed === undefined) {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-current">
          {parsed === null ? "null" : "undefined"}
        </pre>
      </div>
    );
  }

  // Handle other primitive values (numbers, booleans)
  if (typeof parsed !== "object") {
    return (
      <div
        className={compact ? "text-sm" : "bg-muted rounded p-3 text-sm"}
        onClick={(e) => e.stopPropagation()}
      >
        <pre className="whitespace-pre-wrap break-words font-mono text-current">
          {String(parsed)}
        </pre>
      </div>
    );
  }

  // Handle objects and arrays
  return (
    <div
      className={compact ? "max-h-64 overflow-y-auto" : "bg-muted rounded p-3"}
      onClick={(e) => e.stopPropagation()}
    >
      <JsonTreeNode data={parsed} />
    </div>
  );
}
