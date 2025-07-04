import {
  type Member,
  useRejectInvite,
  useRemoveTeamMember,
  useTeam,
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
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  type PropsWithChildren,
  Suspense,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { timeAgo } from "../../utils/time-ago.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { useCurrentTeam } from "../sidebar/team-selector.tsx";
import { InviteTeamMembersDialog } from "../common/invite-team-members-dialog.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { RolesDropdown } from "../common/roles-dropdown.tsx";



function MemberTableHeader(
  { onChange, disabled, teamId }: {
    disabled?: boolean;
    onChange: (value: string) => void;
    teamId?: number;
  },
) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Input
        placeholder="Search"
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-80"
        disabled={disabled}
      />
      <InviteTeamMembersDialog
        teamId={teamId}
        trigger={
          <Button variant="default">
            Invite members
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

type Columns = "name" | "role" | "lastActivity";
type SortDir = "asc" | "desc";
type Sort = `${Columns}_${SortDir}`;

// Union type for members and invites
type MemberOrInvite = Member | {
  type: 'invite';
  id: string;
  email: string;
  roles: { id: number; name: string }[];
};

const getMemberName = (member: Member) =>
  member.profiles.metadata.full_name ||
  member.profiles.email ||
  "Unknown";

const getItemName = (item: MemberOrInvite): string => {
  if ('type' in item && item.type === 'invite') {
    return item.email;
  }
  return getMemberName(item as Member);
};

const getItemRoleName = (item: MemberOrInvite): string => {
  return item.roles.map((r) => r.name).sort().join(",");
};

const compareMemberActivity = (a: Member, b: Member) => {
  const aActivity = a.lastActivity ? new Date(a.lastActivity).getTime() : Infinity;
  const bActivity = b.lastActivity ? new Date(b.lastActivity).getTime() : Infinity;
  return aActivity - bActivity;
};

const sortFnS: Record<
  Columns,
  Partial<Record<SortDir, (a: MemberOrInvite, b: MemberOrInvite) => number>>
> = {
  name: {
    asc: (a, b) => getItemName(a).localeCompare(getItemName(b)),
    desc: (a, b) => -getItemName(a).localeCompare(getItemName(b)),
  },
  role: {
    asc: (a, b) => getItemRoleName(a).localeCompare(getItemRoleName(b)),
    desc: (a, b) => -getItemRoleName(a).localeCompare(getItemRoleName(b)),
  },
  lastActivity: {
    asc: (a, b) => {
      // Invites always go to the end for activity sorting
      if ('type' in a && a.type === 'invite') return 1;
      if ('type' in b && b.type === 'invite') return -1;
      return compareMemberActivity(a as Member, b as Member);
    },
    desc: (a, b) => {
      // Invites always go to the end for activity sorting
      if ('type' in a && a.type === 'invite') return 1;
      if ('type' in b && b.type === 'invite') return -1;
      return -compareMemberActivity(a as Member, b as Member);
    },
  },
} as const;

function TableHeadSort(
  { onClick, sort, children, mode }: PropsWithChildren<
    { onClick: () => void; sort?: SortDir; mode?: SortDir }
  >,
) {
  const isActive = sort !== undefined;
  
  return (
    <TableHead className="px-4 text-left font-normal text-foreground text-sm h-12 cursor-pointer group hover:bg-transparent">
      <div
        className="flex items-center cursor-pointer select-none w-full"
        onClick={onClick}
      >
        {children}
        {isActive ? (
          <Icon
            name={sort === "asc" ? "arrow_downward" : "arrow_upward"}
            size={16}
            className="text-foreground group-hover:text-muted-foreground ml-2 transition-colors"
          />
        ) : (
          <Icon
            name="arrow_downward"
            size={16}
            className="text-muted-foreground ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
      </div>
    </TableHead>
  );
}

function MembersViewContent() {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const { data: { members, invites } } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const removeMemberMutation = useRemoveTeamMember();
  const rejectInvite = useRejectInvite();
  const updateRoleMutation = useUpdateMemberRole();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name_asc");
  const deferredQuery = useDeferredValue(query);

  // Combine members and invites into a single list
  const allItems: MemberOrInvite[] = useMemo(() => {
    const memberItems: MemberOrInvite[] = members;
    const inviteItems: MemberOrInvite[] = invites.map(invite => ({
      type: 'invite' as const,
      id: invite.id,
      email: invite.email,
      roles: invite.roles,
    }));
    return [...memberItems, ...inviteItems];
  }, [members, invites]);

  const filteredItems = useMemo(
    () =>
      deferredQuery
        ? allItems.filter((item) => {
            if ('type' in item && item.type === 'invite') {
              return item.email.toLowerCase().includes(deferredQuery);
            }
            const member = item as Member;
            return member.profiles.metadata.full_name?.toLowerCase().includes(
              deferredQuery,
            ) ||
            member.profiles.email.toLowerCase().includes(deferredQuery);
          })
        : allItems,
    [allItems, deferredQuery],
  );

  const sortInfo = useMemo(() => sort.split("_") as [Columns, SortDir], [sort]);
  const sortedItems = useMemo(() => {
    const [col, sortDir] = sortInfo;
    const fn = sortFnS[col][sortDir] ?? sortFnS.name.asc;

    return filteredItems.sort(fn);
  }, [sort, filteredItems]);

  const isMobile = useIsMobile();

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
        // deno-lint-ignore no-explicit-any
        typeof error === "object" && (error as any)?.message ||
          "Failed to update role",
      );
      console.error("Failed to update member role:", error);
    }
  };

  const [col, sortDir] = sortInfo;

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <MemberTableHeader onChange={setQuery} teamId={teamId} />
        <Table>
          <TableHeader className="border-b border-border">
            <TableRow className="h-12 hover:bg-transparent">
              <TableHeadSort
                onClick={() =>
                  setSort(sort === "name_asc" ? "name_desc" : "name_asc")}
                sort={col === "name" ? sortDir : undefined}
                mode="asc"
              >
                Name
              </TableHeadSort>
              <TableHeadSort
                onClick={() =>
                  setSort(sort === "role_asc" ? "role_desc" : "role_asc")}
                sort={col === "role" ? sortDir : undefined}
              >
                Role
              </TableHeadSort>
              {!isMobile &&
                (
                  <TableHeadSort
                    onClick={() =>
                      setSort(
                        sort === "lastActivity_asc"
                          ? "lastActivity_desc"
                          : "lastActivity_asc",
                      )}
                    sort={col === "lastActivity" ? sortDir : undefined}
                  >
                    Last active
                  </TableHeadSort>
                )}
              <TableHead className="px-4 text-left font-normal text-foreground text-sm h-12 w-12.5">
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allItems.length === 0
              ? (
                <TableRow>
                  <TableCell
                    colSpan={isMobile ? 3 : 4}
                    className="text-center py-8 text-muted-foreground "
                  >
                    No members found. Add team members to get started.
                  </TableCell>
                </TableRow>
              )
              : (
                <>
                  {sortedItems.map((item) => {
                    if ('type' in item && item.type === 'invite') {
                      // Render invite row
                      return (
                        <TableRow key={`invite-${item.id}`} className="px-4 py-1.5 hover:bg-transparent">
                          <TableCell>
                            <span className="flex gap-2 items-center w-43 md:w-56">
                              <span>
                                <div className="size-10 bg-muted border border-dashed border-border rounded-full flex items-center justify-center">
                                  <span className="text-base font-medium text-muted-foreground">
                                    {item.email.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                              </span>
                              <span className="flex flex-col gap-0 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {item.email}
                                </span>
                                <span className="text-sm font-normal text-muted-foreground truncate">
                                  Pending
                                </span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex gap-2">
                              {item.roles.map((role) => (
                                <Badge variant="outline" key={role.id}>
                                  {role.name}
                                </Badge>
                              ))}
                            </span>
                          </TableCell>
                          {!isMobile && <TableCell></TableCell>}
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                >
                                  <span className="sr-only">Open menu</span>
                                  <Icon name="more_horiz" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    rejectInvite.mutateAsync({
                                      id: item.id,
                                      teamId,
                                    })}
                                  disabled={removeMemberMutation.isPending}
                                >
                                  <Icon name="delete" />
                                  {rejectInvite.isPending &&
                                      rejectInvite.variables.id === item.id
                                    ? "Removing..."
                                    : "Remove invite"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    } else {
                      // Render member row
                      const member = item as Member;
                      return (
                        <TableRow key={`member-${member.id}`} className="px-4 py-1.5 hover:bg-transparent">
                          <TableCell>
                            <span className="flex gap-2 items-center w-43 md:w-56">
                              <span>
                                <Avatar
                                  url={member.profiles.metadata.avatar_url}
                                  fallback={member.profiles.metadata.full_name}
                                  className="size-10 border border-border"
                                />
                              </span>
                              <span className="flex flex-col gap-0 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {getMemberName(member)}
                                </span>
                                <span className="text-sm font-normal text-muted-foreground truncate">
                                  {member.profiles.email || "N/A"}
                                </span>
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex gap-2">
                              {member.roles.slice(0, 3).map((role) => (
                                <Badge variant="outline" key={role.id}>
                                  {role.name}
                                </Badge>
                              ))}
                              <RolesDropdown
                                roles={roles}
                                selectedRoles={member.roles}
                                onRoleClick={(role, checked) => {
                                  handleUpdateMemberRole(
                                    member.user_id,
                                    role,
                                    checked,
                                  );
                                }}
                                disabled={updateRoleMutation.isPending}
                              />
                            </span>
                          </TableCell>
                          {!isMobile && (
                            <TableCell>
                              {member.lastActivity
                                ? timeAgo(member.lastActivity)
                                : "N/A"}
                            </TableCell>
                          )}
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                >
                                  <span className="sr-only">Open menu</span>
                                  <Icon name="more_horiz" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    handleRemoveMember(member.id)}
                                  disabled={removeMemberMutation.isPending}
                                >
                                  <Icon name="waving_hand" />
                                  {removeMemberMutation.isPending &&
                                      removeMemberMutation.variables?.memberId ===
                                        member.id
                                    ? "Removing..."
                                    : "Remove Member"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    }
                  })}
                </>
              )}
          </TableBody>
        </Table>
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
