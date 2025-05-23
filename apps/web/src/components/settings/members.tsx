import {
  type Member,
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
  PropsWithChildren,
  Suspense,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import { timeAgo } from "../../utils/timeAgo.ts";
import { Avatar } from "../common/Avatar.tsx";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { InviteTeamMembersDialog } from "../common/InviteTeamMembersDialog.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";

function MemberTitle() {
  return (
    <div className="items-center justify-between hidden md:flex">
      <h2 className="text-2xl">Members</h2>
    </div>
  );
}

function MemberTableHeader(
  { onChange, disabled }: {
    disabled?: boolean;
    onChange: (value: string) => void;
  },
) {
  return (
    <div className="">
      <Input
        placeholder="Search"
        onChange={(e) => onChange(e.currentTarget.value)}
        className="w-80"
        disabled={disabled}
      />
    </div>
  );
}

function MembersViewLoading() {
  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <MemberTitle />
      <MemberTableHeader disabled onChange={() => {}} />
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading members...</span>
      </div>
    </div>
  );
}

function AddTeamMemberButton({ teamId }: { teamId?: number }) {
  return (
    <InviteTeamMembersDialog
      teamId={teamId}
      trigger={
        <Button variant="ghost" size="icon">
          <span className="sr-only">Invite team members</span>
          <Icon name="add" />
        </Button>
      }
    />
  );
}

type Columns = "name" | "role" | "lastActivity";
type SortDir = "asc" | "desc";
type Sort = `${Columns}_${SortDir}`;

const getMemberName = (member: Member) =>
  member.profiles.metadata.full_name ||
  member.profiles.email;

const compareMemberActivity = (a: Member, b: Member) => {
  const aD = a.lastActivity ? new Date(a.lastActivity).getTime() : Infinity;
  const bD = b.lastActivity ? new Date(b.lastActivity).getTime() : Infinity;

  return aD - bD;
};

const getMemberRoleName = (a: Member) =>
  a.roles.map((r) => r.name).sort().join(",");
const compareMemberRole = (a: Member, b: Member) =>
  getMemberRoleName(a).localeCompare(
    getMemberRoleName(b),
  );

const sortFnS: Record<
  Columns,
  Partial<Record<SortDir, (a: Member, b: Member) => number>>
> = {
  name: {
    asc: (a, b) => getMemberName(a).localeCompare(getMemberName(b)),
    desc: (a, b) => -getMemberName(a).localeCompare(getMemberName(b)),
  },
  role: {
    asc: (a, b) => compareMemberRole(a, b),
    desc: (a, b) => -compareMemberRole(a, b),
  },
  lastActivity: {
    asc: (a, b) => compareMemberActivity(a, b),
    desc: (a, b) => -compareMemberActivity(a, b),
  },
} as const;

function TableHeadSort(
  { onClick, sort, children, mode }: PropsWithChildren<
    { onClick: () => void; sort?: SortDir; mode?: SortDir }
  >,
) {
  const hasBothArrows = mode === undefined;
  const hasAsc = hasBothArrows || mode === "asc";
  const hasDesc = hasBothArrows || mode === "desc";
  return (
    <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-slate-700 text-sm h-10">
      <button
        type="button"
        className="flex items-center gap-1 cursor-pointer select-none"
        onClick={onClick}
      >
        {children}
        <span
          className={cn(
            "inline-flex items-center transition-transform",
          )}
        >
          {hasAsc && (
            <Icon
              key="desc"
              name="arrow_upward"
              size={16}
              className={cn(
                "transition-colors",
                sort === "asc" ? "text-slate-700" : "text-slate-300",
              )}
            />
          )}
          {hasDesc && (
            <Icon
              key="up"
              name="arrow_upward"
              size={16}
              className={cn(
                "transition-colors rotate-180 text-slate-300",
                sort === "desc" ? "text-slate-700" : "text-slate-300",
              )}
            />
          )}
        </span>
      </button>
    </TableHead>
  );
}

function MembersViewContent() {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = team?.id;
  const { data: members } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const removeMemberMutation = useRemoveTeamMember();
  const updateRoleMutation = useUpdateMemberRole();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("name_asc");
  const deferredQuery = useDeferredValue(query);
  const filteredMembers = useMemo(
    () =>
      deferredQuery
        ? members.filter((member) =>
          member.profiles.metadata.full_name?.toLowerCase().includes(
            deferredQuery,
          ) ||
          member.profiles.email.toLowerCase().includes(deferredQuery)
        )
        : members,
    [members, deferredQuery],
  );
  const sortInfo = useMemo(() => sort.split("_") as [Columns, SortDir], [sort]);
  const sortMembers = useMemo(() => {
    const [col, sortDir] = sortInfo;
    const fn = sortFnS[col][sortDir] ?? sortFnS.name.asc;

    return filteredMembers.sort(fn);
  }, [sort, filteredMembers]);

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
    roleId: number,
    checked: boolean,
  ) => {
    if (!teamId) return;
    try {
      await updateRoleMutation.mutateAsync({
        teamId,
        userId,
        roleId,
        action: checked ? "grant" : "revoke",
      });
      toast.success(
        checked ? "Role assigned successfully" : "Role removed successfully"
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to update role");
      console.error("Failed to update member role:", error);
    }
  };

  const [col, sortDir] = sortInfo;

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <MemberTitle />

      <div className="flex flex-col gap-4">
        <MemberTableHeader onChange={setQuery} />
        <Table>
          <TableHeader>
            <TableRow className="h-14">
              <TableHeadSort
                onClick={() => setSort("name_asc")}
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
              <TableHead className="px-2 text-left bg-[#F8FAFC] font-semibold text-slate-700 text-sm h-10 w-12.5">
                <AddTeamMemberButton teamId={teamId} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0
              ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center py-8 text-slate-700 "
                  >
                    No members found. Add team members to get started.
                  </TableCell>
                </TableRow>
              )
              : (
                sortMembers.map((member) => (
                  <TableRow key={member.id} className="px-4 py-1.5">
                    <TableCell>
                      <span className="flex gap-2 items-center w-43 md:w-56">
                        <span>
                          <Avatar
                            url={member.profiles.metadata.avatar_url}
                            fallback={member.profiles.metadata.full_name}
                            className="w-8 h-8"
                          />
                        </span>

                        <span className="flex flex-col gap-1 min-w-0">
                          <span className="font-semibold text-xs truncate">
                            {getMemberName(member)}
                          </span>
                          <span className="text-[10px] leading-3.5 text-slate-500 truncate">
                            {member.profiles.email || "N/A"}
                          </span>
                        </span>
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex gap-2 items-center">
                        {member.roles.map((role) => (
                          <Badge variant="outline" key={role.id}>
                            {role.name}
                          </Badge>
                        ))}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-5.5 w-5.5 p-0 rounded-md"
                            >
                              <Icon name="add" size={14} />
                              <span className="sr-only">Manage roles</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-56 p-2">
                            <div className="text-xs font-medium px-2 py-1.5">Roles</div>
                            {roles.map((role) => {
                              const checked = member.roles.some((memberRole) => 
                                memberRole.id === role.id
                              );
                              return (
                                <DropdownMenuItem key={role.id} asChild>
                                  <div 
                                    className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      // Don't allow removing the last role
                                      if (checked && member.roles.length <= 1) {
                                        toast.error("Member must have at least one role");
                                        return;
                                      }
                                      handleUpdateMemberRole(
                                        member.user_id,
                                        role.id,
                                        !checked
                                      );
                                    }}
                                  >
                                    <Checkbox
                                      checked={checked}
                                      className="h-4 w-4"
                                      disabled={updateRoleMutation.isPending}
                                    />
                                    <span className="capitalize">{role.name}</span>
                                  </div>
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
                            <Icon name="delete" />
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
                ))
              )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function MembersSettings() {
  return (
    <ScrollArea className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="members" />
      <Suspense fallback={<MembersViewLoading />}>
        <MembersViewContent />
      </Suspense>
    </ScrollArea>
  );
}
