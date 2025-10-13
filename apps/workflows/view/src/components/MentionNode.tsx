import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { Badge } from "@deco/ui/components/badge.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Icon } from "@deco/ui/components/icon.tsx";

interface MentionNodeProps extends ReactNodeViewProps<HTMLSpanElement> {}

export default function MentionNode({ node }: MentionNodeProps) {
  const label = node.attrs.label;
  const type = node.attrs.type || "tool";
  const property = node.attrs.property;
  const integration = node.attrs.integration;

  console.log("🎨 [MentionNode] Rendering:", {
    label,
    type,
    property,
    integration,
    attrs: node.attrs,
  });

  // Build display label with @ prefix and property suffix if present
  const displayLabel = property ? `@${label}.${property}` : `@${label}`;

  // Icon for steps vs tools
  const StepIcon =
    type === "step" ? (
      <div className="w-3 h-3 rounded-full bg-purple-500 flex items-center justify-center">
        <Icon name="deployed_code" size={10} className="text-white" />
      </div>
    ) : null;

  const ToolIcon =
    type === "tool" ? (
      <div className="w-3 h-3 rounded-full bg-primary flex items-center justify-center">
        <Icon name="build" size={10} className="text-primary-foreground" />
      </div>
    ) : null;

  return (
    <NodeViewWrapper as="span" data-id={node.attrs.id} data-type="mention">
      <Badge
        variant="secondary"
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium",
          "bg-accent text-accent-foreground border-border hover:bg-accent/80",
        )}
      >
        {type === "step" ? StepIcon : ToolIcon}
        <span className="leading-none">{displayLabel}</span>
      </Badge>
    </NodeViewWrapper>
  );
}
