/**
 * Context Item System
 * Unified type system for rules, files, toolsets, and resources
 */

export type ContextItemType = "rule" | "file" | "toolset" | "resource";

export interface BaseContextItem {
  id: string;
  type: ContextItemType;
}

export interface RuleContextItem extends BaseContextItem {
  type: "rule";
  text: string;
}

export interface FileContextItem extends BaseContextItem {
  type: "file";
  file: File;
  url?: string;
  status: "uploading" | "success" | "error";
  error?: Error;
}

export interface ToolsetContextItem extends BaseContextItem {
  type: "toolset";
  integrationId: string;
  enabledTools: string[];
}

export interface ResourceContextItem extends BaseContextItem {
  type: "resource";
  uri: string; // Format: rsc://integration-id/resource-name/resource-id
  name?: string;
  resourceType?: string; // "tool", "workflow", "agent", "document", "view"
  icon?: string;
}

export type ContextItem =
  | RuleContextItem
  | FileContextItem
  | ToolsetContextItem
  | ResourceContextItem;

