import { z } from "zod";
import { impl, type BinderImplementation } from "../bindings/binder.ts";
import {
  assertWorkspaceResourceAccess,
  createTool,
  type AppContext,
} from "../index.ts";
import { createResourceV2Bindings } from "../resources-v2/bindings.ts";
import {
  BaseViewRenderInputSchema,
  ViewDataSchema,
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
    handler: options.handler,
  };
}

/**
 * View implementation options for creating view implementations
 */
export interface ViewImplementationOptions {
  integrationId: string;
  renderers: ViewRenderer<any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
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
  const { integrationId, renderers } = options;

  // Create Resources 2.0 bindings for Views (CRUD operations)
  const resourceBindings = createResourceV2Bindings("view", ViewDataSchema);

  // Step 1: Create resources tools from resources bindings
  const resourceHandlers = [
    {
      description: `Search view resources exposed by this integration`,
      handler: async (
        input: { page: number; pageSize: number },
        c: AppContext,
      ) => {
        await assertWorkspaceResourceAccess(c);

        const items = renderers.map((renderer) => ({
          uri: `rsc://${integrationId}/view/${renderer.name}`,
          data: {
            name: renderer.name,
            description: renderer.description,
            icon: renderer.icon,
            prompt: renderer.prompt,
            tools: [
              `DECO_VIEW_RENDER_${renderer.name.toUpperCase()}`,
              ...renderer.tools,
            ],
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        return {
          items,
          totalCount: items.length,
          page: input.page || 1,
          pageSize: input.pageSize || 20,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        };
      },
    },
    {
      description: `Read a view resource exposed by this integration`,
      handler: async (input: any, c: AppContext) => {
        // eslint-disable-line @typescript-eslint/no-explicit-any
        await assertWorkspaceResourceAccess(c);

        const uriParts = input.uri.split("/");
        const viewName = uriParts[uriParts.length - 1];

        const renderer = renderers.find((r) => r.name === viewName);
        if (!renderer) {
          throw new Error(`View not found: ${input.uri}`);
        }

        return {
          uri: input.uri,
          data: {
            name: renderer.name,
            description: renderer.description,
            icon: renderer.icon,
            prompt: renderer.prompt,
            tools: [
              `DECO_VIEW_RENDER_${renderer.name.toUpperCase()}`,
              ...renderer.tools,
            ],
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      },
    },
  ];

  const resourceTools = impl(
    resourceBindings,
    resourceHandlers as unknown as BinderImplementation<
      typeof resourceBindings
    >,
  );

  // Step 2: Create view tools directly from renderers
  const viewTools = renderers.map((renderer) =>
    createTool({
      name: `DECO_VIEW_RENDER_${renderer.name.toUpperCase()}`,
      description: `Render ${renderer.name} view`,
      inputSchema: renderer.inputSchema,
      outputSchema: ViewRenderOutputSchema,
      handler: async (input, context) => {
        context.resourceAccess.grant();

        const { url } = await renderer.handler(input, context);
        return {
          url,
          prompt: renderer.prompt,
          tools: renderer.tools,
        };
      },
    }),
  );

  // Return the merged array of tools
  return [...resourceTools, ...viewTools];
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
  // Special-case: workflow detail renders as a built-in React view
  if (resourceType === "workflow") {
    const searchParams = new URLSearchParams({
      uri: resourceUri,
      integrationId,
      view: "detail",
      ...params,
    });
    return `react://workflow_detail?${searchParams.toString()}`;
  }

  return createResourceCentricUrl(resourceType, "detail", integrationId, {
    uri: resourceUri,
    ...params,
  });
}
