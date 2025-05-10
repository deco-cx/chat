import {
  PropsWithChildren,
  Suspense,
  useDeferredValue,
  useMemo,
  useState,
} from "react";
import {
  type Member,
  useRemoveTeamMember,
  useTeam,
  useTeamMembers,
} from "@deco/sdk";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@deco/ui/components/table.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { z } from "zod";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";

import { Avatar } from "../common/Avatar.tsx";
import { timeAgo } from "../../utils/timeAgo.ts";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { cn } from "../../../../../packages/ui/src/lib/utils.ts";
import { InviteTeamMembersDialog } from "../common/InviteTeamMembersDialog.tsx";

// Form validation schema
const inviteMemberSchema = z.object({
  invitees: z.array(
    z.object({
      email: z.string().email({
        message: "Please enter a valid email address",
      }),
      roleId: z.string().min(1, { message: "Please select a role" }),
    }),
  ).min(1),
});

type InviteMemberFormData = z.infer<typeof inviteMemberSchema>;

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

const compareMemberRole = (a: Member, b: Member) =>
  (a.admin ? 0 : 1) - (b.admin ? 0 : 1);

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
  const removeMemberMutation = useRemoveTeamMember();
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
                      {member.admin ? "Admin" : "Member"}
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
    <div className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="members" />
      <Suspense fallback={<MembersViewLoading />}>
        <MembersViewContent />
      </Suspense>
    </div>
  );
}
