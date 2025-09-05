import { useTeam, useTeams } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  ResponsiveDropdown,
  ResponsiveDropdownContent,
  ResponsiveDropdownItem,
  ResponsiveDropdownSeparator,
  ResponsiveDropdownTrigger,
} from "@deco/ui/components/responsive-dropdown.tsx";
import { SidebarMenuButton } from "@deco/ui/components/sidebar.tsx";
import { Suspense, useState } from "react";
import { Link, useParams } from "react-router";
import { useUser } from "../../hooks/use-user.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { CreateOrganizationDialog } from "./create-team-dialog.tsx";
import { InviteTeamMembersDialog } from "../common/invite-team-members-dialog.tsx";
import { type Theme, type View, withDefaultViews } from "@deco/sdk";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";

export interface CurrentTeam {
  avatarUrl: string | undefined;
  slug: string;
  id: number | string;
  label: string;
  theme: Theme | undefined;
}

function useUserTeam(): CurrentTeam & { views: View[] } {
  const user = useUser();
  const avatarUrl = user?.metadata?.avatar_url ?? undefined;
  const name = user?.metadata?.full_name || user?.email;
  const label = `${name.split(" ")[0]}'s team`;
  return {
    avatarUrl,
    label,
    id: user?.id ?? "",
    slug: "",
    theme: undefined,
    views: withDefaultViews([]),
  };
}

export function useCurrentTeam(): CurrentTeam & { views: View[] } {
  const { org } = useParams();
  const userTeam = useUserTeam();
  const { data: teamData } = useTeam(org);
  if (!org) {
    return userTeam;
  }

  return {
    avatarUrl: teamData?.avatar_url,
    label: teamData?.name || org || "",
    id: teamData?.id ?? "",
    slug: teamData?.slug ?? org ?? "",
    theme: teamData?.theme,
    views: withDefaultViews(teamData?.views ?? []),
  };
}

export function useUserTeams() {
  const { data: teams } = useTeams();
  const personalTeam = useUserTeam();
  const { slug: currentSlug } = useCurrentTeam();

  const allTeams: CurrentTeam[] = [
    personalTeam,
    ...teams.map((team) => ({
      avatarUrl: team.avatar_url,
      slug: team.slug,
      label: team.name,
      id: team.id,
      theme: team.theme,
    })),
  ];

  const teamsWithoutCurrentTeam = allTeams.filter(
    (team) => team.slug !== currentSlug,
  );

  return teamsWithoutCurrentTeam;
}

function CurrentTeamDropdownTrigger() {
  const { avatarUrl, label } = useCurrentTeam();

  return (
    <ResponsiveDropdownTrigger asChild>
      <SidebarMenuButton className="p-3 group-data-[collapsible=icon]:p-1! gap-3 md:pl-3.5">
        <Avatar
          shape="square"
          url={avatarUrl}
          fallback={label}
          objectFit="contain"
          size="xs"
        />
        <div className="flex items-center justify-start flex-1 min-w-0 gap-1">
          <span className="text-sm font-medium truncate min-w-0">{label}</span>
          <Icon
            name="unfold_more"
            className="text-muted-foreground"
            size={18}
          />
        </div>
      </SidebarMenuButton>
    </ResponsiveDropdownTrigger>
  );
}

function CurrentTeamDropdownOptions({
  onRequestInvite,
}: {
  onRequestInvite: () => void;
}) {
  const buildWorkspaceLink = useWorkspaceLink();

  return (
    <>
      <ResponsiveDropdownItem asChild>
        <Link
          to={buildWorkspaceLink("/settings")}
          className="w-full flex items-center gap-2 cursor-pointer"
        >
          <span className="grid place-items-center p-1">
            <Icon name="settings" size={18} className="text-muted-foreground" />
          </span>
          <span className="md:text-sm">Settings</span>
        </Link>
      </ResponsiveDropdownItem>
      <ResponsiveDropdownItem
        className="gap-2 cursor-pointer"
        onClick={(e) => {
          // Prevent event from bubbling up to parent elements
          e.stopPropagation();
          onRequestInvite();
        }}
      >
        <span className="grid place-items-center p-1">
          <Icon name="person_add" size={18} className="text-muted-foreground" />
        </span>
        <span className="md:text-sm flex-grow justify-self-start">
          Invite members
        </span>
      </ResponsiveDropdownItem>
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

function TeamsToSwitch({ query }: { query: string }) {
  const availableTeamsToSwitch = useUserTeams();

  const filteredTeams = availableTeamsToSwitch.filter(
    (team) =>
      team.label.toLowerCase().includes(query.toLowerCase()) ||
      team.slug?.toLowerCase().includes(query.toLowerCase()),
  );

  if (filteredTeams.length === 0) {
    return (
      <div className="text-sm text-center py-2 text-muted-foreground">
        No teams found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 h-36 overflow-y-auto">
      <div className="flex flex-col gap-2 h-36 overflow-y-auto">
        {filteredTeams.map((team) => (
          <ResponsiveDropdownItem asChild key={team.slug + team.label}>
            <Link
              to={`/${team.slug}`}
              className="w-full flex items-center gap-2 cursor-pointer"
            >
              <Avatar
                shape="square"
                url={team.avatarUrl}
                fallback={team.label}
                objectFit="contain"
                size="xs"
              />
              <span className="md:text-sm">{team.label}</span>
            </Link>
          </ResponsiveDropdownItem>
        ))}
      </div>
    </div>
  );
}

TeamsToSwitch.Skeleton = () => (
  <div className="h-36 flex flex-col gap-2 overflow-y-auto">
    {Array.from({ length: 3 }).map((_, index) => (
      <Skeleton key={index} className="h-9 w-full rounded-xl" />
    ))}
  </div>
);

function SwitchTeam({
  onRequestCreateTeam,
}: {
  onRequestCreateTeam: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

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
          <Icon name="search" size={18} className="text-muted-foreground" />
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

      <Suspense fallback={<TeamsToSwitch.Skeleton />}>
        <TeamsToSwitch query={searchQuery} />
      </Suspense>

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
          <Icon name="add" size={18} className="text-muted-foreground" />
        </span>
        <span className="md:text-sm">Create team</span>
      </ResponsiveDropdownItem>
    </>
  );
}

export function TeamSelector() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const { id: teamId, label, avatarUrl } = useCurrentTeam();

  useDocumentMetadata({
    title: label ? `${label} | deco CMS` : undefined,
    favicon: avatarUrl,
  });

  return (
    <>
      <ResponsiveDropdown>
        <Suspense fallback={<CurrentTeamDropdownTrigger />}>
          <CurrentTeamDropdownTrigger />
        </Suspense>
        <ResponsiveDropdownContent align="start" className="md:w-[240px]">
          <ResponsiveDropdownItem asChild>
            <Link
              to="/"
              className="w-full flex items-center gap-2 cursor-pointer"
            >
              <span className="grid place-items-center p-1">
                <Icon name="home" size={18} className="text-muted-foreground" />
              </span>
              <span className="md:text-sm">Home</span>
            </Link>
          </ResponsiveDropdownItem>
          <Suspense fallback={<CurrentTeamDropdownOptions.Skeleton />}>
            <CurrentTeamDropdownOptions
              onRequestInvite={() => setIsInviteDialogOpen(true)}
            />
          </Suspense>
          <ResponsiveDropdownSeparator />
          <SwitchTeam onRequestCreateTeam={() => setIsCreateDialogOpen(true)} />
        </ResponsiveDropdownContent>
      </ResponsiveDropdown>
      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
      <InviteTeamMembersDialog
        teamId={typeof teamId === "number" ? teamId : undefined}
        open={isInviteDialogOpen}
        onOpenChange={setIsInviteDialogOpen}
      />
    </>
  );
}
