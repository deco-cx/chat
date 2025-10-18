/**
 * Shared types for the unified rich text editor
 */

export interface Tool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  integration: {
    id: string;
    name: string;
    icon?: string;
  };
}

export interface Resource {
  name: string;
  title?: string;
  description?: string;
  uri: string;
  mimeType?: string;
  annotations?: Record<string, string>;
}

export interface ToolMentionItem {
  type: "tool";
  id: string;
  label: string;
  description?: string;
  tool: Tool;
}

export interface ResourceMentionItem {
  type: "resource";
  id: string;
  label: string;
  description?: string;
  resource: Resource;
  integration: { id: string; name: string; icon?: string };
  resourceType: string;
  connection: unknown;
}

export type MentionItem = ToolMentionItem | ResourceMentionItem;
