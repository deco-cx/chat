import { useTeam, useTeams } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { SidebarMenuButton } from "@deco/ui/components/sidebar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useState } from "react";
import { Link, useParams } from "react-router";
import { useUser } from "../../hooks/use-user.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { CreateTeamDialog } from "./create-team-dialog.tsx";
import { InviteTeamMembersDialog } from "../common/invite-team-members-dialog.tsx";

interface CurrentTeam {
  avatarUrl: string | undefined;
  slug: string;
  id: number | string;
  label: string;
}

function useUserTeam(): CurrentTeam {
  const user = useUser();
  const avatarUrl = user?.metadata?.avatar_url ?? undefined;
  const name = user?.metadata?.full_name || user?.email;
  const label = `${name.split(" ")[0]}'s team`;
  return {
    avatarUrl,
    label,
    id: user?.id ?? "",
    slug: "",
  };
}

export function useCurrentTeam(): CurrentTeam {
  const { teamSlug } = useParams();
  const userTeam = useUserTeam();
  const { data: teamData } = useTeam(teamSlug);
  if (!teamSlug) {
    return userTeam;
  }
  return {
    avatarUrl: teamData?.avatar_url || "https://client.timbrotrading.com/build/images/timbro-logo-02.png",
    label: teamData?.name || teamSlug || "",
    id: teamData?.id ?? "",
    slug: teamData?.slug ?? teamSlug ?? "",
  };
}

function useUserTeams() {
  const { data: teams } = useTeams();
  const personalTeam = useUserTeam();
  const { slug: currentSlug } = useCurrentTeam();

  const allTeams: CurrentTeam[] = [
    personalTeam,
    ...teams.map((team) => ({
      avatarUrl: undefined,
      slug: team.slug,
      label: team.name,
      id: team.id,
    })),
  ];

  const teamsWithoutCurrentTeam = allTeams.filter((team) =>
    team.slug !== currentSlug
  );

  return teamsWithoutCurrentTeam;
}

function CurrentTeamDropdownTrigger() {
  const { avatarUrl, label } = useCurrentTeam();

  return (
    <ResponsiveDropdownTrigger asChild>
      <SidebarMenuButton className="p-1 group-data-[collapsible=icon]:p-1! gap-3 md:pl-2">
        <Avatar
          url={avatarUrl}
          fallback={label}
          objectFit="contain"
          className="size-6"
        />
        <div className="flex items-center justify-start flex-1 min-w-0 gap-1">
          <span className="text-sm font-medium truncate min-w-0">
            {label}
          </span>
          <Icon
            name="unfold_more"
            className="text-muted-foreground"
            size={16}
          />
        </div>
      </SidebarMenuButton>
    </ResponsiveDropdownTrigger>
  );
}

function CurrentTeamDropdownOptions() {
  const buildWorkspaceLink = useWorkspaceLink();
  const { id: teamId } = useCurrentTeam();

  return (
    <>
      <ResponsiveDropdownItem asChild>
        <Link
          to={buildWorkspaceLink("/settings")}
          className="w-full flex items-center gap-2 cursor-pointer"
        >
          <span className="grid place-items-center p-1">
            <Icon name="settings" size={16} className="text-muted-foreground" />
          </span>
          <span className="md:text-sm">
            Settings
          </span>
        </Link>
      </ResponsiveDropdownItem>
      <InviteTeamMembersDialog
        teamId={typeof teamId === "number" ? teamId : undefined}
        trigger={
          <ResponsiveDropdownItem
            className="gap-2 cursor-pointer"
            onClick={(e) => {
              // Prevent event from bubbling up to parent elements
              e.stopPropagation();
            }}
          >
            <span className="grid place-items-center p-1">
              <Icon
                name="person_add"
                size={16}
                className="text-muted-foreground"
              />
            </span>
            <span className="md:text-sm flex-grow justify-self-start">
              Invite members
            </span>
          </ResponsiveDropdownItem>
        }
      />
    </>
  );
}

CurrentTeamDropdownOptions.Skeleton = () => (
  <div className="flex flex-col gap-2 h-full overflow-y-auto">
    {Array.from({ length: 5 }).map((_, index) => (
      <div
        key={index}
        className="h-9 w-full bg-muted-foreground/10 rounded-xl"
      />
    ))}
  </div>
);

function SwitchTeam(
  { onRequestCreateTeam }: { onRequestCreateTeam: () => void },
) {
  const availableTeamsToSwitch = useUserTeams();
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const filteredTeams = availableTeamsToSwitch
    .filter((team) =>
      team.label.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

  const toggleSearch = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowSearch(!showSearch);
    if (!showSearch) {
      // Clear search when opening
      setSearchQuery("");
    }
  };

  return (
    <>
      <div className="flex justify-between items-center px-2 h-8">
        <span className="text-xs font-medium text-muted-foreground">
          Switch team
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={toggleSearch}
        >
          <Icon name="search" size={16} className="text-muted-foreground" />
        </Button>
      </div>

      {showSearch && (
        <div className="p-2 hidden md:block">
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
      )}

      {filteredTeams.length > 0
        ? (
          <div className="flex flex-col gap-2 h-36 overflow-y-auto">
            {filteredTeams.map((team) => (
              <ResponsiveDropdownItem asChild key={team.slug}>
                <Link
                  to={`/${team.slug}`}
                  className="w-full flex items-center gap-2 cursor-pointer"
                >
                  <Avatar
                    className="w-6 h-6"
                    url={team.avatarUrl}
                    fallback={team.label}
                  />
                  <span className="md:text-sm">
                    {team.label}
                  </span>
                </Link>
              </ResponsiveDropdownItem>
            ))}
          </div>
        )
        : (
          <div className="text-sm text-center py-2 text-muted-foreground">
            No teams found
          </div>
        )}

      {showSearch && (
        <div className="p-2 md:hidden">
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8 text-sm"
            autoFocus
          />
        </div>
      )}

      <ResponsiveDropdownItem
        className="gap-2 cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-default aria-disabled:pointer-events-none"
        onClick={onRequestCreateTeam}
      >
        <span className="grid place-items-center p-1">
          <Icon name="add" size={16} className="text-muted-foreground" />
        </span>
        <span className="md:text-sm">
          Create team
        </span>
      </ResponsiveDropdownItem>
    </>
  );
}

export function TeamSelector() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  return (
    <>
      <ResponsiveDropdown>
        <Suspense fallback={<CurrentTeamDropdownTrigger />}>
          <CurrentTeamDropdownTrigger />
        </Suspense>
        <ResponsiveDropdownContent align="start" className="md:w-[240px]">
          <Suspense fallback={<CurrentTeamDropdownOptions.Skeleton />}>
            <CurrentTeamDropdownOptions />
          </Suspense>
          <ResponsiveDropdownSeparator />
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center">
                <Spinner size="xs" />
              </div>
            }
          >
            <SwitchTeam
              onRequestCreateTeam={() => setIsCreateDialogOpen(true)}
            />
          </Suspense>
        </ResponsiveDropdownContent>
      </ResponsiveDropdown>
      <CreateTeamDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </>
  );
}
