// deno-lint-ignore-file ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
import { useOrganizations, useProjects } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary";
import { Button } from "@deco/ui/components/button.tsx";
import { Avatar } from "../common/avatar";
import { BountiesBanner } from "../common/event/bounties-banner";
import { OrgAvatars, OrgMemberCount } from "./members";
import { TopbarLayout } from "../layout/home";
import { Combobox } from "@deco/ui/components/combobox.tsx";

function ProjectCard({
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
      {/* Show organization members on the project card for now */}
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

function Projects({ query, org }: { query?: string; org: string }) {
  const projects = useProjects({ searchQuery: query, org });

  if (projects.length === 0) {
    return <Projects.Empty />;
  }

  return (
    <div className="w-full grid grid-cols-2 @min-3xl:grid-cols-3 @min-6xl:grid-cols-4 gap-4">
      {projects.map((project) => (
        <ProjectCard
          key={project.id}
          name={project.title}
          slug={project.slug}
          url={`/${project.org.slug}/${project.slug}`}
          avatarUrl={project.avatar_url || project.org.avatar_url || ""}
          teamId={project.org.id}
        />
      ))}
    </div>
  );
}

Projects.Skeleton = () => (
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

Projects.Error = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8">
    <Icon name="error" size={24} className="text-muted-foreground" />
    <div className="text-sm text-muted-foreground text-center">
      We couldn't load your projects right now.
      <br />
      Please try again later.
    </div>
  </div>
);

Projects.Empty = () => (
  <div className="flex flex-col items-center justify-center mt-64 gap-4 p-8 w-full">
    <div className="text-sm text-muted-foreground text-center">
      No projects found.
    </div>
  </div>
);

function OrgProjectListContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const { org } = useParams();

  return (
    <div className="flex w-full h-full items-start bg-background">
      <div className="p-8 flex flex-col gap-4 w-full">
        <BountiesBanner />
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-medium">Projects</h2>
          <div className="flex items-center gap-2">
            <Input
              className="max-w-xs"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Tooltip>
              <TooltipTrigger>
                <Button variant="special" disabled>
                  <Icon name="add" size={16} />
                  <span>New project</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Multiple projects in a single organization is coming soon</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="@container overflow-y-auto max-h-[calc(100vh-12rem)] pb-8">
          <ErrorBoundary fallback={<Projects.Error />}>
            <Suspense fallback={<Projects.Skeleton />}>
              <Projects query={searchQuery} org={org ?? ""} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function BreadcrumbOrgSwitcher() {
  const { org } = useParams();
  const organizations = useOrganizations();
  const navigate = useNavigate();

  const currentOrg = useMemo(
    () => organizations.data?.find((organization) => organization.slug === org),
    [organizations.data, org],
  );

  return (
    <Combobox
      options={organizations.data?.map((organization) => ({
        value: organization.slug,
        label: organization.name,
      }))}
      value={org ?? ""}
      onChange={(value) => {
        navigate(`/${value}`);
      }}
      renderTrigger={() => (
        <div className="flex items-center gap-2 cursor-pointer hover:bg-sidebar px-2 py-1 rounded-md">
          <Avatar
            url={currentOrg?.avatar_url}
            fallback={currentOrg?.name ?? org}
            size="xs"
            objectFit="contain"
          />
          <span>{currentOrg?.name ?? org}</span>
          <Icon name="expand_all" size={16} className="opacity-50" />
        </div>
      )}
      contentClassName="min-w-[200px]"
    />
  );
}

BreadcrumbOrgSwitcher.Skeleton = () => (
  <div className="h-4 w-16 bg-stone-100 rounded-full animate-pulse"></div>
);

export function OrgProjectList() {
  const { org } = useParams();

  return (
    <TopbarLayout
      breadcrumb={[
        { label: "Organizations", link: "/" },
        {
          label: (
            <Suspense fallback={<BreadcrumbOrgSwitcher.Skeleton />}>
              <BreadcrumbOrgSwitcher />
            </Suspense>
          ),
          link: `/${org}`,
        },
      ]}
    >
      <OrgProjectListContent />
    </TopbarLayout>
  );
}
