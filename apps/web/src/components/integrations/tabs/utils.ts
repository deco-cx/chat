import type { MCPConnection } from "@deco/sdk";
import { useTools } from "@deco/sdk";

export interface ComplianceResult {
  isLoading: boolean;
  isCompliant: boolean;
  missingMessage: string | null;
}

export type Tool = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
};

export function useCompliance(
  integration: MCPConnection,
  checker: (tools: Tool[]) => {
    compliant: boolean;
    missing?: string | null;
  },
): ComplianceResult {
  const { data, isLoading } = useTools(integration);
  const { compliant, missing } = checker(data.tools);
  return {
    isLoading,
    isCompliant: compliant,
    missingMessage: !compliant && !isLoading ? missing || null : null,
  };
}

// Helpers for common bindings

export function viewsV2Checker(tools: Tool[]) {
  const hasRender = tools.some((t) => /^DECO_VIEW_RENDER_.+/.test(t.name));
  return {
    compliant: hasRender,
    missing: hasRender ? null : "Missing: DECO_VIEW_RENDER_{viewName}",
  };
}

export function workflowsV2Checker(tools: Tool[]) {
  const starts = new Set<string>();
  const statuses = new Set<string>();
  for (const t of tools) {
    const startMatch = t.name.match(/^DECO_WORKFLOW_([A-Z0-9_]+)_START$/);
    if (startMatch) starts.add(startMatch[1]);
    const statusMatch = t.name.match(/^DECO_WORKFLOW_([A-Z0-9_]+)_GET_STATUS$/);
    if (statusMatch) statuses.add(statusMatch[1]);
  }
  let compliant = false;
  for (const name of starts) {
    if (statuses.has(name)) {
      compliant = true;
      break;
    }
  }
  let missing: string | null = null;
  if (!compliant) {
    if (starts.size === 0 && statuses.size === 0) {
      missing =
        "Add DECO_WORKFLOW_{NAME}_START and DECO_WORKFLOW_{NAME}_GET_STATUS";
    } else if (starts.size === 0) {
      missing = "Missing: DECO_WORKFLOW_{NAME}_START";
    } else if (statuses.size === 0) {
      missing = "Missing: DECO_WORKFLOW_{NAME}_GET_STATUS";
    } else {
      missing =
        "Add matching pairs: DECO_WORKFLOW_{NAME}_START and DECO_WORKFLOW_{NAME}_GET_STATUS for the same {NAME}";
    }
  }
  return { compliant, missing };
}

export function resourcesV2Checker(tools: Tool[]) {
  const matcher = /^DECO_RESOURCE_([A-Z0-9_]+)_(SEARCH|READ)$/;
  const groups = new Map<string, Set<string>>();
  for (const t of tools) {
    const m = t.name.match(matcher);
    if (!m) continue;
    const key = m[1];
    const op = m[2];
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(op);
  }
  let compliant = false;
  for (const ops of groups.values()) {
    if (ops.has("SEARCH") && ops.has("READ")) {
      compliant = true;
      break;
    }
  }
  let missing: string | null = null;
  if (!compliant) {
    if (groups.size === 0) {
      missing =
        "Add DECO_RESOURCE_{RESOURCE}_SEARCH and DECO_RESOURCE_{RESOURCE}_READ for at least one resource type (e.g., VIEW, WORKFLOW).";
    } else {
      for (const [type, ops] of groups.entries()) {
        if (!(ops.has("SEARCH") && ops.has("READ"))) {
          const list: string[] = [];
          if (!ops.has("SEARCH")) list.push(`DECO_RESOURCE_${type}_SEARCH`);
          if (!ops.has("READ")) list.push(`DECO_RESOURCE_${type}_READ`);
          missing = `Missing: ${list.join(", ")}`;
          break;
        }
      }
    }
  }
  return { compliant, missing };
}
