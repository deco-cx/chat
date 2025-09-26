import {
  findConnectionView,
  useConnectionViews,
  useIntegrations,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { createContext, useContext, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import Preview from "../agent/preview";
import { ReactViewRenderer } from "./react-view-registry.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import { InternalResourceListWithIntegration } from "./internal-resource-list.tsx";
import { ViewRouteProvider } from "./view-route-context.tsx";
import { WorkflowView } from "./workflow-view.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { DecopilotProvider } from "../decopilot/context.tsx";

interface ViewDetailContextValue {
  integrationId?: string;
  integration?: {
    id: string;
    name: string;
    icon?: string;
    description?: string;
    connection?: { type?: string; url?: string };
  };
  resolvedUrl: string;
  embeddedName?: string;
  view?: {
    title?: string;
    icon?: string;
    url?: string;
    rules?: string[];
  };
}

const ViewDetailContext = createContext<ViewDetailContextValue | undefined>(
  undefined,
);

function useViewDetail(): ViewDetailContextValue {
  const ctx = useContext(ViewDetailContext);
  if (!ctx) {
    return { resolvedUrl: "" };
  }
  return ctx;
}

function PreviewTab() {
  const { embeddedName, integrationId, integration, resolvedUrl, view } =
    useViewDetail();

  if (resolvedUrl.startsWith("internal://resource/list")) {
    if (!embeddedName || !integrationId) {
      return (
        <EmptyState
          icon="report"
          title="Missing embedded name or integration id"
          description="The embedded name or integration id is missing from the URL parameters. This is likely a bug in the system, please report it to the team."
        />
      );
    }

    return (
      <InternalResourceListWithIntegration
        name={embeddedName}
        integrationId={integrationId}
      />
    );
  }

  if (resolvedUrl.startsWith("internal://resource/detail")) {
    if (embeddedName === "workflow") {
      return <WorkflowView />;
    }

    return (
      <EmptyState
        icon="report"
        title="Not implemented yet"
        description="This view is not implemented yet."
      />
    );
  }

  // Built-in React views routing
  if (resolvedUrl.startsWith("react://")) {
    return <ReactViewRenderer url={resolvedUrl} />;
  }

  const relativeTo =
    integration?.connection?.type === "HTTP"
      ? (integration?.connection?.url ?? "")
      : "";
  const src = new URL(resolvedUrl, relativeTo).href;

  return <Preview src={src} title={view?.title || "Untitled view"} />;
}

const TABS: Record<string, Tab> = {
  preview: {
    Component: PreviewTab,
    title: "Preview",
    initialOpen: true,
    active: true,
  },
};

export default function ViewDetail() {
  const { integrationId, viewName } = useParams();
  const [searchParams] = useSearchParams();
  const url = searchParams.get("viewUrl") || searchParams.get("url");
  const { data: integrations = [] } = useIntegrations();

  const integration = useMemo(
    () => integrations.find((i) => i.id === integrationId),
    [integrations, integrationId],
  );

  const { data: connectionViews } = useConnectionViews(integration ?? null);

  const connectionViewMatch = useMemo(() => {
    return findConnectionView(connectionViews?.views, { viewName, url });
  }, [connectionViews, viewName, url]);

  const resolvedUrl = url || connectionViewMatch?.url || "";

  const embeddedName = useMemo(() => {
    if (!resolvedUrl) {
      return undefined;
    }
    try {
      const u = new URL(resolvedUrl);
      return u.searchParams.get("name") ?? undefined;
    } catch {
      return undefined;
    }
  }, [resolvedUrl]);

  const tabs = TABS;

  // Rules are now passed directly to AgentProvider via initialRules parameter

  // Prepare decopilot context value
  const decopilotContextValue = useMemo(() => {
    if (!connectionViewMatch || !integrationId) return {};

    const rules: string[] = [];

    // Add prompt as a rule if available
    if (connectionViewMatch.prompt) {
      rules.push(connectionViewMatch.prompt);
    }

    // Add instructions as a rule if available
    if (connectionViewMatch.instructions) {
      rules.push(connectionViewMatch.instructions);
    }

    return {
      additionalTools: connectionViewMatch.tools
        ? {
            [integrationId]: connectionViewMatch.tools,
          }
        : undefined,
      rules: rules.length > 0 ? rules : undefined,
    };
  }, [connectionViewMatch, integrationId]);

  return (
    <DecopilotProvider value={decopilotContextValue}>
      <ViewRouteProvider
        integrationId={integrationId}
        viewName={viewName}
        view={connectionViewMatch}
      >
        <ViewDetailContext.Provider
          value={{
            integrationId,
            integration,
            resolvedUrl,
            embeddedName,
            view: connectionViewMatch,
          }}
        >
          <PageLayout
            key={`${integrationId}-${viewName}`}
            hideViewsButton
            tabs={tabs}
            breadcrumb={
              <DefaultBreadcrumb
                items={[
                  {
                    label: (
                      <div className="flex items-center gap-2">
                        <Icon
                          name={connectionViewMatch?.icon || "dashboard"}
                          className="w-4 h-4"
                        />
                        <span>{connectionViewMatch?.title}</span>
                        <Link to={resolvedUrl ?? "#"} target="_blank">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                            }}
                            className="text-muted-foreground hover:text-primary-dark"
                            title="Open view"
                          >
                            <Icon name="open_in_new" className="w-4 h-4" />
                          </Button>
                        </Link>
                      </div>
                    ),
                  },
                ]}
              />
            }
            actionButtons={undefined}
          />
        </ViewDetailContext.Provider>
      </ViewRouteProvider>
    </DecopilotProvider>
  );
}

// (Internal fallback components removed to simplify the view renderer)
