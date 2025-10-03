import { z } from "zod/v3";

/**
 * Views 2.0 Schemas
 *
 * This module provides standardized schemas for Views 2.0, a major version upgrade
 * that introduces standardized view management with Resources 2.0 compliance.
 *
 * Key Features:
 * - Views are Resources 2.0 resources with CRUD operations
 * - Standardized view data schema with icon, prompt, and tools
 * - Type-safe view definitions with Zod validation
 * - Integration with existing Resources 2.0 system
 */

/**
 * View data schema that extends the Resources 2.0 BaseResourceDataSchema
 * Views must have name, description (from BaseResourceDataSchema), plus icon, prompt, and tools
 */
export const ViewDataSchema = z.object({
  name: z.string().describe("View name identifier"),
  description: z.string().describe("View description"),
  icon: z.string().url().describe("HTTPS URL to an image icon for the view"),
  prompt: z.string().describe("LLM prompt for this view"),
  tools: z
    .array(z.string())
    .describe("Array of tool names that this view will call"),
});

// Export types for TypeScript usage
export type ViewData = z.infer<typeof ViewDataSchema>;

/**
 * View render input schema for render operations
 * This is the base schema that can be extended for specific view types
 */
export const BaseViewRenderInputSchema = z.object({});

/**
 * Detail view render input schema for detail view operations
 * This schema includes the resource URI field for detail views
 */
export const DetailViewRenderInputSchema = z.object({
  resource: z
    .string()
    .regex(
      /^rsc:\/\/[^\/]+\/[^\/]+\/.+$/,
      "Invalid resource URI format. Expected format: rsc://integration/resource/resource-id",
    )
    .describe("URI of the resource to render in the view"),
});

/**
 * View render output schema
 * All view render operations return a URL and optional prompt/tools
 */
export const ViewRenderOutputSchema = z.object({
  url: z.string().describe("URL to render the view"),
  prompt: z
    .string()
    .optional()
    .describe("Optional LLM prompt for this view context"),
  tools: z
    .array(z.string())
    .optional()
    .describe("Optional array of tool names for this view context"),
});

// Export types for TypeScript usage
export type ViewRenderInput = z.infer<typeof BaseViewRenderInputSchema>;
export type DetailViewRenderInput = z.infer<typeof DetailViewRenderInputSchema>;
export type ViewRenderOutput = z.infer<typeof ViewRenderOutputSchema>;
