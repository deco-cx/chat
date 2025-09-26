import { z } from "zod";
import type { Binder } from "../bindings/binder.ts";
import {
  createCreateInputSchema,
  createCreateOutputSchema,
  createItemSchema,
  createReadOutputSchema,
  createSearchOutputSchema,
  createUpdateInputSchema,
  createUpdateOutputSchema,
  DeleteInputSchema,
  DeleteOutputSchema,
  ReadInputSchema,
  SearchInputSchema,
} from "./schemas.ts";

export type BaseResourceDataSchema = z.ZodObject<{
  name: z.ZodString;
  description: z.ZodString;
}>;

/**
 * Resources 2.0 Bindings
 *
 * This module provides standardized tool bindings for Resources 2.0, a major version upgrade
 * that introduces standardized resource management with `rsc://` URI format and
 * consistent CRUD operations across all resource types.
 *
 * Key Features:
 * - Generic resource bindings that work with any resource type
 * - Standardized tool naming: `deco_resource_*`
 * - Full TypeScript support with proper type constraints
 * - Integration with existing binding system
 */

/**
 * Creates generic resource bindings for Resources 2.0
 *
 * This function generates standardized tool bindings that work with any resource type
 * by accepting a custom data schema and resource name. The bindings provide the standard CRUD operations:
 * - DECO_RESOURCE_{RESOURCE}_SEARCH - Search resources with pagination and filtering
 * - DECO_RESOURCE_{RESOURCE}_READ - Read a single resource by URI
 * - DECO_RESOURCE_{RESOURCE}_CREATE - Create new resources (optional)
 * - DECO_RESOURCE_{RESOURCE}_UPDATE - Update existing resources (optional)
 * - DECO_RESOURCE_{RESOURCE}_DELETE - Delete resources (optional)
 *
 * @param resourceName - The name of the resource type (e.g., "workflow", "document", "user")
 * @param dataSchema - The Zod schema for the resource data type
 * @returns Array of tool bindings for Resources 2.0 CRUD operations
 */
export function createResourceV2Bindings<
  TDataSchema extends BaseResourceDataSchema,
>(resourceName: string, dataSchema: TDataSchema) {
  return [
    {
      name: `DECO_RESOURCE_${resourceName.toUpperCase()}_SEARCH` as const,
      inputSchema: SearchInputSchema,
      outputSchema: createSearchOutputSchema(
        createItemSchema(dataSchema.pick({ name: true, description: true })),
      ),
    },
    {
      name: `DECO_RESOURCE_${resourceName.toUpperCase()}_READ` as const,
      inputSchema: ReadInputSchema,
      outputSchema: createReadOutputSchema(dataSchema),
    },
    {
      name: `DECO_RESOURCE_${resourceName.toUpperCase()}_CREATE` as const,
      inputSchema: createCreateInputSchema(dataSchema),
      outputSchema: createCreateOutputSchema(dataSchema),
      opt: true,
    },
    {
      name: `DECO_RESOURCE_${resourceName.toUpperCase()}_UPDATE` as const,
      inputSchema: createUpdateInputSchema(dataSchema),
      outputSchema: createUpdateOutputSchema(dataSchema),
      opt: true,
    },
    {
      name: `DECO_RESOURCE_${resourceName.toUpperCase()}_DELETE` as const,
      inputSchema: DeleteInputSchema,
      outputSchema: DeleteOutputSchema,
      opt: true,
    },
  ] as const satisfies Binder;
}

// Export types for TypeScript usage
export type ResourceV2Binding<TDataSchema extends BaseResourceDataSchema> =
  ReturnType<typeof createResourceV2Bindings<TDataSchema>>;
export type ResourceV2BindingsFunction = typeof createResourceV2Bindings;
