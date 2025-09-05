import {
  DecoQueryClientProvider,
  Team,
  useTeamMembers,
  useTeams,
} from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Link } from "react-router";
import { Avatar } from "./common/avatar";
import { Suspense, useState } from "react";
import { DecoDayBanner } from "./common/event/deco-day";
import { ErrorBoundary } from "../error-boundary";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter as SidebarFooterInner,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarProvider,
} from "@deco/ui/components/sidebar.tsx";
import { LoggedUser } from "./sidebar/footer";
import { useLocalStorage } from "../hooks/use-local-storage";

function HomeProviders({ children }: { children: React.ReactNode }) {
  return <DecoQueryClientProvider>{children}</DecoQueryClientProvider>;
}

function Avatars({ teamId }: { teamId: number }) {
  const members = useTeamMembers(teamId ?? null);
  return (
    <div className="flex items-center">
      {members.data.members.slice(0, 4).map((member) => (
        <Avatar
          key={member.id}
          url={member.profiles.metadata.avatar_url}
          fallback={member.profiles.metadata.full_name}
          shape="circle"
          className="w-6 h-6 border border-border -ml-2 first:ml-0"
          size="sm"
        />
      ))}
    </div>
  );
}

Avatars.Skeleton = () => (
  <div className="flex items-center">
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse" />
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse -ml-2" />
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse -ml-2" />
    <div className="h-6 w-6 bg-stone-200 rounded-full animate-pulse -ml-2" />
  </div>
);

const MemberCount = ({ teamId }: { teamId: number }) => {
  const members = useTeamMembers(teamId ?? null);
  return <div className="text-xs">{members.data.members.length} members</div>;
};

MemberCount.Skeleton = () => (
  <div className="h-4 w-8 bg-stone-200 rounded-md animate-pulse" />
);

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
      <div className="p-4 border-t border-border flex justify-between items-center">
        <ErrorBoundary fallback={<div className="w-full h-8"></div>}>
          <Suspense fallback={<Avatars.Skeleton />}>
            <Avatars teamId={teamId} />
          </Suspense>
          <Suspense fallback={<MemberCount.Skeleton />}>
            <MemberCount teamId={teamId} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </Link>
  );
}

function Projects({ query }: { query?: string }) {
  const teams = useTeams({ searchQuery: query });

  if (teams.data?.length === 0) {
    return <Projects.Empty />;
  }

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {teams.data?.map((team) => (
        <ProjectCard
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

Projects.Skeleton = () => (
  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-8">
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

function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="flex w-full h-full items-start bg-background">
      <div className="p-8 flex flex-col gap-4 w-full">
        <DecoDayBanner />
        <div className="flex flex-col gap-4">
          <Input
            className="max-w-xs"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="overflow-y-auto max-h-[calc(100vh-12rem)] pb-8">
          <ErrorBoundary fallback={<Projects.Error />}>
            <Suspense fallback={<Projects.Skeleton />}>
              <Projects query={searchQuery} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}

function HomeLayout({ children }: { children: React.ReactNode }) {
  const { value: defaultOpen, update: setDefaultOpen } = useLocalStorage({
    key: "deco-chat-sidebar",
    defaultValue: true,
  });
  const [open, setOpen] = useState(defaultOpen);

  return (
    <SidebarProvider
      open={open}
      onOpenChange={(open) => {
        setDefaultOpen(open);
        setOpen(open);
      }}
      className="h-full bg-sidebar"
      style={
        {
          "--sidebar-width": "16rem",
          "--sidebar-width-mobile": "14rem",
        } as Record<string, string>
      }
    >
      <Sidebar variant="sidebar">
        <SidebarContent>
          <SidebarFooterInner>
            <SidebarMenu>
              <SidebarMenuItem>
                <LoggedUser />
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooterInner>
        </SidebarContent>
      </Sidebar>
      <SidebarInset className="h-full flex-col bg-sidebar">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function HomeWrapper() {
  return (
    <HomeProviders>
      <HomeLayout>
        <Home />
      </HomeLayout>
    </HomeProviders>
  );
}
