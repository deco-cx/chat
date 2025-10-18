import { Badge } from "@deco/ui/components/badge.js";
import { Icon } from "@deco/ui/components/icon.js";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { cn } from "@deco/ui/lib/utils.js";

interface MentionNodeProps extends ReactNodeViewProps<HTMLSpanElement> {
  // deno-lint-ignore no-explicit-any
  IntegrationAvatar?: React.ComponentType<any>;
  // deno-lint-ignore no-explicit-any
  ResourceIcon?: React.ComponentType<any>;
}

// Map resource types to their corresponding icons
const RESOURCE_TYPE_ICONS: Record<string, string> = {
  view: "dashboard",
  VIEW: "dashboard",
  document: "description",
  DOCUMENT: "description",
  workflow: "flowchart",
  WORKFLOW: "flowchart",
};

export function MentionNode({ node, IntegrationAvatar }: MentionNodeProps) {
  const mentionType = node.attrs.mentionType;
  const label = node.attrs.label;
  const integrationIcon = node.attrs.integrationIcon;
  const integrationName = node.attrs.integrationName;
  const resourceType = node.attrs.resourceType;

  // Determine which icon to use for resources
  const resourceIconName = resourceType
    ? RESOURCE_TYPE_ICONS[resourceType] || "description"
    : "description";

  return (
    <NodeViewWrapper
      as="span"
      data-type="mention"
      data-mention-type={mentionType}
      data-tool-id={node.attrs.toolId}
      data-tool-name={node.attrs.toolName}
      data-integration-id={node.attrs.integrationId}
      data-input-schema={node.attrs.inputSchema}
      data-output-schema={node.attrs.outputSchema}
      data-resource-name={node.attrs.resourceName}
      data-resource-uri={node.attrs.resourceUri}
      data-resource-type={node.attrs.resourceType}
    >
      <Badge
        variant="secondary"
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium",
          "bg-accent text-accent-foreground border-border hover:bg-accent/80",
        )}
      >
        {mentionType === "tool" && IntegrationAvatar && integrationIcon && (
          <IntegrationAvatar
            url={integrationIcon}
            fallback={integrationName || label}
            size="xs"
            className="w-3 h-3"
          />
        )}
        {mentionType === "resource" && (
          <Icon name={resourceIconName} className="w-3 h-3" />
        )}
        <span className="leading-none">@{label}</span>
      </Badge>
    </NodeViewWrapper>
  );
}
