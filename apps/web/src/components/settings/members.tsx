import {
  type Member,
  useRejectInvite,
  useRemoveTeamMember,
  useTeam,
  useTeamMembers,
  useTeamRoles,
  useUpdateMemberRole,
} from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { Suspense, useDeferredValue, useMemo, useState } from "react";
import { useUser } from "../../hooks/use-user.ts";
import { UserAvatar } from "../common/avatar/user.tsx";
import { InviteTeamMembersDialog } from "../common/invite-team-members-dialog.tsx";
import { RolesDropdown } from "../common/roles-dropdown.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { ActivityStatusCell, UserInfo } from "../common/table/table-cells.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";

function MemberTableHeader({
  onChange,
  disabled,
  teamId,
}: {
  disabled?: boolean;
  onChange: (value: string) => void;
  teamId?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <Input
        placeholder="Search"
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-80"
        disabled={disabled}
      />
      <InviteTeamMembersDialog
        teamId={teamId}
        trigger={
          <Button>
            <Icon name="add" />
            Invite Members
          </Button>
        }
      />
    </div>
  );
}

function MembersViewLoading() {
  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <MemberTableHeader disabled onChange={() => {}} teamId={undefined} />
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading members...</span>
      </div>
    </div>
  );
}

const getMemberName = (member: Member) =>
  member.profiles.metadata.full_name || member.profiles.email;

// Add type for combined member/invite data
type MemberTableRow = {
  type: "member" | "invite";
  id: string | number;
  name: string;
  email: string;
  roles: Array<{ id: number; name: string }>;
  lastActivity?: string | null;
  avatarUrl?: string;
  isPending?: boolean;
  userId?: string; // For actual members, undefined for pending invites
  member?: Member;
  invite?: {
    id: string | number;
    email: string;
    roles: Array<{ id: number; name: string }>;
  };
};

function MembersViewContent() {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const {
    data: { members, invites },
  } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const removeMemberMutation = useRemoveTeamMember();
  const rejectInvite = useRejectInvite();
  const updateRoleMutation = useUpdateMemberRole();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const deferredQuery = useDeferredValue(query);
  const isMobile = useIsMobile();
  const user = useUser();

  // Convert members and invites to unified data structure
  const tableData: MemberTableRow[] = useMemo(() => {
    const memberRows: MemberTableRow[] = members.map((member) => ({
      type: "member" as const,
      id: member.id,
      name: getMemberName(member),
      email: member.profiles.email,
      roles: member.roles,
      lastActivity: member.lastActivity,
      avatarUrl: member.profiles.metadata.avatar_url,
      userId: member.user_id, // Add userId for UserInfo component
      member,
    }));

    const inviteRows: MemberTableRow[] = invites.map((invite) => ({
      type: "invite" as const,
      id: invite.id,
      name: invite.email,
      email: invite.email,
      roles: invite.roles,
      isPending: true,
      // No userId for invites since they haven't accepted yet
      invite,
    }));

    return [...inviteRows, ...memberRows];
  }, [members, invites]);

  // Filter data based on search query
  const filteredData = useMemo(() => {
    if (!deferredQuery) return tableData;
    return tableData.filter(
      (row) =>
        row.name.toLowerCase().includes(deferredQuery.toLowerCase()) ||
        row.email.toLowerCase().includes(deferredQuery.toLowerCase()),
    );
  }, [tableData, deferredQuery]);

  // Remove member
  const handleRemoveMember = async (memberId: number) => {
    if (!teamId) return;
    try {
      await removeMemberMutation.mutateAsync({
        teamId,
        memberId,
      });
    } catch (error) {
      console.error("Failed to remove team member:", error);
    }
  };

  // Update member role
  const handleUpdateMemberRole = async (
    userId: string,
    role: { id: number; name: string },
    checked: boolean,
  ) => {
    if (!teamId) return;
    try {
      await updateRoleMutation.mutateAsync({
        teamId,
        userId,
        roleId: role.id,
        roleName: role.name,
        action: checked ? "grant" : "revoke",
      });
      toast.success(
        checked ? "Role assigned successfully" : "Role removed successfully",
      );
    } catch (error) {
      toast.error(
        (typeof error === "object" &&
          (error as { message?: string })?.message) ||
          "Failed to update role",
      );
      console.error("Failed to update member role:", error);
    }
  };

  // Define table columns
  const columns: TableColumn<MemberTableRow>[] = useMemo(() => {
    const baseColumns: TableColumn<MemberTableRow>[] = [
      {
        id: "name",
        header: "Name",
        render: (row) => {
          // For actual members, use the standardized UserInfo component
          if (row.type === "member" && row.userId) {
            return (
              <UserInfo userId={row.userId} showDetails maxWidth="250px" />
            );
          }

          // For pending invites, use custom implementation since they don't have userId yet
          return (
            <div className="flex gap-2 items-center min-w-[48px]">
              <UserAvatar fallback={row.email} size="sm" muted />
              <div className="flex flex-col items-start text-left leading-tight w-full">
                <span
                  className="truncate block text-xs font-medium text-foreground"
                  style={{ maxWidth: "250px" }}
                >
                  {row.email}
                </span>
                <span
                  className="truncate block text-xs font-normal text-muted-foreground"
                  style={{ maxWidth: "250px" }}
                >
                  Pending
                </span>
              </div>
            </div>
          );
        },
        sortable: true,
      },
      {
        id: "roles",
        header: "Role",
        render: (row) => (
          <span className="inline-flex gap-2">
            {row.roles.slice(0, 3).map((role) => (
              <Badge variant="outline" key={role.id}>
                {role.name}
              </Badge>
            ))}
            {row.type === "member" && row.member && (
              <RolesDropdown
                roles={roles}
                selectedRoles={row.roles}
                onRoleClick={(role, checked) => {
                  if (!row.member) {
                    throw new Error("Member not found");
                  }
                  handleUpdateMemberRole(row.member.user_id, role, checked);
                }}
                disabled={updateRoleMutation.isPending}
              />
            )}
          </span>
        ),
        sortable: true,
      },
    ];

    // Add Last Activity column if not mobile
    if (!isMobile) {
      baseColumns.push({
        id: "lastActivity",
        header: "Last active",
        render: (row) => <ActivityStatusCell lastActivity={row.lastActivity} />,
        sortable: true,
      });
    }

    // Add actions column
    baseColumns.push({
      id: "actions",
      header: "",
      render: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <span className="sr-only">Open menu</span>
              <Icon name="more_horiz" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (row.type === "invite" && row.invite) {
                  rejectInvite.mutateAsync({
                    id: String(row.invite.id),
                    teamId,
                  });
                } else if (row.type === "member" && row.member) {
                  handleRemoveMember(row.member.id);
                }
              }}
              disabled={
                removeMemberMutation.isPending || rejectInvite.isPending
              }
            >
              {(() => {
                // Check if this is the current user
                const isCurrentUser =
                  row.type === "member" &&
                  row.userId &&
                  user &&
                  row.userId === user.id;

                if (row.type === "invite") {
                  // For pending invitations
                  return (
                    <>
                      <Icon name="delete" />
                      {rejectInvite.isPending &&
                      rejectInvite.variables?.id === row.id
                        ? "Removing..."
                        : "Delete invitation"}
                    </>
                  );
                } else if (isCurrentUser) {
                  // For current user
                  return (
                    <>
                      <Icon name="waving_hand" />
                      {removeMemberMutation.isPending &&
                      removeMemberMutation.variables?.memberId === row.id
                        ? "Leaving..."
                        : "Leave team"}
                    </>
                  );
                } else {
                  // For other team members
                  return (
                    <>
                      <Icon name="waving_hand" />
                      {removeMemberMutation.isPending &&
                      removeMemberMutation.variables?.memberId === row.id
                        ? "Removing..."
                        : "Remove Member"}
                    </>
                  );
                }
              })()}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    });

    return baseColumns;
  }, [
    teamId,
    roles,
    isMobile,
    user,
    handleUpdateMemberRole,
    updateRoleMutation.isPending,
    removeMemberMutation.isPending,
    rejectInvite.isPending,
    removeMemberMutation.variables,
    rejectInvite.variables,
  ]);

  // Sorting logic
  function getSortValue(row: MemberTableRow, key: string): string {
    switch (key) {
      case "name":
        return row.name.toLowerCase();
      case "roles":
        return row.roles
          .map((r) => r.name)
          .sort()
          .join(",")
          .toLowerCase();
      case "lastActivity":
        return row.lastActivity
          ? new Date(row.lastActivity).getTime().toString()
          : "0";
      default:
        return "";
    }
  }

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }

  // Sort the filtered data
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDirection]);

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <MemberTableHeader onChange={setQuery} teamId={teamId} />
        {members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No members found. Add team members to get started.
          </div>
        ) : (
          <Table
            columns={columns}
            data={sortedData}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
      </div>
    </div>
  );
}

export default function MembersSettings() {
  return (
    <ScrollArea className="h-full text-foreground">
      <Suspense fallback={<MembersViewLoading />}>
        <MembersViewContent />
      </Suspense>
    </ScrollArea>
  );
}
