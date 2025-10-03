import { z } from "zod/v3";

/**
 * Resources 2.0 Schemas
 *
 * This module provides standardized schemas for Resources 2.0, a major version upgrade
 * that introduces standardized resource management with `rsc://` URI format and
 * consistent CRUD operations across all resource types.
 *
 * Key Features:
 * - Standardized `rsc://` URI format for all resources
 * - Generic CRUD operation schemas that work with any resource type
 * - Type-safe factory functions for creating resource-specific schemas
 * - Comprehensive validation and error handling
 * - Full TypeScript support with Zod validation
 */

// Common URI format validation for Resources 2.0
export const ResourceUriSchema = z
  .string()
  .regex(
    /^rsc:\/\/[^\/]+\/[^\/]+\/.+$/,
    "Invalid resource URI format. Expected format: rsc://workspace/project/resource-id",
  );

/**
 * Search input schema for resource queries
 * Supports pagination, filtering, sorting, and search terms
 */
export const SearchInputSchema = z.object({
  term: z.string().optional().describe("Search term to filter resources"),
  page: z.number().int().min(1).default(1).describe("Page number (1-based)"),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Number of items per page"),
  filters: z.record(z.any()).optional().describe("Additional filters to apply"),
  sortBy: z.string().optional().describe("Field to sort by"),
  sortOrder: z
    .enum(["asc", "desc"])
    .optional()
    .default("asc")
    .describe("Sort order"),
});

/**
 * Factory function to create search output schema for a specific resource type
 * @param itemSchema - The schema for individual resource items
 * @returns Zod schema for search results with pagination metadata
 */
export function createSearchOutputSchema<T extends z.ZodTypeAny>(
  itemSchema: T,
) {
  return z.object({
    items: z.array(itemSchema).describe("Array of matching resources"),
    totalCount: z
      .number()
      .int()
      .min(0)
      .describe("Total number of matching resources"),
    page: z.number().int().min(1).describe("Current page number"),
    pageSize: z.number().int().min(1).describe("Number of items per page"),
    totalPages: z.number().int().min(0).describe("Total number of pages"),
    hasNextPage: z.boolean().describe("Whether there are more pages available"),
    hasPreviousPage: z
      .boolean()
      .describe("Whether there are previous pages available"),
  });
}

/**
 * Read input schema for retrieving a single resource
 */
export const ReadInputSchema = z.object({
  uri: ResourceUriSchema.describe("URI of the resource to read"),
});

/**
 * Factory function to create read output schema for a specific resource type
 * @param dataSchema - The schema for the resource data
 * @returns Zod schema for read operation results
 */
export function createReadOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema.describe("URI of the resource"),
    data: dataSchema.describe("Resource data"),
    created_at: z.string().datetime().optional().describe("Creation timestamp"),
    updated_at: z
      .string()
      .datetime()
      .optional()
      .describe("Last update timestamp"),
    created_by: z.string().optional().describe("User who created the resource"),
    updated_by: z
      .string()
      .optional()
      .describe("User who last updated the resource"),
  });
}

/**
 * Factory function to create create input schema for a specific resource type
 * @param dataSchema - The schema for the resource data to create
 * @returns Zod schema for create operation input
 */
export function createCreateInputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema.describe("Resource data to create"),
  });
}

/**
 * Factory function to create create output schema for a specific resource type
 * @param dataSchema - The schema for the created resource data
 * @returns Zod schema for create operation results
 */
export function createCreateOutputSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
) {
  return z.object({
    uri: ResourceUriSchema.describe("URI of the created resource"),
    data: dataSchema.describe("Created resource data"),
    created_at: z.string().datetime().optional().describe("Creation timestamp"),
    updated_at: z
      .string()
      .datetime()
      .optional()
      .describe("Last update timestamp"),
    created_by: z.string().optional().describe("User who created the resource"),
  });
}

/**
 * Factory function to create update input schema for a specific resource type
 * @param dataSchema - The schema for the resource data to update
 * @returns Zod schema for update operation input
 */
export function createUpdateInputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema.describe("URI of the resource to update"),
    data: dataSchema.describe("Updated resource data"),
  });
}

/**
 * Factory function to create update output schema for a specific resource type
 * @param dataSchema - The schema for the updated resource data
 * @returns Zod schema for update operation results
 */
export function createUpdateOutputSchema<T extends z.ZodTypeAny>(
  dataSchema: T,
) {
  return z.object({
    uri: ResourceUriSchema.describe("URI of the updated resource"),
    data: dataSchema.describe("Updated resource data"),
    created_at: z
      .string()
      .datetime()
      .optional()
      .describe("Original creation timestamp"),
    updated_at: z
      .string()
      .datetime()
      .optional()
      .describe("Last update timestamp"),
    created_by: z
      .string()
      .optional()
      .describe("User who originally created the resource"),
    updated_by: z
      .string()
      .optional()
      .describe("User who last updated the resource"),
  });
}

/**
 * Delete input schema for removing a resource
 */
export const DeleteInputSchema = z.object({
  uri: ResourceUriSchema.describe("URI of the resource to delete"),
});

/**
 * Delete output schema for delete operation results
 */
export const DeleteOutputSchema = z.object({
  success: z.boolean().describe("Whether the deletion was successful"),
  uri: ResourceUriSchema.describe("URI of the deleted resource"),
});

/**
 * Factory function to create item schema for a specific resource type
 * This schema is used in search results and lists
 * @param dataSchema - The schema for the resource data
 * @returns Zod schema for resource items with metadata
 */
export function createItemSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema.describe("URI of the resource"),
    data: z
      .object({
        name: z.string().min(1, "Name is required"),
        description: z
          .string()
          .optional()
          .describe("Description of the resource"),
        icon: z.string().url().optional().describe("URL to the resource icon"),
      })
      .and(dataSchema)
      .describe("Resource data with required name"),
    created_at: z.string().datetime().optional().describe("Creation timestamp"),
    updated_at: z
      .string()
      .datetime()
      .optional()
      .describe("Last update timestamp"),
    created_by: z.string().optional().describe("User who created the resource"),
    updated_by: z
      .string()
      .optional()
      .describe("User who last updated the resource"),
  });
}

// Export types for TypeScript usage
export type ResourceUri = z.infer<typeof ResourceUriSchema>;
export type SearchInput = z.infer<typeof SearchInputSchema>;
export type SearchOutput<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createSearchOutputSchema<T>>
>;
export type ReadInput = z.infer<typeof ReadInputSchema>;
export type ReadOutput<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createReadOutputSchema<T>>
>;
export type CreateInput<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createCreateInputSchema<T>>
>;
export type CreateOutput<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createCreateOutputSchema<T>>
>;
export type UpdateInput<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createUpdateInputSchema<T>>
>;
export type UpdateOutput<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createUpdateOutputSchema<T>>
>;
export type DeleteInput = z.infer<typeof DeleteInputSchema>;
export type DeleteOutput = z.infer<typeof DeleteOutputSchema>;
export type ResourceItem<T extends z.ZodTypeAny> = z.infer<
  ReturnType<typeof createItemSchema<T>>
>;
