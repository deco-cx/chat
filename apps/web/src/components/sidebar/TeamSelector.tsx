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
import { useSidebar } from "@deco/ui/components/sidebar.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useState } from "react";
import { Link, useParams } from "react-router";
import { useUser } from "../../hooks/data/useUser.ts";
import { useWorkspaceLink } from "../../hooks/useNavigateWorkspace.ts";
import { Avatar } from "../common/Avatar.tsx";
import { CreateTeamDialog } from "./CreateTeamDialog.tsx";
import { InviteTeamMembersDialog } from "../common/InviteTeamMembersDialog.tsx";

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
    avatarUrl: undefined,
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
  const { open } = useSidebar();
  const { avatarUrl, label } = useCurrentTeam();

  return (
    <ResponsiveDropdownTrigger asChild>
      <Button
        className={cn(
          "flex-grow justify-start rounded-lg",
          "px-1.5 py-1 gap-0",
          "transition-[width,padding] overflow-hidden",
          open ? "" : "w-0 p-0",
        )}
        variant="ghost"
      >
        <Avatar
          url={avatarUrl}
          fallback={label}
          className="w-6 h-6"
        />
        <span className="text-xs truncate ml-2">
          {label}
        </span>
        <Icon name="unfold_more" className="text-xs ml-1" size={16} />
      </Button>
    </ResponsiveDropdownTrigger>
  );
}

function CurrentTeamDropdownOptions() {
  const buildWorkspaceLink = useWorkspaceLink();
  const { avatarUrl, slug, label, id: teamId } = useCurrentTeam();
  const url = slug ? `/${slug}` : "/";

  return (
    <>
      <ResponsiveDropdownItem asChild>
        <Link
          to={url}
          className="w-full flex items-center gap-4 cursor-pointer"
        >
          <Avatar
            className="rounded-full w-6 h-6"
            url={avatarUrl}
            fallback={label}
          />
          <span className="md:text-xs flex-grow justify-self-start">
            {label}
          </span>
        </Link>
      </ResponsiveDropdownItem>
      <ResponsiveDropdownItem asChild>
        <Link
          to={buildWorkspaceLink("/settings")}
          className="w-full flex items-center gap-4 cursor-pointer"
        >
          <span className="grid place-items-center p-1">
            <Icon name="settings" size={18} />
          </span>
          <span className="md:text-xs">
            Settings
          </span>
        </Link>
      </ResponsiveDropdownItem>
      <InviteTeamMembersDialog
        teamId={typeof teamId === "number" ? teamId : undefined}
        trigger={
          <ResponsiveDropdownItem
            className="gap-4 cursor-pointer"
            onClick={(e) => {
              // Prevent event from bubbling up to parent elements
              e.stopPropagation();
            }}
          >
            <span className="grid place-items-center p-1">
              <Icon name="person_add" size={18} />
            </span>
            <span className="md:text-xs flex-grow justify-self-start">
              Add team member
            </span>
          </ResponsiveDropdownItem>
        }
      />
    </>
  );
}

CurrentTeamDropdownOptions.Skeleton = () => (
  <div className="flex flex-col gap-2 h-36 overflow-y-auto">
    <div className="h-6 w-full bg-muted-foreground/10 rounded-md" />
    <div className="h-6 w-full bg-muted-foreground/10 rounded-md" />
    <div className="h-6 w-full bg-muted-foreground/10 rounded-md" />
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
      <div className="flex justify-between items-center px-2">
        <span className="md:text-[10px] text-xs font-medium">
          Switch team
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={toggleSearch}
        >
          <Icon name="search" size={16} />
        </Button>
      </div>

      {showSearch && (
        <div className="p-2 hidden md:block">
          <Input
            placeholder="Search teams..."
            value={searchQuery}
            onChange={handleSearchChange}
            onKeyDown={(e) => e.stopPropagation()}
            className="h-8 text-xs md:text-xs"
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
                  className="w-full flex items-center gap-4 cursor-pointer"
                >
                  <Avatar
                    className="w-6 h-6"
                    url={team.avatarUrl}
                    fallback={team.label}
                  />
                  <span className="md:text-xs">
                    {team.label}
                  </span>
                </Link>
              </ResponsiveDropdownItem>
            ))}
          </div>
        )
        : (
          <div className="text-xs text-center py-2 text-muted-foreground">
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
            className="h-8 text-xs md:text-xs"
            autoFocus
          />
        </div>
      )}

      <ResponsiveDropdownItem
        className="gap-4 cursor-pointer aria-disabled:opacity-50 aria-disabled:cursor-default aria-disabled:pointer-events-none"
        onClick={onRequestCreateTeam}
      >
        <span className="grid place-items-center p-1">
          <Icon name="add" size={18} />
        </span>
        <span className="md:text-xs">
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
        <ResponsiveDropdownContent align="start">
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
