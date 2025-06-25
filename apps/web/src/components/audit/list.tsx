import type { ThreadFilterOptions } from "@deco/sdk";
import { useAgents, useAuditEvents, useTeamMembers, useTeams } from "@deco/sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@deco/ui/components/pagination.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { AuditFilters } from "./audit-filters.tsx";
import { AuditTable } from "./audit-table.tsx";

const CURSOR_PAGINATION_SEARCH_PARAM = "after";

type AuditOrderBy =
  | "createdAt_desc"
  | "createdAt_asc"
  | "updatedAt_desc"
  | "updatedAt_asc";

const SORT_OPTIONS: { value: AuditOrderBy; label: string }[] = [
  { value: "createdAt_desc", label: "Newest" },
  { value: "createdAt_asc", label: "Oldest" },
  { value: "updatedAt_desc", label: "Recently Updated" },
  { value: "updatedAt_asc", label: "Least Recently Updated" },
];

const limit = 11;

function AuditListErrorFallback() {
  return (
    <Alert variant="destructive" className="my-8">
      <AlertTitle>Error loading audit events</AlertTitle>
      <AlertDescription>
        Something went wrong while loading the audit events.
      </AlertDescription>
    </Alert>
  );
}

interface AuditListContentProps {
  showFilters?: boolean;
  columnsDenyList?: Set<string>;
  filters?: Partial<ThreadFilterOptions>;
}

export function AuditListContent({
  showFilters = true,
  columnsDenyList,
  filters,
}: AuditListContentProps) {
  const navigate = useNavigateWorkspace();

  // Fetch agents for filter dropdown
  const { data: agents = [] } = useAgents();

  // Get teamId from teams and params
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get filter state from URL params, with fallbacks
  const selectedAgent = searchParams.get("agent") || undefined;
  const selectedUser = searchParams.get("user") || undefined;
  const sort = (searchParams.get("sort") as AuditOrderBy) || SORT_OPTIONS[0].value;
  const getSafeCursor = (cursor: string | null) => {
    if (!cursor) return;
    try {
      new Date(cursor);
      return cursor;
    } catch {
      return;
    }
  };
  const currentCursor =
    getSafeCursor(searchParams.get(CURSOR_PAGINATION_SEARCH_PARAM)) ??
      undefined;
  const { data: teams } = useTeams();
  const resolvedTeamSlug = params.teamSlug;
  const teamId = teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null;
  const members = teamId !== null ? useTeamMembers(teamId).data.members : [];

  const { data: auditData, isLoading } = useAuditEvents({
    agentId: filters?.agentId ?? selectedAgent,
    resourceId: filters?.resourceId ?? selectedUser,
    orderBy: filters?.orderBy ?? sort,
    cursor: filters?.cursor ?? currentCursor,
    limit: filters?.limit ?? limit,
  });

  // Pagination logic
  const threads = auditData?.threads ?? [];
  const pagination = auditData?.pagination;

  // Handlers
  function handleAgentChange(value: string) {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete("agent");
    } else {
      newParams.set("agent", value);
    }
    newParams.delete(CURSOR_PAGINATION_SEARCH_PARAM);
    setSearchParams(newParams);
  }
  function handleUserChange(value: string) {
    const newParams = new URLSearchParams(searchParams);
    if (value === "all") {
      newParams.delete("user");
    } else {
      newParams.set("user", value);
    }
    newParams.delete(CURSOR_PAGINATION_SEARCH_PARAM);
    setSearchParams(newParams);
  }
  function handleSortChange(newSort: string) {
    const newParams = new URLSearchParams(searchParams);
    newParams.set("sort", newSort);
    newParams.delete(CURSOR_PAGINATION_SEARCH_PARAM);
    setSearchParams(newParams);
  }
  function handleNextPage() {
    if (pagination?.hasMore && pagination?.nextCursor) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set(CURSOR_PAGINATION_SEARCH_PARAM, pagination.nextCursor);
      setSearchParams(newParams);
    }
  }
  function handlePrevPage() {
    if (pagination?.prevCursor) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set(CURSOR_PAGINATION_SEARCH_PARAM, pagination.prevCursor);
      setSearchParams(newParams);
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full">
      {showFilters && (
        <AuditFilters
          agents={agents}
          members={members}
          selectedAgent={selectedAgent}
          selectedUser={selectedUser}
          onAgentChange={handleAgentChange}
          onUserChange={handleUserChange}
        />
      )}
      {/* Empty state */}
      {!threads.length
        ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <span className="text-lg font-medium">No audit events found</span>
          </div>
        )
        : (
          <>
            <AuditTable
              threads={threads}
              sort={sort}
              columnsDenyList={columnsDenyList}
              onSortChange={handleSortChange}
            />
            {/* Pagination */}
            <div className="flex justify-center mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        handlePrevPage();
                      }}
                      aria-disabled={!pagination?.hasPrev}
                      tabIndex={!pagination?.hasPrev ? -1 : 0}
                      className={!pagination?.hasPrev
                        ? "opacity-50 pointer-events-none"
                        : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (pagination?.hasMore) handleNextPage();
                      }}
                      aria-disabled={!pagination?.hasMore}
                      tabIndex={!pagination?.hasMore ? -1 : 0}
                      className={!pagination?.hasMore
                        ? "opacity-50 pointer-events-none"
                        : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          </>
        )}
    </div>
  );
}

function AuditList() {
  return (
    <div className="h-full text-foreground px-6 py-6 w-full">
      <ErrorBoundary fallback={<AuditListErrorFallback />}>
        <Suspense
          fallback={
            <div className="flex justify-center items-center h-64">
              <Spinner />
            </div>
          }
        >
          <AuditListContent />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}

const TABS: Record<string, Tab> = {
  main: {
    title: "Activity",
    Component: AuditList,
    initialOpen: true,
  },
};

function Page() {
  return (
    <PageLayout
      hideViewsButton
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Activity", link: "/audits" }]} />
      }
    />
  );
}

export default Page;
