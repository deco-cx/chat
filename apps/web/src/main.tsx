import "./polyfills.ts";

import {
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  UnauthorizedError,
} from "@deco/sdk";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { JSX, lazy, StrictMode, Suspense, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { EmptyState } from "./components/common/EmptyState.tsx";
import { ErrorBoundary, useError } from "./ErrorBoundary.tsx";

type LazyComp<P> = Promise<{
  default: React.ComponentType<P>;
}>;
const wrapWithUILoadingFallback = <P,>(
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
const Login = lazy(() => import("./components/login/index.tsx"));
const About = lazy(() => import("./components/about/index.tsx"));
const PageviewTracker = lazy(() =>
  import("./components/analytics/PageviewTracker.tsx").then((mod) => ({
    default: mod.PageviewTracker,
  }))
);

/**
 * Route component with Suspense + Spinner. Remove the wrapWithUILoadingFallback if
 * want custom Suspense behavior.
 */
const IntegrationDetail = lazy(() =>
  wrapWithUILoadingFallback(import("./components/integrations/detail/edit.tsx"))
);

const IntegrationList = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/list/installed.tsx"),
  )
);

const IntegrationMarketplace = lazy(() =>
  wrapWithUILoadingFallback(
    import("./components/integrations/list/marketplace.tsx"),
  )
);

const AgentList = lazy(
  () => wrapWithUILoadingFallback(import("./components/agents/list.tsx")),
);

const AgentDetail = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/edit.tsx")),
);

const Chat = lazy(
  () => wrapWithUILoadingFallback(import("./components/agent/chat.tsx")),
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
  wrapWithUILoadingFallback(import("./components/login/magicLink.tsx"))
);

const Settings = lazy(() =>
  wrapWithUILoadingFallback(import("./components/settings/page.tsx"))
);

const TriggerList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/triggers/list.tsx"))
);

const TriggerDetails = lazy(() =>
  wrapWithUILoadingFallback(import("./components/triggers/triggerDetails.tsx"))
);

const InvitesList = lazy(() =>
  wrapWithUILoadingFallback(import("./components/invites/index.tsx"))
);

const SalesDeck = lazy(() =>
  wrapWithUILoadingFallback(import("./components/sales-deck/deck.tsx"))
);

function NotFound(): null {
  throw new NotFoundError("The path was not found");
}

function ErrorFallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { state: { error }, reset } = useError();
  const isUnauthorized = error instanceof UnauthorizedError;

  useEffect(() => {
    if (!isUnauthorized) {
      return;
    }

    reset();

    if (location.pathname === "/") {
      navigate("/about", { replace: true });
      return;
    }

    const next = new URL(location.pathname, globalThis.location.origin);
    navigate(`/login?next=${next}`, { replace: true });
  }, [isUnauthorized, location.pathname, reset, navigate]);

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
            {error?.message ??
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

function Router() {
  return (
    <Routes>
      <Route path="login" element={<Login />} />
      <Route path="login/magiclink" element={<MagicLink />} />

      <Route path="about" element={<About />} />

      <Route path="invites" element={<RouteLayout />}>
        <Route index element={<InvitesList />} />
      </Route>

      <Route path="sales-deck" element={<SalesDeck />} />

      <Route
        path="chats"
        element={<PublicChats />}
      />

      <Route path="/:teamSlug?" element={<RouteLayout />}>
        <Route
          index
          element={
            <Chat
              showThreadMessages={false}
              agentId="teamAgent"
              threadId={crypto.randomUUID()}
              key="disabled-messages"
            />
          }
        />

        <Route
          path="agents"
          element={<AgentList />}
        />
        <Route
          path="agent/:id/:threadId"
          element={<AgentDetail />}
        />
        <Route
          path="chat/:id/:threadId"
          element={<Chat />}
        />
        <Route
          path="integrations/marketplace"
          element={<IntegrationMarketplace />}
        />
        <Route
          path="integrations"
          element={<IntegrationList />}
        />
        <Route
          path="integration/:id"
          element={<IntegrationDetail />}
        />
        <Route
          path="triggers"
          element={<TriggerList />}
        />
        <Route
          path="trigger/:agentId/:triggerId"
          element={<TriggerDetails />}
        />
        <Route
          path="settings"
          element={<Settings />}
        />
        <Route
          path="audits"
          element={<AuditList />}
        />
        <Route
          path="audit/:id"
          element={<AuditDetail />}
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary
        fallback={<ErrorFallback />}
        shouldCatch={(error) => {
          import("./hooks/analytics.ts").then((mod) =>
            mod.trackException(error)
          );

          return true;
        }}
      >
        <Suspense fallback={null}>
          <PageviewTracker />
        </Suspense>
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center">
              <Spinner />
            </div>
          }
        >
          <Router />
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
