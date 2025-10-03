import { useProjects } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense, useState, useDeferredValue } from "react";
import { Link, useParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary";
import { Avatar } from "../common/avatar";
import { WorkshopOct16Banner } from "../common/event/workshop-oct16";
import { OrgAvatars, OrgMemberCount } from "./members";

function ProjectCard({
  name,
  slug,
  url,
  avatarUrl,
  teamId,
  slugPrefix = "@",
  showMembers = true,
  additionalInfo,
  hideSlug = false,
}: {
  name: string;
  slug: string;
  url: string;
  avatarUrl: string;
  teamId?: number;
  slugPrefix?: string;
  showMembers?: boolean;
  additionalInfo?: string;
  hideSlug?: boolean;
}) {
  return (
    <Link
      to={url}
      className="group bg-card hover:bg-accent transition-colors flex flex-col rounded-lg"
    >
      <div className="p-4 flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <Avatar
            url={avatarUrl}
            fallback={name || slug}
            size="lg"
            objectFit="contain"
          />
          <Icon
            name="chevron_right"
            size={20}
            className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
        <div className="flex flex-col gap-[2px]">
          {!hideSlug && (
            <h3 className="text-sm text-muted-foreground truncate">
              {slugPrefix}
              {slug}
            </h3>
          )}
          <p className="font-medium truncate">{name}</p>
          {additionalInfo && (
            <span className="text-xs text-muted-foreground">
              {additionalInfo}
            </span>
          )}
        </div>
      </div>
      {/* Show organization members on the project card for now */}
      {showMembers && typeof teamId === "number" && (
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
      )}
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
        className="bg-card hover:bg-accent transition-colors flex flex-col rounded-lg animate-pulse"
      >
        <div className="p-4 flex flex-col gap-4">
          <div className="h-12 w-12 bg-card rounded-lg"></div>
          <div className="h-4 w-32 bg-card rounded-lg"></div>
          <div className="h-4 w-32 bg-card rounded-lg"></div>
        </div>
        <div className="p-4 border-t border-border flex items-center">
          <div className="h-6 w-6 bg-card rounded-full animate-pulse"></div>
          <div className="h-6 w-6 bg-card rounded-full animate-pulse -ml-2"></div>
          <div className="h-6 w-6 bg-card rounded-full animate-pulse -ml-2"></div>
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
  const deferredQuery = useDeferredValue(searchQuery);
  const { org } = useParams();

  return (
    <div className="min-h-full w-full bg-background">
      <div className="p-8 flex flex-col gap-4 w-full max-w-7xl mx-auto min-h-[calc(100vh-48px)]">
        <WorkshopOct16Banner />
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
        <div className="@container overflow-y-auto flex-1 pb-28">
          <ErrorBoundary fallback={<Projects.Error />}>
            <Suspense fallback={<Projects.Skeleton />}>
              <Projects query={deferredQuery} org={org ?? ""} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

export default OrgProjectListContent;
export { ProjectCard };
