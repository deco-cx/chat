import { Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "@deco/ui/components/sonner.tsx";
import {
  type Invite,
  useAcceptInvite,
  useInvites,
  useRejectInvite,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { timeAgo } from "../../utils/time-ago.ts";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";

function InviteCard({
  invite,
  onAccept,
  onReject,
  isAcceptLoading,
  isRejectLoading,
  isAnyLoading,
}: {
  invite: Invite;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  isAcceptLoading: boolean;
  isRejectLoading: boolean;
  isAnyLoading: boolean;
}) {
  return (
    <Card className="overflow-hidden border rounded-xl hover:shadow-md transition-shadow">
      <CardContent className="p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              {invite.teamName}
            </h3>
            <div className="flex gap-1 flex-wrap">
              {invite.roles.map((role) => (
                <Badge key={role.id} variant="outline" className="text-xs">
                  {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="relative w-6 h-6 rounded-full overflow-hidden bg-muted">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                invite.inviter.name || invite.inviter.email || "Unknown",
              )}`}
              alt="Inviter avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <span>
            Invited by{" "}
            {invite.inviter.name || invite.inviter.email || "Unknown"}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {timeAgo(invite.createdAt)}
          </span>

          <div className="flex gap-2">
            <Button
              onClick={() => onAccept(invite.id)}
              disabled={isAnyLoading}
              size="sm"
              className="h-8"
            >
              {isAcceptLoading ? (
                <Spinner size="xs" />
              ) : (
                <Icon name="check" className="mr-1" size={14} />
              )}
              Accept
            </Button>
            <Button
              onClick={() => onReject(invite.id)}
              disabled={isAnyLoading}
              variant="outline"
              size="sm"
              className="h-8"
            >
              {isRejectLoading ? (
                <Spinner size="xs" />
              ) : (
                <Icon name="close" className="mr-1" size={14} />
              )}
              Reject
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InvitesListSkeleton() {
  return (
    <div className="flex flex-col gap-4 h-full p-4">
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Card key={index} className="overflow-hidden border rounded-xl">
            <CardContent className="p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-2 flex-1">
                  <div className="h-6 bg-muted rounded animate-pulse w-3/4"></div>
                  <div className="flex gap-1">
                    <div className="h-5 bg-muted rounded animate-pulse w-16"></div>
                    <div className="h-5 bg-muted rounded animate-pulse w-20"></div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-muted rounded-full animate-pulse"></div>
                <div className="h-4 bg-muted rounded animate-pulse w-32"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded animate-pulse w-20"></div>
                <div className="flex gap-2">
                  <div className="h-8 bg-muted rounded animate-pulse w-16"></div>
                  <div className="h-8 bg-muted rounded animate-pulse w-16"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function InvitesListEmpty() {
  return (
    <div className="flex flex-col gap-4 h-full p-4">
      <ListPageHeader
        input={{
          placeholder: "Search invitations",
          value: "",
          onChange: () => {},
          disabled: true,
        }}
      />
      <div className="flex-1 min-h-0 flex items-center justify-center">
        <EmptyState
          icon="mail"
          title="No Invitations"
          description="You don't have any pending team invitations."
        />
      </div>
    </div>
  );
}

function InvitesListContent() {
  const { data: invites = [] } = useInvites();
  const acceptInviteMutation = useAcceptInvite();
  const rejectInviteMutation = useRejectInvite();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string>("teamName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [loadingStates, setLoadingStates] = useState<
    Record<string, "accept" | "reject" | null>
  >({});
  const [viewMode, setViewMode] = useViewMode("invites");

  const filteredInvites =
    search.trim().length > 0
      ? invites.filter(
          (invite) =>
            invite.teamName.toLowerCase().includes(search.toLowerCase()) ||
            (invite.inviter.name &&
              invite.inviter.name
                .toLowerCase()
                .includes(search.toLowerCase())) ||
            (invite.inviter.email &&
              invite.inviter.email
                .toLowerCase()
                .includes(search.toLowerCase())),
        )
      : invites;

  if (!invites.length) {
    return <InvitesListEmpty />;
  }

  const handleAccept = async (inviteId: string) => {
    setLoadingStates((prev) => ({ ...prev, [inviteId]: "accept" }));
    try {
      const result = await acceptInviteMutation.mutateAsync(inviteId);

      if (!result.teamId) {
        toast.error("Failed to get team information");
        navigate("/");
        return;
      }

      const teamSlug = result.teamSlug;

      if (teamSlug) {
        navigate(`/${teamSlug}/agents`);
      } else {
        navigate("/");
      }
    } catch (error) {
      console.error("Accept invitation error:", error);
      toast.error("Failed to accept invitation");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  const handleReject = async (inviteId: string) => {
    setLoadingStates((prev) => ({ ...prev, [inviteId]: "reject" }));
    try {
      await rejectInviteMutation.mutateAsync({ id: inviteId });
      toast.success("Invitation rejected");
    } catch (error) {
      console.error("Reject invitation error:", error);
      toast.error("Failed to reject invitation");
    } finally {
      setLoadingStates((prev) => ({ ...prev, [inviteId]: null }));
    }
  };

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  function getSortValue(invite: Invite, key: string): string {
    switch (key) {
      case "teamName":
        return invite.teamName.toLowerCase();
      case "inviter":
        return (
          invite.inviter.name ||
          invite.inviter.email ||
          ""
        ).toLowerCase();
      case "createdAt":
        return invite.createdAt;
      default:
        return "";
    }
  }

  const sortedInvites = [...filteredInvites].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return (
    <div className="flex flex-col gap-4 h-full p-4">
      <ListPageHeader
        input={{
          placeholder: "Search invitations",
          value: search,
          onChange: (e) => setSearch(e.target.value),
        }}
        view={{
          viewMode,
          onChange: setViewMode,
        }}
      />

      <div className="flex-1 min-h-0 overflow-x-auto">
        {viewMode === "table" ? (
          <TableView
            invites={sortedInvites}
            onAccept={handleAccept}
            onReject={handleReject}
            loadingStates={loadingStates}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        ) : (
          <CardsView
            invites={sortedInvites}
            onAccept={handleAccept}
            onReject={handleReject}
            loadingStates={loadingStates}
          />
        )}
      </div>
    </div>
  );
}

function TableView({
  invites,
  onAccept,
  onReject,
  loadingStates,
  sortKey,
  sortDirection,
  onSort,
}: {
  invites: Invite[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  loadingStates: Record<string, "accept" | "reject" | null>;
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSort: (key: string) => void;
}) {
  const columns: TableColumn<Invite>[] = [
    {
      id: "teamName",
      header: "Team",
      render: (invite) => (
        <span className="font-medium">{invite.teamName}</span>
      ),
      sortable: true,
    },
    {
      id: "inviter",
      header: "Invited By",
      render: (invite) => (
        <span>{invite.inviter.name || invite.inviter.email || "Unknown"}</span>
      ),
      sortable: true,
    },
    {
      id: "roles",
      header: "Role",
      render: (invite) => (
        <div className="flex gap-1 flex-wrap">
          {invite.roles.map((role) => (
            <Badge key={role.id} variant="outline" className="text-xs">
              {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Invited",
      render: (invite) => (
        <span className="text-sm text-muted-foreground">
          {timeAgo(invite.createdAt)}
        </span>
      ),
      sortable: true,
    },
    {
      id: "actions",
      header: "",
      render: (invite) => {
        const loading = loadingStates[invite.id];
        const isAcceptLoading = loading === "accept";
        const isRejectLoading = loading === "reject";
        const isAnyLoading = isAcceptLoading || isRejectLoading;

        return (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button
              onClick={() => onAccept(invite.id)}
              disabled={isAnyLoading}
              size="sm"
              className="h-8"
            >
              {isAcceptLoading ? (
                <Spinner size="xs" />
              ) : (
                <Icon name="check" className="mr-1" size={14} />
              )}
              Accept
            </Button>
            <Button
              onClick={() => onReject(invite.id)}
              disabled={isAnyLoading}
              variant="outline"
              size="sm"
              className="h-8"
            >
              {isRejectLoading ? (
                <Spinner size="xs" />
              ) : (
                <Icon name="close" className="mr-1" size={14} />
              )}
              Reject
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <Table
      columns={columns}
      data={invites}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={onSort}
    />
  );
}

function CardsView({
  invites,
  onAccept,
  onReject,
  loadingStates,
}: {
  invites: Invite[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  loadingStates: Record<string, "accept" | "reject" | null>;
}) {
  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {invites.map((invite) => {
        const loading = loadingStates[invite.id];
        const isAcceptLoading = loading === "accept";
        const isRejectLoading = loading === "reject";
        const isAnyLoading = isAcceptLoading || isRejectLoading;

        return (
          <InviteCard
            key={invite.id}
            invite={invite}
            onAccept={onAccept}
            onReject={onReject}
            isAcceptLoading={isAcceptLoading}
            isRejectLoading={isRejectLoading}
            isAnyLoading={isAnyLoading}
          />
        );
      })}
    </div>
  );
}

function InvitesListWrapper() {
  return (
    <Suspense fallback={<InvitesListSkeleton />}>
      <InvitesListContent />
    </Suspense>
  );
}

const TABS = {
  list: {
    Component: InvitesListWrapper,
    title: "Team Invitations",
    initialOpen: true,
  },
};

export default function InvitesList() {
  return (
    <PageLayout
      hideViewsButton
      tabs={TABS}
      breadcrumb={
        <DefaultBreadcrumb
          items={[{ label: "Team Invitations", link: "/invites" }]}
        />
      }
    />
  );
}
