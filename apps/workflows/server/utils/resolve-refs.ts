/**
 * @refs Resolution Utilities
 * Based on plans/01-tool-calls.md and plans/02-data-model-and-refs.md
 */

import type {
  AtRef,
  ResolvedInput,
  WorkflowExecutionContext,
} from "../../shared/types/workflows.ts";

/**
 * Check if a value is an @ref
 */
export function isAtRef(value: unknown): value is AtRef {
  return typeof value === "string" && value.startsWith("@");
}

/**
 * Parse an @ref into its components
 * Examples:
 *   @step-1.result.data -> { type: 'step', id: 'step-1', path: 'result.data' }
 *   @input.userId -> { type: 'input', path: 'userId' }
 *   @resource:todo/123 -> { type: 'resource', resourceType: 'todo', resourceId: '123' }
 */
export function parseAtRef(ref: AtRef): {
  type: "step" | "input" | "resource";
  id?: string;
  path?: string;
  resourceType?: string;
  resourceId?: string;
} {
  const refStr = ref.substring(1); // Remove @ prefix

  // Resource reference: @resource:type/id
  if (refStr.startsWith("resource:")) {
    const [, rest] = refStr.split("resource:");
    const [resourceType, resourceId] = rest.split("/");
    return { type: "resource", resourceType, resourceId };
  }

  // Input reference: @input.path.to.value
  if (refStr.startsWith("input")) {
    const path = refStr.substring(6); // Remove 'input.'
    return { type: "input", path };
  }

  // Step reference: @stepId.path.to.value
  const [id, ...pathParts] = refStr.split(".");

  // If path starts with 'output.', remove it since stepResults already contains the output
  // Example: @step_xxx.output.poem -> path should be 'poem', not 'output.poem'
  let path = pathParts.join(".");
  if (path.startsWith("output.")) {
    path = path.substring(7); // Remove 'output.'
  }

  return { type: "step", id, path };
}

/**
 * Get value from object using dot notation path
 * Example: getValue({ a: { b: { c: 42 } } }, 'a.b.c') -> 42
 */
export function getValue(
  obj: Record<string, unknown> | unknown[] | unknown,
  path: string,
): unknown {
  if (!path) return obj;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      current = isNaN(index) ? undefined : current[index];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Resolve a single @ref to its actual value
 */
export function resolveAtRef(
  ref: AtRef,
  context: WorkflowExecutionContext,
): { value: unknown; error?: string } {
  try {
    const parsed = parseAtRef(ref);

    switch (parsed.type) {
      case "input": {
        const value = getValue(context.globalInput || {}, parsed.path || "");
        if (value === undefined) {
          return { value: null, error: `Input path not found: ${parsed.path}` };
        }
        return { value };
      }

      case "step": {
        const stepResult = context.stepResults.get(parsed.id || "");
        if (stepResult === undefined) {
          return {
            value: null,
            error: `Step not found or not executed: ${parsed.id}`,
          };
        }
        const value = getValue(stepResult, parsed.path || "");
        if (value === undefined) {
          return {
            value: null,
            error: `Path not found in step result: ${parsed.path}`,
          };
        }
        return { value };
      }

      case "resource": {
        // For now, resource resolution is not implemented
        // In the future, this could fetch from database
        return {
          value: null,
          error: `Resource resolution not implemented: ${parsed.resourceType}/${parsed.resourceId}`,
        };
      }

      default:
        return { value: null, error: `Unknown reference type: ${ref}` };
    }
  } catch (error) {
    return { value: null, error: `Failed to resolve ${ref}: ${String(error)}` };
  }
}

/**
 * Recursively resolve all @refs in an input object
 */
export function resolveAtRefsInInput(
  input: Record<string, unknown>,
  context: WorkflowExecutionContext,
): ResolvedInput {
  const resolved: Record<string, unknown> = {};
  const errors: Array<{ ref: string; error: string }> = [];

  function resolveValue(value: unknown): unknown {
    // If it's an @ref, resolve it
    if (isAtRef(value)) {
      const result = resolveAtRef(value, context);
      if (result.error) {
        errors.push({ ref: value, error: result.error });
      }
      return result.value;
    }

    // If it's an array, resolve each element
    if (Array.isArray(value)) {
      return value.map(resolveValue);
    }

    // If it's an object, resolve each property
    if (value !== null && typeof value === "object") {
      const resolvedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        resolvedObj[key] = resolveValue(val);
      }
      return resolvedObj;
    }

    // Primitive value, return as-is
    return value;
  }

  for (const [key, value] of Object.entries(input)) {
    resolved[key] = resolveValue(value);
  }

  return { resolved, errors: errors.length > 0 ? errors : undefined };
}
