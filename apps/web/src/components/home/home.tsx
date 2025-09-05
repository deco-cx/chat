import { useTeams } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Suspense, useState } from "react";
import { Link } from "react-router";
import { ErrorBoundary } from "../../error-boundary";
import { Avatar } from "../common/avatar";
import { DecoDayBanner } from "../common/event/deco-day";
import { OrgAvatars, OrgMemberCount } from "./members";
import { DefaultBreadcrumb, PageLayout } from "../layout/project";
import { Button } from "@deco/ui/components/button.tsx";
import { CreateOrganizationDialog } from "../sidebar/create-team-dialog";

function OrganizationCard({
  name,
  slug,
  url,
  avatarUrl,
  teamId,
}: {
  name: string;
  slug: string;
  url: string;
  avatarUrl: string;
  teamId: number;
}) {
  return (
    <Link
      to={url}
      className="bg-stone-50 hover:bg-stone-100 transition-colors flex flex-col rounded-lg"
    >
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <Avatar
            url={avatarUrl}
            fallback={slug}
            size="lg"
            objectFit="contain"
          />
          <Icon
            name="chevron_right"
            size={20}
            className="text-muted-foreground"
          />
        </div>
        <div className="flex flex-col gap-[2px]">
          <h3 className="text-sm text-muted-foreground">@{slug}</h3>
          <p className="font-medium">{name}</p>
        </div>
      </div>
      <div className="p-4 border-t border-border flex justify-between items-center">
        <ErrorBoundary fallback={<div className="w-full h-8"></div>}>
          <Suspense fallback={<OrgAvatars.Skeleton />}>
            <OrgAvatars teamId={teamId} />
          </Suspense>
          <Suspense fallback={<OrgMemberCount.Skeleton />}>
            <OrgMemberCount teamId={teamId} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </Link>
  );
}

function Organizations({ query }: { query?: string }) {
  const teams = useTeams({ searchQuery: query });

  if (teams.data?.length === 0) {
    return <Organizations.Empty />;
  }

  return (
    <div className="w-full grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
      {teams.data?.map((team) => (
        <OrganizationCard
          key={team.id}
          name={team.name}
          slug={team.slug}
          url={`/${team.slug}`}
          avatarUrl={team.avatar_url || ""}
          teamId={team.id}
        />
      ))}
    </div>
  );
}

Organizations.Skeleton = () => (
  <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
    {Array.from({ length: 8 }).map((_, index) => (
      <div
        key={index}
        className="bg-stone-50 hover:bg-stone-100 transition-colors flex flex-col rounded-lg animate-pulse"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="h-12 w-12 bg-stone-100 rounded-lg"></div>
          <div className="h-4 w-32 bg-stone-100 rounded-lg"></div>
          <div className="h-4 w-32 bg-stone-100 rounded-lg"></div>
        </div>
        <div className="p-4 border-t border-border flex items-center">
          <div className="h-6 w-6 bg-stone-100 rounded-full animate-pulse"></div>
          <div className="h-6 w-6 bg-stone-100 rounded-full animate-pulse -ml-2"></div>
          <div className="h-6 w-6 bg-stone-100 rounded-full animate-pulse -ml-2"></div>
        </div>
      </div>
    ))}
  </div>
);

Organizations.Error = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8">
    <Icon name="error" size={24} className="text-muted-foreground" />
    <div className="text-sm text-muted-foreground text-center">
      We couldn't load your projects right now.
      <br />
      Please try again later.
    </div>
  </div>
);

Organizations.Empty = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8 w-full">
    <div className="text-sm text-muted-foreground text-center">
      No projects found.
    </div>
  </div>
);

function MyOrganizations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="flex w-full h-full items-start bg-background">
      <div className="p-8 flex flex-col gap-4 w-full">
        <DecoDayBanner />
        <div className="flex items-center justify-between">
          <Input
            className="max-w-xs"
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button variant="special" onClick={() => setIsCreateDialogOpen(true)}>
            <Icon name="add" size={16} />
            <span>New organization</span>
          </Button>
        </div>
        <div className="@container overflow-y-auto max-h-[calc(100vh-12rem)] pb-28">
          <ErrorBoundary fallback={<Organizations.Error />}>
            <Suspense fallback={<Organizations.Skeleton />}>
              <Organizations query={searchQuery} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>

      <CreateOrganizationDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
}

export function Home() {
  return (
    <PageLayout
      hideViewsButton
      tabs={{
        myOrganizations: {
          title: "My Organizations",
          Component: MyOrganizations,
          initialOpen: true,
        },
      }}
      breadcrumb={
        <DefaultBreadcrumb
          items={[{ label: "My Organizations", link: "/" }]}
          useWorkspaceLink={false}
        />
      }
    />
  );
}
