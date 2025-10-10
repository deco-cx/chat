import { z } from "zod";
import { createTool, type AppContext } from "../index.ts";
import {
  BaseViewRenderInputSchema,
  ViewRenderOutputSchema,
} from "./schemas.ts";

/**
 * Views 2.0 Helper Functions
 *
 * This module provides helper functions for creating Views 2.0 implementations
 * that comply with Resources 2.0 standards and integrate seamlessly with the
 * existing binding system.
 *
 * Key Features:
 * - Type-safe view renderer creation
 * - Automatic binding generation for Resources 2.0 compliance
 * - Integration with existing impl() and binding system
 * - Support for multiple view types and render handlers
 */

/**
 * View renderer definition interface
 * Defines a view renderer with its input schema, handler function, and metadata
 */
export interface ViewRenderer<
  TInputSchema extends z.ZodTypeAny = typeof BaseViewRenderInputSchema,
> {
  name: string;
  title: string;
  description: string;
  icon: string;
  inputSchema: TInputSchema;
  tools: string[];
  prompt: string;
  rules?: string[];
  handler: (
    input: z.infer<TInputSchema>,
    context: AppContext,
  ) => Promise<{ url: string }>;
}

/**
 * View renderer options for creating view renderers
 */
export interface ViewRendererOptions<
  TInputSchema extends z.ZodTypeAny = typeof BaseViewRenderInputSchema,
> {
  name: string;
  title: string;
  description: string;
  icon: string;
  inputSchema?: TInputSchema;
  tools: string[];
  prompt: string;
  rules?: string[];
  handler: (
    input: z.infer<TInputSchema>,
    context: AppContext,
  ) => Promise<{ url: string }>;
}

/**
 * Creates a view renderer for a specific view type
 *
 * @param options - View renderer configuration
 * @returns ViewRenderer object with name, input schema, and handler
 *
 */
export function createViewRenderer<
  TInputSchema extends z.ZodTypeAny = typeof BaseViewRenderInputSchema,
>(options: ViewRendererOptions<TInputSchema>): ViewRenderer<TInputSchema> {
  return {
    name: options.name,
    title: options.title,
    description: options.description,
    icon: options.icon,
    inputSchema: (options.inputSchema ||
      BaseViewRenderInputSchema) as TInputSchema,
    tools: options.tools,
    prompt: options.prompt,
    rules: options.rules,
    handler: options.handler,
  };
}

/**
 * View implementation options for creating view implementations
 */
export interface ViewImplementationOptions {
  // deno-lint-ignore no-explicit-any
  renderers: ViewRenderer<any>[];
}

/**
 * Creates a complete Views 2.0 implementation from renderers
 *
 * This function automatically generates all necessary bindings and handlers
 * from the provided renderers array. It creates:
 * - Standard Resources 2.0 CRUD operations (search, read)
 * - View-specific render operations for each renderer
 * - Automatic search and read handlers that work with the renderers
 *
 * @param options - View implementation configuration
 * @returns Complete Views 2.0 implementation with bindings and handlers
 *
 */
export function createViewImplementation(options: ViewImplementationOptions) {
  return options.renderers.map(
    ({ name, inputSchema, handler, prompt, tools, rules }) =>
      createTool({
        name: `DECO_VIEW_RENDER_${name.toUpperCase()}`,
        description: `Render ${name} view`,
        inputSchema: z.lazy(() => inputSchema),
        outputSchema: z.lazy(() => ViewRenderOutputSchema),
        handler: async (input, context) => {
          context.resourceAccess.grant();

          const { url } = await handler(input, context);

          return {
            url,
            prompt: prompt,
            tools: tools,
            rules: rules,
          };
        },
      }),
  );
}

/**
 * Helper function to create a resource-centric URL for Views 2.0
 *
 * @param resourceType - The type of resource (e.g., "workflow", "tool")
 * @param viewName - The name of the view (e.g., "detail", "list")
 * @param integrationId - The integration ID
 * @param params - Additional URL parameters
 * @returns Resource-centric URL string
 *
 */
export function createResourceCentricUrl(
  resourceType: string,
  viewName: string,
  integrationId: string,
  params: Record<string, string> = {},
): string {
  const searchParams = new URLSearchParams({
    view: viewName,
    integrationId,
    ...params,
  });

  return `internal://resources/${resourceType}?${searchParams.toString()}`;
}

/**
 * Helper function to create a list view URL for Views 2.0
 *
 * @param resourceType - The type of resource (e.g., "workflow", "tool")
 * @param integrationId - The integration ID
 * @param params - Additional URL parameters
 * @returns List view URL string
 */
export function createListViewUrl(
  resourceType: string,
  integrationId: string,
  params: Record<string, string> = {},
): string {
  return createResourceCentricUrl(resourceType, "list", integrationId, params);
}

/**
 * Helper function to create a detail view URL for Views 2.0
 *
 * @param resourceType - The type of resource (e.g., "workflow", "tool")
 * @param integrationId - The integration ID
 * @param resourceUri - The resource URI
 * @param params - Additional URL parameters
 * @returns Detail view URL string
 */
export function createDetailViewUrl(
  resourceType: string,
  integrationId: string,
  resourceUri: string,
  params: Record<string, string> = {},
): string {
  const url = new URL(`react://${resourceType}_detail`);

  url.searchParams.set("uri", resourceUri);
  url.searchParams.set("integrationId", integrationId);
  url.searchParams.set("view", "detail");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url.href;
}
