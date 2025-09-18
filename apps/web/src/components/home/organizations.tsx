// deno-lint-ignore-file ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
import { useOrganizations, useRecentProjects } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Suspense, useState } from "react";
import { Link } from "react-router";
import { ErrorBoundary } from "../../error-boundary";
import { Avatar } from "../common/avatar";
import { timeAgo } from "../../utils/time-ago";
import { BountiesBanner } from "../common/event/bounties-banner";
import { OrgAvatars, OrgMemberCount } from "./members";
import { Button } from "@deco/ui/components/button.tsx";
import { CreateOrganizationDialog } from "../sidebar/create-team-dialog";
import { TopbarLayout } from "../layout/home";

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
      className="bg-stone-50 hover:bg-stone-100 transition-colors flex flex-col rounded-lg border border-border"
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
          <h3 className="text-sm text-muted-foreground truncate">/{slug}</h3>
          <p className="font-medium truncate">{name}</p>
        </div>
      </div>
      <div className="p-4 border-t border-border flex justify-between items-center">
        <ErrorBoundary fallback={<div className="w-full h-8"></div>}>
          <OrgAvatars teamId={teamId} />
          <OrgMemberCount teamId={teamId} />
        </ErrorBoundary>
      </div>
    </Link>
  );
}

function Organizations({ query }: { query?: string }) {
  const teams = useOrganizations({ searchQuery: query });

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

function RecentProjectsSection() {
  const recent = useRecentProjects();

  if (recent?.length === 0) {
    return null;
  }

  return (
    <div className="@container flex flex-col gap-4">
      <h2 className="text-xl font-medium">Recent projects</h2>
      <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
        {recent.map((project) => (
          <Link
            key={`${project.org.slug}/${project.slug}`}
            to={`/${project.org.slug}/${project.slug}`}
            className="bg-stone-50 hover:bg-stone-100 transition-colors flex flex-col rounded-lg border border-border"
          >
            <div className="p-4 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <Avatar
                  url={project.avatar_url || project.org.avatar_url || ""}
                  fallback={project.org.slug}
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
                <h3 className="text-sm text-muted-foreground truncate">
                  /{project.org.slug}/{project.slug}
                </h3>
                <p className="font-medium truncate">{project.title}</p>
                {project.last_accessed_at && (
                  <span className="text-xs text-muted-foreground">
                    Last accessed {timeAgo(project.last_accessed_at)}
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

RecentProjectsSection.Skeleton = () => (
  <div className="@container flex flex-col gap-4">
    <div className="h-6 w-40 bg-stone-100 rounded animate-pulse" />
    <div className="grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className="bg-stone-50 flex flex-col rounded-lg border border-border"
        >
          <div className="p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div className="h-12 w-12 bg-stone-100 rounded-lg animate-pulse" />
              <div className="h-5 w-5 bg-stone-100 rounded animate-pulse" />
            </div>
            <div className="h-4 w-40 bg-stone-100 rounded animate-pulse" />
            <div className="h-4 w-48 bg-stone-100 rounded animate-pulse" />
            <div className="h-3 w-32 bg-stone-100 rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

function MyOrganizations() {
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="flex w-full h-full items-start bg-background">
      <div className="p-8 flex flex-col gap-4 w-full">
        <BountiesBanner />
        <ErrorBoundary fallback={null}>
          <Suspense fallback={<RecentProjectsSection.Skeleton />}>
            <RecentProjectsSection />
          </Suspense>
        </ErrorBoundary>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">My organizations</h2>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Button
              variant="special"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <Icon name="add" size={16} />
              <span>New organization</span>
            </Button>
          </div>
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

export function OrgList() {
  return (
    <TopbarLayout breadcrumb={[{ label: "Organizations", link: "/" }]}>
      <MyOrganizations />
    </TopbarLayout>
  );
}
