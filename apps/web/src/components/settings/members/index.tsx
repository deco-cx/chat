import { Suspense, useMemo, useState } from "react";
import { useTeam, useTeamMembers, useTeamRoles } from "@deco/sdk/hooks";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useCurrentTeam } from "../../sidebar/team-selector.tsx";
import { useUser } from "../../../hooks/use-user.ts";
import { ListPageHeader } from "../../common/list-page-header.tsx";
import { MembersTableView } from "./table.tsx";
import { RolesTableView } from "./roles.tsx";

// Components
function MembersViewLoading() {
  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex justify-center p-8">
        <Spinner />
        <span className="ml-2">Loading members...</span>
      </div>
    </div>
  );
}

function MembersViewContent() {
  const { slug } = useCurrentTeam();
  const { data: team } = useTeam(slug);
  const teamId = useMemo(() => team?.id, [team?.id]);
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const {
    data: { members },
  } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });

  // State management
  const [tab, setTab] = useState<"members" | "roles">("members");

  const user = useUser();

  // Memoized toggle items for stable references
  // Note: counts will be managed by child components
  const toggleItems = useMemo(
    () => [
      {
        id: "members",
        label: "Members",
        count: members.length,
        active: tab === "members",
      },
      {
        id: "roles",
        label: "Roles",
        count: roles.length,
        active: tab === "roles",
      },
    ],
    [tab, members.length, roles.length],
  );

  return (
    <div className="px-6 py-10 flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <ListPageHeader
          filter={{
            items: toggleItems,
            onClick: (item) => setTab(item.id as "members" | "roles"),
          }}
        />

        {tab === "members"
          ? <MembersTableView teamId={teamId} user={user} />
          : <RolesTableView teamId={teamId} />}
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
