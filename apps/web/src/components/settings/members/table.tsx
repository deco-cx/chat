import {
  type ChangeEvent,
  useCallback,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  type Member,
  type Role,
  type User,
  useInviteTeamMember,
  useRejectInvite,
  useRemoveTeamMember,
  useTeamMembers,
  useTeamRoles,
  useUpdateMemberRole,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { UserAvatar } from "../../common/avatar/user.tsx";
import { InviteTeamMembersDialog } from "../../common/invite-team-members-dialog.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Table, type TableColumn } from "../../common/table/index.tsx";
import {
  ActivityStatusCell,
  UserInfo,
} from "../../common/table/table-cells.tsx";
import { MultiSelect } from "@deco/ui/components/multi-select.tsx";

// Types and Interfaces
interface MemberTableRow {
  type: "member" | "invite";
  id: string | number;
  name: string;
  email: string;
  roles: Array<{ id: number; name: string }>;
  lastActivity?: string | null;
  avatarUrl?: string;
  isPending?: boolean;
  userId?: string;
  member?: Member;
  invite?: {
    id: string | number;
    email: string;
    roles: Array<{ id: number; name: string }>;
  };
}

interface MemberTableHeaderProps {
  disabled?: boolean;
  onChange: (value: string) => void;
  teamId?: number;
}

interface MembersTableViewProps {
  teamId?: number;
  user: User;
}

// Utility Functions
function getMemberName(member: Member): string {
  return member.profiles.metadata.full_name || member.profiles.email;
}

// Components
function MemberTableHeader(
  { onChange, disabled, teamId }: MemberTableHeaderProps,
) {
  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.currentTarget.value);
  }, [onChange]);

  return (
    <div className="flex items-center justify-between">
      <Input
        placeholder="Search"
        onChange={handleChange}
        className="w-80"
        disabled={disabled}
      />
      <InviteTeamMembersDialog
        teamId={teamId}
        trigger={
          <Button>
            <Icon name="person_add" />
            Invite members
          </Button>
        }
      />
    </div>
  );
}

export function MembersTableView({
  teamId,
  user,
}: MembersTableViewProps) {
  // Data fetching hooks
  const { data: { members, invites } } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const removeMemberMutation = useRemoveTeamMember();
  const rejectInvite = useRejectInvite();
  const inviteTeamMember = useInviteTeamMember();
  const updateMemberRoleMutation = useUpdateMemberRole();

  // Local state
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [resendingInviteId, setResendingInviteId] = useState<string | null>(
    null,
  );

  const deferredQuery = useDeferredValue(query);
  const isMobile = useIsMobile();

  // Convert members and invites to unified data structure with memoization
  const tableData = useMemo((): MemberTableRow[] => {
    const memberRows: MemberTableRow[] = members.map((member) => ({
      type: "member" as const,
      id: member.id,
      name: getMemberName(member),
      email: member.profiles.email,
      roles: member.roles,
      lastActivity: member.lastActivity,
      avatarUrl: member.profiles.metadata.avatar_url,
      userId: member.user_id,
      member,
    }));

    const inviteRows: MemberTableRow[] = invites.map((invite) => ({
      type: "invite" as const,
      id: invite.id,
      name: invite.email,
      email: invite.email,
      roles: invite.roles,
      isPending: true,
      invite,
    }));

    return [...inviteRows, ...memberRows];
  }, [members, invites]);

  // Filter data based on search query with deferred search
  const filteredData = useMemo(() => {
    if (!deferredQuery) return tableData;
    const searchTerm = deferredQuery.toLowerCase();
    return tableData.filter((row: MemberTableRow) =>
      row.name.toLowerCase().includes(searchTerm) ||
      row.email.toLowerCase().includes(searchTerm)
    );
  }, [tableData, deferredQuery]);

  // Memoized event handlers to prevent unnecessary re-renders
  const handleRemoveMember = useCallback(async (memberId: number) => {
    if (!teamId) return;
    try {
      await removeMemberMutation.mutateAsync({ teamId, memberId });
    } catch (error) {
      console.error("Failed to remove team member:", error);
      toast.error("Failed to remove team member");
    }
  }, [teamId, removeMemberMutation]);

  const handleUpdateMemberRole = useCallback(async (
    userId: string,
    role: { id: number; name: string },
    checked: boolean,
  ) => {
    if (!teamId) return;
    try {
      await updateMemberRoleMutation.mutateAsync({
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
      const errorMessage =
        typeof error === "object" && (error as any)?.message ||
        "Failed to update role";
      toast.error(errorMessage);
      console.error("Failed to update member role:", error);
    }
  }, [teamId, updateMemberRoleMutation]);

  // Define table columns with updated role column
  const columns: TableColumn<MemberTableRow>[] = useMemo(() => {
    const baseColumns: TableColumn<MemberTableRow>[] = [
      {
        id: "name",
        header: "Name",
        render: (row) => {
          // For actual members, use the standardized UserInfo component
          if (row.type === "member" && row.userId) {
            return (
              <UserInfo
                userId={row.userId}
                showDetails
                maxWidth="250px"
              />
            );
          }

          // For pending invites, use custom implementation since they don't have userId yet
          return (
            <div className="flex gap-2 items-center min-w-[48px]">
              <UserAvatar
                fallback={row.email}
                size="sm"
                muted
              />
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
        header: "Roles",
        render: (row) => {
          if (roles.length === 0) {
            return (
              <span className="text-muted-foreground text-sm">
                No roles available
              </span>
            );
          }

          if (row.type === "member" && row.member) {
            const selectedRoleIds = row.roles.map((r) => r.id.toString());
            const roleOptions = roles.map((role) => ({
              label: role.name,
              value: role.id.toString(),
            }));

            return (
              <MultiSelect
                options={roleOptions}
                defaultValue={selectedRoleIds}
                onValueChange={async (newValues) => {
                  // Find roles to add and remove
                  const currentRoleIds = row.roles.map((r) => r.id.toString());
                  const rolesToAdd = newValues.filter((id) =>
                    !currentRoleIds.includes(id)
                  );
                  const rolesToRemove = currentRoleIds.filter((id) =>
                    !newValues.includes(id)
                  );

                  // Process role changes
                  for (const roleId of rolesToAdd) {
                    const role = roles.find((r) => r.id.toString() === roleId);
                    if (role) {
                      await handleUpdateMemberRole(
                        row.member!.user_id,
                        role,
                        true,
                      );
                    }
                  }

                  for (const roleId of rolesToRemove) {
                    const role = roles.find((r) => r.id.toString() === roleId);
                    if (role) {
                      await handleUpdateMemberRole(
                        row.member!.user_id,
                        role,
                        false,
                      );
                    }
                  }
                }}
                placeholder="Select roles"
                variant="secondary"
                className="w-[240px]"
                disabled={updateMemberRoleMutation.isPending}
                maxCount={2}
              />
            );
          } else if (row.type === "invite" && row.invite) {
            const selectedRoleIds = row.invite.roles.map((r) =>
              r.id.toString()
            );
            const roleOptions = roles.map((role) => ({
              label: role.name,
              value: role.id.toString(),
            }));

            return (
              <MultiSelect
                options={roleOptions}
                defaultValue={selectedRoleIds}
                onValueChange={() => {}} // No-op for invites
                placeholder="Select roles"
                variant="secondary"
                className="w-[240px]"
                disabled={true}
                maxCount={2}
              />
            );
          }
          return null;
        },
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
            {row.type === "invite" && row.invite && (
              <DropdownMenuItem
                onClick={async () => {
                  setResendingInviteId(row.invite!.id.toString());
                  try {
                    if (!teamId) return;
                    await inviteTeamMember.mutateAsync({
                      teamId,
                      invitees: [
                        {
                          email: row.invite!.email,
                          roles: row.invite!.roles,
                        },
                      ],
                    });
                    toast.success("Invitation resent");
                  } catch {
                    toast.error("Failed to resend invitation");
                  } finally {
                    setResendingInviteId(null);
                  }
                }}
                disabled={resendingInviteId === row.invite.id.toString() ||
                  inviteTeamMember.isPending}
              >
                <Icon name="mail" />
                {resendingInviteId === row.invite.id.toString() ||
                    inviteTeamMember.isPending
                  ? "Resending..."
                  : "Resend invite"}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                if (row.type === "invite" && row.invite && teamId) {
                  rejectInvite.mutateAsync({
                    id: String(row.invite.id),
                    teamId,
                  });
                } else if (row.type === "member" && row.member) {
                  handleRemoveMember(row.member.id);
                }
              }}
              disabled={removeMemberMutation.isPending ||
                rejectInvite.isPending}
            >
              {(() => {
                const isCurrentUser = row.type === "member" && row.userId &&
                  user && row.userId === user.id;

                if (row.type === "invite") {
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
    isMobile,
    user,
    handleUpdateMemberRole,
    updateMemberRoleMutation.isPending,
    removeMemberMutation.isPending,
    rejectInvite.isPending,
    removeMemberMutation.variables,
    rejectInvite.variables,
    inviteTeamMember.isPending,
    resendingInviteId,
    roles,
    handleRemoveMember,
    inviteTeamMember,
    rejectInvite,
  ]);

  // Memoized sorting functions for better performance
  const getSortValue = useCallback(
    (row: MemberTableRow, key: string): string => {
      switch (key) {
        case "name":
          return row.name.toLowerCase();
        case "roles":
          return row.roles.map((r) => r.name).sort().join(",").toLowerCase();
        case "lastActivity":
          return row.lastActivity
            ? new Date(row.lastActivity).getTime().toString()
            : "0";
        default:
          return "";
      }
    },
    [],
  );

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") =>
        prev === "asc" ? "desc" : "asc"
      );
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  }, [sortKey]);

  // Memoized sorted data for better performance
  const sortedData = useMemo(() => {
    return [...filteredData].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredData, sortKey, sortDirection, getSortValue]);

  return (
    <>
      <MemberTableHeader onChange={setQuery} teamId={teamId} />
      {members.length === 0
        ? (
          <div className="text-center py-8 text-muted-foreground">
            No members found. Add team members to get started.
          </div>
        )
        : (
          <Table
            columns={columns}
            data={sortedData}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
          />
        )}
    </>
  );
}
