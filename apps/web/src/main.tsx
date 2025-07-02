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
  Navigate,
  RouterProvider,
  useLocation,
  useRouteError,
} from "react-router";
import { EmptyState } from "./components/common/empty-state.tsx";
import { useWorkspaceLink } from "./hooks/use-navigate-workspace.ts";

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
          <div className="h-full w-full flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <Comp {...p as JSX.IntrinsicAttributes & P} />
      </Suspense>
    ),
  }));

const RouteLayout = lazy(() =>
  import("./components/layout.tsx").then((mod) => ({
    default: mod.RouteLayout,
  }))
);

const PageviewTrackerLayout = lazy(
  () => import("./components/analytics/pageview-tracker.tsx"),
);

const Login = lazy(() => import("./components/login/index.tsx"));

/**
 * Route component with Suspense + Spinner. Remove the wrapWithUILoadingFallback if
 * want custom Suspense behavior.
 */
const ConnectionDetail = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/connection-detail.tsx"),
  )
);

const ConnectionsList = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/connections-list.tsx"),
  )
);

const ConnectionInstallSuccess = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/install-success.tsx"),
  )
);

const AgentList = lazy(
  () => wrapWithUILoadingFallback(import("./components/agents/list.tsx")),
);

const AgentDetail = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/edit.tsx")),
);

const PublicChats = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/chats.tsx")),
);

const AuditList = lazy(
  () => wrapWithUILoadingFallback(import("./components/audit/list.tsx")),
);

const AuditDetail = lazy(
  () => wrapWithUILoadingFallback(import("./components/audit/detail.tsx")),
);

const MagicLink = lazy(() =>
  wrapWithUILoadingFallback(import("./components/login/magic-link.tsx"))
);

const Settings = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/page.tsx"))
);

const TriggerList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/triggers/list.tsx"))
);

const TriggerDetails = lazy(() =>
  wrapWithUILoadingFallback(import("./components/triggers/trigger-details.tsx"))
);

const InvitesList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/invites/index.tsx"))
);

const SalesDeck = lazy(() =>
  wrapWithUILoadingFallback(import("./components/sales-deck/deck.tsx"))
);

const ListPrompts = lazy(() =>
  wrapWithUILoadingFallback(import("./components/prompts/list/list.tsx"))
);

const PromptDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/prompts/detail/detail.tsx"))
);

const WorkflowListPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/workflows/list.tsx"))
);

const WorkflowDetailPage = lazy(() =>
  wrapWithUILoadingFallback(import("./components/workflows/detail.tsx"))
);

const WorkflowInstanceDetailPage = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/workflows/instance-detail.tsx"),
  )
);

function NotFound(): null {
  throw new NotFoundError("The path was not found");
}

const DEFAULT_PATH = "/agents";

/**
 * Home component that redirects to the default path while preserving team workspace context.
 * This replaces the previous loader-based approach to avoid double redirects while maintaining
 * proper team slug handling.
 */
function Home() {
  const workspaceLink = useWorkspaceLink();
  return <Navigate to={workspaceLink(DEFAULT_PATH)} replace />;
}

function ErrorFallback() {
  const { pathname } = useLocation();
  const error = useRouteError();
  const isUnauthorized = error instanceof UnauthorizedError;

  useEffect(() => {
    import("./hooks/analytics.ts").then((mod) => mod.trackException(error));
  }, []);

  useEffect(() => {
    if (!isUnauthorized) {
      return;
    }

    if (pathname === "/") {
      globalThis.location.href = "/about";
      return;
    }

    const next = new URL(pathname, globalThis.location.origin);
    globalThis.location.href = `/login?next=${next}`;
  }, [isUnauthorized, pathname]);

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
              {error?.message ??
                "User does not have access to this resource"}
            </div>
            <div className="text-xs">
              {error?.traceId}
            </div>
          </>
        }
        buttonProps={{
          onClick: () => globalThis.location.href = "/",
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
            <div className="text-xs">
              {error?.traceId}
            </div>
          </>
        }
        buttonProps={{
          onClick: () => globalThis.location.href = "/",
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
        path: "/login",
        Component: Login,
      },
      {
        path: "/login/magiclink",
        Component: MagicLink,
      },
      {
        path: "/invites",
        Component: RouteLayout,
        children: [
          { index: true, Component: InvitesList },
        ],
      },
      {
        path: "/sales-deck",
        Component: SalesDeck,
      },
      {
        path: "/terms-of-use",
      },
      {
        path: "/privacy-policy",
      },
      {
        path: "/chats",
        Component: PublicChats,
      },
      {
        path: "/:teamSlug?",
        Component: RouteLayout,
        children: [
          {
            index: true,
            Component: Home,
          },
          { path: "agents", Component: AgentList },
          { path: "agent/:id/:threadId", Component: AgentDetail },
          { path: "connections", Component: ConnectionsList },
          { path: "connection/:appKey", Component: ConnectionDetail },
          { path: "connections/success", Component: ConnectionInstallSuccess },
          { path: "triggers", Component: TriggerList },
          { path: "trigger/:agentId/:triggerId", Component: TriggerDetails },
          { path: "settings", Component: Settings },
          { path: "audits", Component: AuditList },
          { path: "audit/:id", Component: AuditDetail },
          { path: "prompts", Component: ListPrompts },
          { path: "prompt/:id", Component: PromptDetail },
          { path: "workflows", Component: WorkflowListPage },
          { path: "workflows/:workflowName", Component: WorkflowDetailPage },
          {
            path: "workflows/:workflowName/instances/:instanceId",
            Component: WorkflowInstanceDetailPage,
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
