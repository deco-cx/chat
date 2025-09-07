import {
  NotFoundError,
  useConnectionViews,
  useIntegrations,
  findConnectionView,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { createContext, useContext, useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import Preview from "../agent/preview";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { InternalResourceListWithIntegration } from "./internal-resource-list.tsx";
import { ViewRouteProvider } from "./view-route-context.tsx";
import { dispatchRulesUpdated } from "../../utils/events.ts";

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

  if (embeddedName && integrationId) {
    return (
      <InternalResourceListWithIntegration
        name={embeddedName}
        integrationId={integrationId}
      />
    );
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
  const isEmbeddedList = resolvedUrl?.startsWith("internal://resource/list?");
  const isEmbeddedDetail = resolvedUrl?.startsWith(
    "internal://resource/detail?",
  );

  const embeddedName = useMemo(() => {
    if (!resolvedUrl || (!isEmbeddedList && !isEmbeddedDetail))
      return undefined;
    try {
      const u = new URL(
        resolvedUrl.replace("internal://", "https://internal/"),
      );
      return u.searchParams.get("name") ?? undefined;
    } catch {
      return undefined;
    }
  }, [resolvedUrl, isEmbeddedList, isEmbeddedDetail]);

  if (!connectionViewMatch) {
    throw new NotFoundError("View not found");
  }

  const tabs = TABS;

  // Seed rules for this view when present (no effect outside view routes)
  const rules = (connectionViewMatch?.rules ?? []) as string[];
  if (rules.length) {
    // Single dispatch based on current render; upstream keeps last update
    dispatchRulesUpdated({ rules });
  }

  return (
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
  );
}

// (Internal fallback components removed to simplify the view renderer)
