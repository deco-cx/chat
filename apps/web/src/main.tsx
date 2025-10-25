import "./polyfills.ts";

import {
  ForbiddenError,
  type InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@deco/sdk";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { type JSX, lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  useLocation,
  useRouteError,
} from "react-router";
import { EmptyState } from "./components/common/empty-state.tsx";
import { useWorkspaceLink } from "./hooks/use-navigate-workspace.ts";
import { OrgsLayout } from "./components/layout/org.tsx";
import { queryClient } from "@deco/sdk";
import { createResourceWatchStore } from "./stores/resource-watch/store.ts";

const cache = queryClient.getQueryCache();
const originalOnError = cache.config.onError;

cache.config.onError = (error, query) => {
  originalOnError?.(error, query);

  // Validate query key structure for resource-watch
  if (!Array.isArray(query.queryKey) || query.queryKey.length < 2) {
    return;
  }

  if (query.queryKey[0] !== "resource-watch") {
    return;
  }

  if (typeof query.queryKey[1] !== "string") {
    return;
  }

  const resourceUri = query.queryKey[1];
  const errorMsg =
    error instanceof Error ? error.message : "Watch connection failed";
  console.error("[ResourceWatch] Connection error:", errorMsg);
  createResourceWatchStore.getState().actions.setError(resourceUri, errorMsg);
};

const DECO_ASCII_LOGO = `
..................................................
..................................................
..............................--+++-..............
..........................--+########-............
........................-######+++####-...........
.......................-####+-....-####-..........
..................-++########-.....-###+..........
...............+############-....+#+####..........
.............+#####+-----+#+....-######-..........
...........-+###+-......-#+....-####---...........
...........+###-....-+++##-...-####-..............
..........-###-....+#####-....+###-...............
..........+###....+#####-....+###+................
..........###+....#####+....+###+.................
..........+###-...-++--....+###+..................
..........-####-........-+####+...................
...........-#####+++++++####+-....................
.............-+###########+-......................
................---+++---.........................
..................................................
..................................................
`;

console.log(
  `%c${DECO_ASCII_LOGO}\n%cAI engineer? join us: %cbuilders@decocms.com`,
  "color: #9be000; font-family: 'CommitMono', monospace; font-size: 12px; line-height: 14px;",
  "font-size: 14px; font-weight: 600;",
  "font-size: 14px; font-weight: 600; text-decoration: underline; color: #9be000;",
);

// Request notification permission for task completion alerts
if ("Notification" in window && Notification.permission === "default") {
  Notification.requestPermission();
}

type LazyComp<P> = Promise<{
  default: React.ComponentType<P>;
}>;
export const wrapWithUILoadingFallback = <P,>(
  lazyComp: LazyComp<P>,
): LazyComp<P> =>
  lazyComp.then(({ default: Comp }) => ({
    default: (p: P) => (
      <Suspense
        fallback={
          <div className="h-[calc(100vh-48px)] w-full grid place-items-center">
            <Spinner />
          </div>
        }
      >
        <Comp {...(p as JSX.IntrinsicAttributes & P)} />
      </Suspense>
    ),
  }));

const ProjectLayout = lazy(() =>
  import("./components/layout/project.tsx").then((mod) => ({
    default: mod.ProjectLayout,
  })),
);

const HomeLayout = lazy(() =>
  import("./components/layout/home.tsx").then((mod) => ({
    default: mod.HomeLayout,
  })),
);

const OrgList = lazy(() =>
  import("./components/home/organizations.tsx").then((mod) => ({
    default: mod.OrgList,
  })),
);

const OrgProjectList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/home/projects.tsx")),
);

const ProjectHome = lazy(() =>
  import("./components/home/project-home.tsx").then((mod) => ({
    default: mod.ProjectHome,
  })),
);

const PageviewTrackerLayout = lazy(
  () => import("./components/analytics/pageview-tracker.tsx"),
);

const Login = lazy(() => import("./components/login/index.tsx"));

/**
 * Route component with Suspense + Spinner. Remove the wrapWithUILoadingFallback if
 * want custom Suspense behavior.
 */
const AppDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/integrations/app-detail.tsx")),
);

const InstalledAppsList = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/installed-apps.tsx"),
  ),
);

const AppInstallSuccess = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/install-success.tsx"),
  ),
);

const AgentsListPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/agents/list-page.tsx")),
);

const AgentsThreadsPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/agents/threads-page.tsx")),
);

const AgentDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/agent/edit.tsx")),
);

const PublicChats = lazy(() =>
  wrapWithUILoadingFallback(import("./components/agent/chats.tsx")),
);

const AuditDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/audit/detail.tsx")),
);

const MagicLink = lazy(() =>
  wrapWithUILoadingFallback(import("./components/login/magic-link.tsx")),
);

const MagicLinkCallback = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/login/magic-link-callback.tsx"),
  ),
);

const Members = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/members/index.tsx")),
);

const OrgSettings = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/general.tsx")),
);

const Models = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/models.tsx")),
);

const Billing = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/billing.tsx")),
);

const Usage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/usage/usage.tsx")),
);

const TriggerDetails = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/triggers/trigger-details.tsx"),
  ),
);

const InvitesList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/invites/index.tsx")),
);

const InviteDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/invites/detail.tsx")),
);

const SalesDeck = lazy(() =>
  wrapWithUILoadingFallback(import("./components/sales-deck/deck.tsx")),
);

const DocumentsListPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/documents/list-page.tsx")),
);

const PromptsLegacyPage = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/documents/prompts-legacy-page.tsx"),
  ),
);

const DocumentEdit = lazy(() =>
  wrapWithUILoadingFallback(import("./components/prompts/detail/detail.tsx")),
);

const WorkflowsRunsPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/workflows/runs-v2-page.tsx")),
);
const WorkflowsRunsLegacyPage = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/workflows/runs-legacy-page.tsx"),
  ),
);
const WorkflowDetailPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/workflows/detail.tsx")),
);

const AppAuth = lazy(() =>
  wrapWithUILoadingFallback(import("./components/apps/auth.tsx")),
);

const ViewDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/views/detail.tsx")),
);

const LegacyViewRedirect = lazy(() =>
  wrapWithUILoadingFallback(import("./components/views/legacy-redirect.tsx")),
);

const ViewsListPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/views/list-page.tsx")),
);

const ViewsLegacyPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/views/legacy-list-page.tsx")),
);

const Store = lazy(() =>
  wrapWithUILoadingFallback(import("./components/discover/index.tsx")),
);

// Resources v2 routes
const ResourcesV2List = lazy(() =>
  wrapWithUILoadingFallback(import("./components/resources-v2/list.tsx")),
);

// Detail component has its own loading state, no additional Suspense needed
const ResourcesV2Detail = lazy(
  () => import("./components/resources-v2/detail.tsx"),
);

// Workflows resource list
const WorkflowsListPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/workflows/list-page.tsx")),
);

const WorkflowsTriggersPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/workflows/triggers-page.tsx")),
);

// Tools resource list
const ToolsResourceList = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/tools/tools-resource-list.tsx"),
  ),
);

function NotFound(): null {
  throw new NotFoundError("The path was not found");
}

function ErrorFallback() {
  const { pathname, search } = useLocation();
  const error = useRouteError();
  const isUnauthorized = error instanceof UnauthorizedError;
  const workspaceLink = useWorkspaceLink();

  useEffect(() => {
    import("./hooks/analytics.ts").then((mod) => mod.trackException(error));
  }, []);

  useEffect(() => {
    if (!isUnauthorized) {
      return;
    }

    const next = new URL(`${pathname}${search}`, globalThis.location.origin);
    globalThis.location.href = `/login?next=${encodeURIComponent(
      next.toString(),
    )}`;
  }, [isUnauthorized, pathname, search]);

  if (isUnauthorized) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (error instanceof ForbiddenError) {
    return (
      <EmptyState
        icon="report"
        title="Access Denied"
        description={
          <>
            <div>
              {error?.message ?? "User does not have access to this resource"}
            </div>
            <div className="text-xs">{error?.traceId}</div>
          </>
        }
        buttonProps={{
          onClick: () => (globalThis.location.href = "/"),
          children: "Go back to home",
        }}
      />
    );
  }

  if (error instanceof NotFoundError) {
    return (
      <EmptyState
        icon="report"
        title="Not Found"
        description={
          <>
            <div>
              {error?.message ??
                "The resource you are looking for does not exist"}
            </div>
            <div className="text-xs">{error?.traceId}</div>
          </>
        }
        buttonProps={{
          onClick: () => (globalThis.location.href = workspaceLink("/")),
          children: "Go back to home",
        }}
      />
    );
  }

  return (
    <EmptyState
      icon="report"
      title="Something went wrong"
      description={
        <>
          <div>
            {(error as Error)?.message ??
              "Looks like we are facing some technical issues. Please try again."}
          </div>
          <div className="text-xs">
            {(error as InternalServerError)?.traceId}
          </div>
        </>
      }
      buttonProps={{
        onClick: () => globalThis.location.reload(),
        children: "Retry",
      }}
    />
  );
}

const router = createBrowserRouter([
  {
    errorElement: <ErrorFallback />,
    Component: PageviewTrackerLayout,
    children: [
      {
        path: "/",
        Component: HomeLayout,
        children: [{ index: true, Component: OrgList }],
      },
      {
        path: "/:org",
        Component: OrgsLayout,
        children: [
          {
            index: true,
            Component: OrgProjectList,
          },
          {
            path: "members",
            Component: Members,
          },
          {
            path: "billing",
            Component: Billing,
          },
          {
            path: "models",
            Component: Models,
          },
          {
            path: "usage",
            Component: Usage,
          },
          {
            path: "settings",
            Component: OrgSettings,
          },
          {
            path: "theme-editor",
            lazy: () =>
              import(
                "./components/theme-editor/theme-editor-resource-list.tsx"
              ).then((m) => ({ Component: m.ThemeEditorResourceList })),
          },
        ],
      },
      {
        path: "/invites",
        Component: HomeLayout,
        children: [
          { index: true, Component: InvitesList },
          { path: ":id", Component: InviteDetail },
        ],
      },
      {
        path: "/login",
        Component: Login,
      },
      {
        path: "/login/magiclink",
        Component: MagicLink,
      },
      {
        path: "/login/magiclink/callback",
        Component: MagicLinkCallback,
      },
      {
        path: "/sales-deck",
        Component: SalesDeck,
      },
      {
        path: "/chats",
        Component: PublicChats,
      },
      {
        path: "/apps-auth",
        Component: AppAuth,
      },
      {
        path: "/:org/:project",
        Component: ProjectLayout,
        children: [
          { index: true, Component: ProjectHome },
          { path: "store", Component: Store },
          {
            path: "discover",
            Component: () => <Navigate to="../store" replace />,
          },
          { path: "tools", Component: ToolsResourceList },
          { path: "agents", Component: AgentsListPage },
          { path: "agents/threads", Component: AgentsThreadsPage },
          { path: "agent/:id/:threadId", Component: AgentDetail },
          { path: "apps", Component: InstalledAppsList },
          { path: "apps/:appKey", Component: AppDetail },
          { path: "apps/success", Component: AppInstallSuccess },
          {
            path: "triggers",
            Component: () => <Navigate to="../workflows/triggers" replace />,
          },
          { path: "trigger/:id", Component: TriggerDetails },
          {
            path: "database",
            Component: lazy(() => import("./components/database/studio.tsx")),
          },
          { path: "views", Component: ViewsListPage },
          { path: "views/legacy", Component: ViewsLegacyPage },
          { path: "views/:integrationId/:viewName", Component: ViewDetail },
          { path: "views/:id", Component: LegacyViewRedirect },
          { path: "documents", Component: DocumentsListPage },
          { path: "documents/prompts", Component: PromptsLegacyPage },
          { path: "documents/:id", Component: DocumentEdit },
          {
            path: "theme-editor",
            lazy: () =>
              import(
                "./components/theme-editor/theme-editor-resource-list.tsx"
              ).then((m) => ({ Component: m.ThemeEditorResourceList })),
          },
          {
            path: "workflow-runs",
            Component: () => <Navigate to="../workflows/runs-legacy" replace />,
          },
          {
            path: "workflow-runs/:workflowName/instances/:instanceId",
            Component: WorkflowDetailPage,
          },
          { path: "workflows", Component: WorkflowsListPage },
          { path: "workflows/runs", Component: WorkflowsRunsPage },
          { path: "workflows/runs-legacy", Component: WorkflowsRunsLegacyPage },
          {
            path: "workflows/runs/:workflowName/instances/:instanceId",
            Component: WorkflowDetailPage,
          },
          { path: "workflows/triggers", Component: WorkflowsTriggersPage },
          {
            path: "activity",
            Component: () => <Navigate to="../agents/threads" replace />,
          },
          { path: "audit/:id", Component: AuditDetail },
          // Resources v2 list/detail routes
          {
            path: "rsc/:integrationId/:resourceName",
            Component: ResourcesV2List,
          },
          {
            path: "rsc/:integrationId/:resourceName/:resourceUri",
            Component: ResourcesV2Detail,
          },
        ],
      },
      { path: "*", Component: NotFound },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
