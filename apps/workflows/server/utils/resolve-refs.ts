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
        const identifier = parsed.id || "";

        // Try to find step result by ID first
        let stepResult = context.stepResults.get(identifier);

        // If not found by ID, try to find by name
        // Look through workflow steps to find a step with matching name
        if (stepResult === undefined && context.workflow?.steps) {
          const matchingStep = context.workflow.steps.find(
            (step: { id: string; name: string }) =>
              step.name === identifier || step.id === identifier,
          );

          if (matchingStep) {
            // Found a step with matching name, try to get result by its ID
            stepResult = context.stepResults.get(matchingStep.id);
          }
        }

        if (stepResult === undefined) {
          return {
            value: null,
            error: `Step not found or not executed: ${identifier}`,
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
 * Coerce a value to match the expected type from the schema
 */
function coerceValueToSchemaType(
  value: unknown,
  schema: Record<string, unknown> | undefined,
): unknown {
  if (!schema || typeof schema !== "object") {
    return value;
  }

  const schemaType = schema.type;

  // Handle string values that should be numbers
  if (schemaType === "number" && typeof value === "string") {
    const num = Number(value);
    if (!Number.isNaN(num)) {
      return num;
    }
  }

  // Handle string values that should be booleans
  if (schemaType === "boolean" && typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }

  // Handle string values that should be integers
  if (schemaType === "integer" && typeof value === "string") {
    const num = Number.parseInt(value, 10);
    if (!Number.isNaN(num)) {
      return num;
    }
  }

  return value;
}

/**
 * Recursively resolve all @refs in an input object and coerce types based on schema
 */
export function resolveAtRefsInInput(
  input: Record<string, unknown>,
  context: WorkflowExecutionContext,
  inputSchema?: Record<string, unknown>,
): ResolvedInput {
  const resolved: Record<string, unknown> = {};
  const errors: Array<{ ref: string; error: string }> = [];

  // Extract schema properties if available
  const schemaProperties =
    inputSchema && typeof inputSchema === "object"
      ? (inputSchema.properties as Record<string, unknown> | undefined)
      : undefined;

  function resolveValue(
    value: unknown,
    propertySchema?: Record<string, unknown>,
  ): unknown {
    // If it's an @ref, resolve it
    if (isAtRef(value)) {
      const result = resolveAtRef(value, context);
      if (result.error) {
        errors.push({ ref: value, error: result.error });
      }
      // Coerce the resolved value based on schema
      return coerceValueToSchemaType(result.value, propertySchema);
    }

    // If it's an array, resolve each element
    if (Array.isArray(value)) {
      const itemSchema =
        propertySchema && typeof propertySchema === "object"
          ? (propertySchema.items as Record<string, unknown> | undefined)
          : undefined;
      return value.map((v) => resolveValue(v, itemSchema));
    }

    // If it's an object, resolve each property
    if (value !== null && typeof value === "object") {
      const resolvedObj: Record<string, unknown> = {};
      const nestedProperties =
        propertySchema && typeof propertySchema === "object"
          ? (propertySchema.properties as Record<string, unknown> | undefined)
          : undefined;

      for (const [key, val] of Object.entries(value)) {
        const nestedSchema = nestedProperties
          ? (nestedProperties[key] as Record<string, unknown> | undefined)
          : undefined;
        resolvedObj[key] = resolveValue(val, nestedSchema);
      }
      return resolvedObj;
    }

    // Primitive value, coerce type based on schema
    return coerceValueToSchemaType(value, propertySchema);
  }

  for (const [key, value] of Object.entries(input)) {
    const propertySchema = schemaProperties
      ? (schemaProperties[key] as Record<string, unknown> | undefined)
      : undefined;
    resolved[key] = resolveValue(value, propertySchema);
  }

  return { resolved, errors: errors.length > 0 ? errors : undefined };
}
