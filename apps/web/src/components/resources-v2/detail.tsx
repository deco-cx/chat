import { callTool, useIntegration, useTools } from "@deco/sdk";
import type { ReadOutput } from "@deco/sdk/mcp";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useMemo } from "react";
import { useParams } from "react-router";
import { z } from "zod";
import { EmptyState } from "../common/empty-state.tsx";
import { type DecopilotContextValue } from "../decopilot/context.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import { ReactViewRenderer } from "../views/react-view-registry.tsx";
import { ResourceRouteProvider } from "./route-context.tsx";

// Base resource data schema that all resources extend
const BaseResourceDataSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

// View response schema
interface ViewResponse {
  url: string;
  prompt?: string;
  tools?: string[];
}

const ResourceDetailContext = createContext<
  ReadOutput<typeof BaseResourceDataSchema> | undefined
>(undefined);

const ViewQueryContext = createContext<{
  data: ViewResponse | undefined;
  isLoading: boolean;
  error: Error | null;
} | null>(null);

function ResourcesV2DetailTab() {
  const readResponse = useContext(ResourceDetailContext);
  if (readResponse === undefined) {
    throw new Error(
      "ResourcesV2DetailTab must be used within ResourceDetailProvider",
    );
  }

  // View query moved to parent - this component now just renders the result
  const viewQuery = useContext(ViewQueryContext)!;

  if (viewQuery.isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (viewQuery.error || !viewQuery.data) {
    return (
      <EmptyState
        icon="error"
        title="Failed to load view"
        description={
          (viewQuery.error as Error)?.message ||
          "No URL returned from view render"
        }
      />
    );
  }

  if (
    typeof viewQuery.data.url === "string" &&
    viewQuery.data.url?.startsWith("react://")
  ) {
    return <ReactViewRenderer url={viewQuery.data.url} />;
  }

  return (
    <div className="h-full">
      <iframe src={viewQuery.data.url} className="w-full h-full border-0" />
    </div>
  );
}

function ResourcesV2Detail() {
  const { integrationId, resourceName, resourceUri } = useParams();
  const integration = useIntegration(integrationId ?? "").data;
  const decodedUri = useMemo(
    () => (resourceUri ? decodeURIComponent(resourceUri) : undefined),
    [resourceUri],
  );

  const resourceReadQuery = useQuery({
    enabled: Boolean(integration && resourceName && decodedUri),
    queryKey: ["deco-resource-read", integrationId, resourceName, decodedUri],
    queryFn: async () => {
      const result = await callTool(integration!.connection, {
        name: `DECO_RESOURCE_${resourceName!.toUpperCase()}_READ`,
        arguments: { uri: decodedUri! },
      });
      return result.structuredContent as ReadOutput<
        typeof BaseResourceDataSchema
      >;
    },
    staleTime: 30_000,
  });

  // Get tools for the integration
  const toolsQuery = useTools(integration!.connection, false);
  const tools = toolsQuery?.data?.tools ?? [];

  // Filter for view render tools
  const viewRenderTools = useMemo(() => {
    return tools.filter((tool) => {
      // Check if it's a view render tool
      if (!/^DECO_VIEW_RENDER_/.test(tool.name)) return false;

      // Check if it accepts a resource parameter
      try {
        const schema = tool.inputSchema || {};
        const props = (schema?.properties ?? {}) as Record<string, unknown>;
        const resourceProp =
          "resource" in props
            ? (props.resource as Record<string, unknown>)
            : undefined;
        return resourceProp?.type === "string";
      } catch {
        return false;
      }
    });
  }, [tools]);

  // Find the single view render tool for the query
  const viewRenderTool = useMemo(() => {
    return viewRenderTools.find((tool) => {
      // Check if it's a view render tool
      if (!/^DECO_VIEW_RENDER_/.test(tool.name)) return false;

      // Check if it accepts a resource parameter
      try {
        const schema = tool.inputSchema || {};
        const props = (schema?.properties ?? {}) as Record<string, unknown>;
        const resourceProp =
          "resource" in props
            ? (props.resource as Record<string, unknown>)
            : undefined;
        return resourceProp?.type === "string";
      } catch {
        return false;
      }
    });
  }, [viewRenderTools]);

  // View render query - moved from ResourcesV2DetailTab
  const viewQuery = useQuery({
    queryKey: [
      "view-render-single",
      integrationId,
      decodedUri,
      viewRenderTool?.name,
    ],
    enabled: Boolean(integration && decodedUri && viewRenderTool),
    queryFn: async () => {
      const result = await callTool(integration!.connection, {
        name: viewRenderTool!.name,
        arguments: { resource: decodedUri! },
      });

      return result?.structuredContent as ViewResponse;
    },
  });

  const isLoading =
    resourceReadQuery.isLoading || toolsQuery.isLoading || viewQuery.isLoading;
  const readError = resourceReadQuery.isError
    ? (resourceReadQuery.error as Error).message
    : null;
  const readResponse = resourceReadQuery.data;
  const viewResponse = viewQuery.data as ViewResponse | undefined;

  // Prepare decopilot context value for resource detail
  const decopilotContextValue = useMemo((): DecopilotContextValue => {
    if (!integrationId || !readResponse?.data) return {};

    const rules: string[] = [
      `The current resource URI is: ${decodedUri ?? ""}. You can use resource tools to read, search, and work on this resource.`,
      `The current resource data is: ${JSON.stringify(readResponse?.data, null, 2)}. This contains the actual resource information that you can reference when helping the user.`,
      ...(viewResponse?.prompt ? [viewResponse.prompt] : []),
    ];

    // Combine base tools with view-specific tools
    const allTools = viewResponse?.tools ?? [];

    return {
      additionalTools:
        allTools.length > 0
          ? {
              [integrationId]: allTools,
            }
          : undefined,
      rules,
    };
  }, [
    integrationId,
    resourceName,
    readResponse?.data,
    tools,
    viewResponse,
    decodedUri,
  ]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 py-12">
        <Spinner />
        <div className="text-center">
          <div className="text-sm font-medium text-foreground">
            Loading resource
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Fetching {resourceName} details...
          </div>
        </div>
      </div>
    );
  }

  if (readError) {
    return (
      <EmptyState
        icon="error"
        title="Failed to load resource"
        description="An error occurred while loading the resource"
      />
    );
  }

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <ResourceRouteProvider
        integrationId={integrationId}
        resourceName={resourceName}
        resourceUri={decodedUri}
      >
        <ResourceDetailContext.Provider value={readResponse}>
          <ViewQueryContext.Provider value={viewQuery}>
            {!viewRenderTool ? (
              <EmptyState
                icon="view_carousel"
                title="No view render tool available"
                description="This integration doesn't have a view render tool."
              />
            ) : (
              <ResourcesV2DetailTab />
            )}
          </ViewQueryContext.Provider>
        </ResourceDetailContext.Provider>
      </ResourceRouteProvider>
    </DecopilotLayout>
  );
}

export default ResourcesV2Detail;
