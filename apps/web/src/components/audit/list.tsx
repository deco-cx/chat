import type { Options } from "@deco/sdk";
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
import { useParams } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useNavigateWorkspace } from "../../hooks/useNavigateWorkspace.ts";
import { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { AuditFilters } from "./AuditFilters.tsx";
import { AuditTable } from "./AuditTable.tsx";

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
  options?: Partial<Options>;
}

export function AuditListContent(
  { showFilters = true, options: optionsProp }: AuditListContentProps,
) {
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(
    undefined,
  );
  const [selectedUser, setSelectedUser] = useState<string | undefined>(
    undefined,
  );
  const [sort, setSort] = useState<AuditOrderBy>(SORT_OPTIONS[0].value);
  // Cursor-based pagination state
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(
    undefined,
  );
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const navigate = useNavigateWorkspace();

  // Fetch agents for filter dropdown
  const { data: agents = [] } = useAgents();

  // Get teamId from teams and params
  const params = useParams();
  const { data: teams } = useTeams();
  const resolvedTeamSlug = params.teamSlug;
  const teamId = teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null;
  const members = teamId !== null ? useTeamMembers(teamId).data.members : [];

  const { data: auditData } = useAuditEvents({
    agentId: optionsProp?.agentId ?? selectedAgent,
    resourceId: optionsProp?.resourceId ?? selectedUser,
    orderBy: optionsProp?.orderBy ?? sort,
    cursor: optionsProp?.cursor ?? currentCursor,
    limit: optionsProp?.limit ?? limit,
  });

  // Pagination logic
  const threads = auditData?.threads ?? [];
  const pagination = auditData?.pagination;

  // Handlers
  function handleAgentChange(value: string) {
    setSelectedAgent(value === "all" ? undefined : value);
    setCurrentCursor(undefined);
    setPrevCursors([]);
  }
  function handleUserChange(value: string) {
    setSelectedUser(value === "all" ? undefined : value);
    setCurrentCursor(undefined);
    setPrevCursors([]);
  }
  function handleSortChange(newSort: string) {
    setSort(newSort as AuditOrderBy);
    setCurrentCursor(undefined);
    setPrevCursors([]);
  }
  function handleNextPage() {
    if (pagination?.hasMore && pagination?.nextCursor) {
      setPrevCursors((prev) => [...prev, currentCursor ?? ""]);
      setCurrentCursor(pagination.nextCursor);
    }
  }
  function handlePrevPage() {
    if (prevCursors.length > 0) {
      const newPrevCursors = [...prevCursors];
      const prevCursor = newPrevCursors.pop();
      setPrevCursors(newPrevCursors);
      setCurrentCursor(
        prevCursor && prevCursor.length > 0 ? prevCursor : undefined,
      );
    }
  }

  return (
    <div className="flex flex-col gap-4 overflow-x-auto w-full">
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
              onSortChange={handleSortChange}
              onRowClick={(threadId) => navigate(`/audit/${threadId}`)}
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
                        if (prevCursors.length > 0) handlePrevPage();
                      }}
                      aria-disabled={prevCursors.length === 0}
                      tabIndex={prevCursors.length === 0 ? -1 : 0}
                      className={prevCursors.length === 0
                        ? "opacity-50 pointer-events-none"
                        : ""}
                    />
                  </PaginationItem>
                  <PaginationItem>
                    <span className="px-3 py-1 text-sm text-muted-foreground select-none">
                      Page {prevCursors.length + 1}
                    </span>
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
    <div className="h-full text-slate-700 px-6 py-6 overflow-x-auto w-full">
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
    title: "Chat Logs",
    Component: AuditList,
    initialOpen: true,
  },
};

function Page() {
  return (
    <PageLayout
      displayViewsTrigger={false}
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb items={[{ label: "Chat logs", link: "/audits" }]} />
      }
    />
  );
}

export default Page;
