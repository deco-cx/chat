import { z } from "zod/v3";
import type { BinderImplementation } from "../bindings/binder.ts";
import { impl, type AppContext, type ToolBinder } from "../index.ts";
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
  ResourceUriSchema,
  SearchInputSchema,
  type CreateInput,
  type CreateOutput,
  type DeleteInput,
  type DeleteOutput,
  type ReadInput,
  type ReadOutput,
  type SearchInput,
  type SearchOutput,
  type UpdateInput,
  type UpdateOutput,
} from "./schemas.ts";

/**
 * Resources 2.0 Helper Functions
 *
 * This module provides helper functions for creating Resources 2.0 implementations
 * with standardized tool bindings and implementations. These helpers make it easy
 * to create new resource types with consistent CRUD operations.
 *
 * Key Features:
 * - Type-safe resource definitions with generic data schemas
 * - Automatic tool binding generation for CRUD operations
 * - Consistent implementation patterns across all resource types
 * - Support for optional operations (create, update, delete)
 * - Full TypeScript support with proper type inference
 * - Integration with existing binding system and impl function
 */

/**
 * Definition interface for creating a new resource type
 * @template TDataSchema - The Zod schema for the resource data
 */
export interface ResourceDefinition<TDataSchema extends z.ZodTypeAny> {
  /** Name of the resource type (e.g., "workflow", "document", "agent") */
  name: string;
  /** Zod schema that defines the structure of the resource data */
  dataSchema: TDataSchema;
  /** Handler for searching resources (required) */
  searchHandler: (
    input: SearchInput,
    context: AppContext,
  ) => Promise<SearchOutput<z.infer<TDataSchema>>>;
  /** Handler for reading a single resource (required) */
  readHandler: (
    input: ReadInput,
    context: AppContext,
  ) => Promise<ReadOutput<z.infer<TDataSchema>>>;
  /** Handler for creating new resources (optional) */
  createHandler?: (
    input: CreateInput<z.infer<TDataSchema>>,
    context: AppContext,
  ) => Promise<CreateOutput<z.infer<TDataSchema>>>;
  /** Handler for updating existing resources (optional) */
  updateHandler?: (
    input: UpdateInput<z.infer<TDataSchema>>,
    context: AppContext,
  ) => Promise<UpdateOutput<z.infer<TDataSchema>>>;
  /** Handler for deleting resources (optional) */
  deleteHandler?: (
    input: DeleteInput,
    context: AppContext,
  ) => Promise<DeleteOutput>;
}

/**
 * Creates tool bindings for a resource type based on the provided definition
 *
 * This function generates the appropriate tool bindings for CRUD operations
 * on a specific resource type. It creates bindings with the naming pattern:
 * - DECO_RESOURCE_{NAME}_SEARCH - Search resources
 * - DECO_RESOURCE_{NAME}_READ - Read a single resource
 * - DECO_RESOURCE_{NAME}_CREATE - Create new resource (optional)
 * - DECO_RESOURCE_{NAME}_UPDATE - Update existing resource (optional)
 * - DECO_RESOURCE_{NAME}_DELETE - Delete resource (optional)
 *
 * @template TDataSchema - The Zod schema for the resource data
 * @param definition - The resource definition containing schemas and handlers
 * @returns Array of tool bindings for the resource type
 */
export function createResourceTools<TDataSchema extends z.ZodTypeAny>(
  definition: ResourceDefinition<TDataSchema>,
): ToolBinder[] {
  const itemSchema = createItemSchema(definition.dataSchema);
  const bindings: ToolBinder[] = [];

  // Required tools - search and read
  bindings.push({
    name: `DECO_RESOURCE_${definition.name.toUpperCase()}_SEARCH`,
    inputSchema: z.lazy(() => SearchInputSchema),
    outputSchema: createSearchOutputSchema(itemSchema),
  });

  bindings.push({
    name: `DECO_RESOURCE_${definition.name.toUpperCase()}_READ`,
    inputSchema: z.lazy(() => ReadInputSchema),
    outputSchema: createReadOutputSchema(definition.dataSchema),
  });

  // Optional tools - create, update, delete
  if (definition.createHandler) {
    bindings.push({
      name: `DECO_RESOURCE_${definition.name.toUpperCase()}_CREATE`,
      inputSchema: createCreateInputSchema(definition.dataSchema),
      outputSchema: createCreateOutputSchema(definition.dataSchema),
      opt: true,
    });
  }

  if (definition.updateHandler) {
    bindings.push({
      name: `DECO_RESOURCE_${definition.name.toUpperCase()}_UPDATE`,
      inputSchema: createUpdateInputSchema(definition.dataSchema),
      outputSchema: createUpdateOutputSchema(definition.dataSchema),
      opt: true,
    });
  }

  if (definition.deleteHandler) {
    bindings.push({
      name: `DECO_RESOURCE_${definition.name.toUpperCase()}_DELETE`,
      inputSchema: z.lazy(() => DeleteInputSchema),
      outputSchema: z.lazy(() => DeleteOutputSchema),
      opt: true,
    });
  }

  return bindings;
}

/**
 * Creates a complete resource implementation using the existing impl function
 *
 * This function generates tool implementations for all the bindings created by
 * createResourceTools. It uses the existing impl function from the binding
 * system to create the actual tool implementations.
 *
 * @template TDataSchema - The Zod schema for the resource data
 * @param definition - The resource definition containing schemas and handlers
 * @returns Array of tool implementations ready to be used
 */
export function createResourceImplementation<TDataSchema extends z.ZodTypeAny>(
  definition: ResourceDefinition<TDataSchema>,
) {
  const tools = createResourceTools(definition);

  // Create implementation handlers array
  const handlers = [
    // Required handlers
    {
      description: `Search ${definition.name} resources`,
      handler: definition.searchHandler,
    },
    {
      description: `Read a ${definition.name} resource`,
      handler: definition.readHandler,
    },
    // Optional handlers
    ...(definition.createHandler
      ? [
          {
            description: `Create a new ${definition.name} resource`,
            handler: definition.createHandler,
          },
        ]
      : []),
    ...(definition.updateHandler
      ? [
          {
            description: `Update a ${definition.name} resource`,
            handler: definition.updateHandler,
          },
        ]
      : []),
    ...(definition.deleteHandler
      ? [
          {
            description: `Delete a ${definition.name} resource`,
            handler: definition.deleteHandler,
          },
        ]
      : []),
  ];

  // Use existing impl function from packages/sdk/src/mcp/bindings/binder.ts
  return impl(tools, handlers as unknown as BinderImplementation<typeof tools>);
}

/**
 * Utility function to validate a resource URI format
 *
 * @param uri - The URI to validate
 * @returns True if the URI is valid, false otherwise
 */
export function validateResourceUri(uri: string): boolean {
  try {
    ResourceUriSchema.parse(uri);
    return true;
  } catch {
    return false;
  }
}

/**
 * Utility function to parse a resource URI into its components
 *
 * @param uri - The URI to parse
 * @returns Object containing the parsed components or null if invalid
 */
export function parseResourceUri(uri: string): {
  workspace: string;
  project: string;
  resourceId: string;
} | null {
  try {
    const validated = ResourceUriSchema.parse(uri);
    const match = validated.match(/^rsc:\/\/([^\/]+)\/([^\/]+)\/(.+)$/);

    if (!match) {
      return null;
    }

    return {
      workspace: match[1],
      project: match[2],
      resourceId: match[3],
    };
  } catch {
    return null;
  }
}

/**
 * Utility function to construct a resource URI from components
 *
 * @param workspace - The workspace identifier
 * @param project - The project identifier
 * @param resourceId - The resource identifier
 * @returns The constructed resource URI
 */
export function constructResourceUri(
  workspace: string,
  project: string,
  resourceId: string,
): string {
  return `rsc://${workspace}/${project}/${resourceId}`;
}

// Export types for TypeScript usage
export type ResourceDefinitionType<T extends z.ZodTypeAny> =
  ResourceDefinition<T>;
export type ResourceToolsType<T extends z.ZodTypeAny> = ReturnType<
  typeof createResourceTools<T>
>;
export type ResourceImplementationType<T extends z.ZodTypeAny> = ReturnType<
  typeof createResourceImplementation<T>
>;
