import { DecoQueryClientProvider, Team, useTeams } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Link } from "react-router";
import { Avatar } from "./common/avatar";
import { Suspense } from "react";

function HomeLayout({ children }: { children: React.ReactNode }) {
  return <DecoQueryClientProvider>{children}</DecoQueryClientProvider>;
}

const DECO_DAY_START_DATE = new Date("2025-09-08T14:00:00");
const DECO_DAY_END_DATE = new Date("2025-09-08T18:00:00");

const getDecoDayState = (): "upcoming" | "active" | "past" => {
    const now = new Date();
    if (now < DECO_DAY_START_DATE) {
        return "upcoming";
    }
    if (now > DECO_DAY_END_DATE) {
        return "past";
    }
    return "active";
};

function DecoDayBanner() {
  const state = getDecoDayState();

  return (
    <div className="bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 py-2">
        <h1 className="text-2xl font-bold">Deco Day {state}</h1>
        <p className="text-sm">This is a test banner for the Deco Day event.</p>
      </div>
    </div>
  );
}

function Avatars({ team }: { team: Team }) {
    return null;
}

function ProjectCard({ name, slug, url, avatarUrl }: { name: string, slug: string, url: string, avatarUrl: string }) {
    return (
        <Link to={url} className="bg-stone-50 hover:bg-stone-100 transition-colors flex flex-col rounded-lg">
            <div className="p-4 flex flex-col gap-4">
                <div className="flex justify-between items-start">
                    <Avatar 
                        url={avatarUrl}
                        fallback={slug}
                        size="lg"
                    />
                    <Icon name="chevron_right" size={20} className="text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-[2px]">
                    <h3 className="text-sm text-muted-foreground">@{slug}</h3>
                    <p className="font-medium">{name}</p>
                </div>
            </div>
            <div className="p-4 border-t border-border">
                <Avatars />
            </div>
        </Link>
    );
}

function Projects() {
    const teams = useTeams();
    console.log(teams.data);
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-8">
            {teams.data?.map((team) => (
                <ProjectCard 
                  key={team.id} 
                  name={team.name} 
                  slug={team.slug} 
                  url={`/${team.slug}`} 
                  avatarUrl={team.avatar_url || ""} 
                />
            ))}
        </div>
    );
}

Projects.Skeleton = () => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-8">
        {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="bg-stone-50 hover:bg-stone-100 transition-colors flex flex-col rounded-lg animate-pulse">
                <div className="p-4 flex flex-col gap-4">
                    <div className="h-12 w-12 bg-stone-100 rounded-lg"></div>
                    <div className="h-4 w-32 bg-stone-100 rounded-lg"></div>
                    <div className="h-4 w-32 bg-stone-100 rounded-lg"></div>
                </div>
                <div className="p-4 border-t border-border">
                    <div className="h-6 w-6 bg-stone-100 rounded-full"></div>
                </div>
            </div>
        ))}
    </div>
  );
};

function Home() {
  return (
    <div>
      <DecoDayBanner />
      <h1>Home</h1>
      <Suspense fallback={<Projects.Skeleton />}>
        <Projects />
      </Suspense>
    </div>
  );
}

export default function HomeWrapper() {
  return (
    <HomeLayout>
      <Home />
    </HomeLayout>
  );
}
