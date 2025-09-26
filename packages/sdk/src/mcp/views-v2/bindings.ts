import { z } from "zod";
import type { Binder } from "../bindings/binder.ts";
import { createResourceV2Bindings } from "../resources-v2/bindings.ts";
import { ViewDataSchema } from "./schemas.ts";
import { ViewRenderOutputSchema } from "./schemas.ts";

/**
 * Views 2.0 Bindings
 *
 * This module provides standardized tool bindings for Views 2.0, a major version upgrade
 * that introduces standardized view management with Resources 2.0 compliance.
 *
 * Key Features:
 * - Views are Resources 2.0 resources with full CRUD operations
 * - Standardized tool naming: `DECO_RESOURCE_VIEW_*` for CRUD, `deco_view_render_*` for rendering
 * - Full TypeScript support with proper type constraints
 * - Integration with existing binding system and Resources 2.0
 * - Support for multiple view types and render operations
 */

/**
 * Views 2.0 Resource Bindings
 *
 * These bindings provide the standard Resources 2.0 CRUD operations for Views:
 * - DECO_RESOURCE_VIEW_SEARCH - Search view resources with pagination and filtering
 * - DECO_RESOURCE_VIEW_READ - Read a single view resource by URI
 * - DECO_RESOURCE_VIEW_CREATE - Create new view resources (optional)
 * - DECO_RESOURCE_VIEW_UPDATE - Update existing view resources (optional)
 * - DECO_RESOURCE_VIEW_DELETE - Delete view resources (optional)
 *
 * Views are treated as Resources 2.0 resources, so they follow the same patterns
 * as other resource types like workflows and tools.
 */
export const VIEW_V2_RESOURCE_BINDINGS = createResourceV2Bindings(
  "view",
  ViewDataSchema,
);

/**
 * View Render Binding Schema
 *
 * This schema defines the standard structure for view render operations.
 * All view render operations follow the pattern: `deco_view_render_{viewName}`
 * and return a URL with optional prompt and tools for LLM agents.
 */
export const VIEW_RENDER_BINDING_SCHEMA = z.object({
  name: z
    .string()
    .regex(
      /^deco_view_render_.+$/,
      "View render tool names must start with 'deco_view_render_'",
    ),
  inputSchema: z.any().describe("Input schema for the view render operation"),
  outputSchema: ViewRenderOutputSchema,
  opt: z
    .boolean()
    .optional()
    .describe("Whether this render operation is optional"),
});

/**
 * Complete Views 2.0 Binding Schema
 *
 * This schema combines both the resource CRUD operations and render operations
 * to provide a complete Views 2.0 binding definition.
 */
export const VIEW_V2_BINDING_SCHEMA = [
  ...VIEW_V2_RESOURCE_BINDINGS,
  // Note: Render operations are added dynamically by createViewBindingsFor()
  // This ensures type safety and proper integration with the helper functions
] as const satisfies Binder;

// Export types for TypeScript usage
export type ViewV2ResourceBinding = typeof VIEW_V2_RESOURCE_BINDINGS;
export type ViewV2Binding = typeof VIEW_V2_BINDING_SCHEMA;
export type ViewRenderBinding = z.infer<typeof VIEW_RENDER_BINDING_SCHEMA>;
