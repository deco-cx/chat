import {
  type Agent,
  type Member,
  useAgents,
  useTeamMembersBySlug,
  useUsagePerAgent,
  useUsagePerTool,
  useUsagePerThread,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@deco/ui/components/chart.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { Label, Pie, PieChart } from "recharts";
import { useUser } from "../../hooks/use-user.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { UserAvatar } from "../common/avatar/user.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";

function color(id: string) {
  const colors = [
    "#FF6B6B", // coral red
    "#4ECDC4", // turquoise
    "#45B7D1", // sky blue
    "#96CEB4", // sage green
    "#FFEEAD", // cream
    "#D4A5A5", // dusty rose
    "#9B59B6", // purple
    "#3498DB", // blue
    "#E67E22", // orange
    "#2ECC71", // emerald
    "#F1C40F", // yellow
    "#1ABC9C", // teal
    "#E74C3C", // red
    "#34495E", // navy
    "#16A085", // green
    "#D35400", // dark orange
    "#8E44AD", // violet
    "#2980B9", // dark blue
    "#27AE60", // forest green
    "#C0392B", // burgundy
  ];

  // Use the first part of the ID as a seed for consistent colors
  const seed = id.split("-")[0];
  const hash = seed.split("").reduce(
    (acc, char) => acc + char.charCodeAt(0),
    0,
  );
  return colors[hash % colors.length];
}

export function EmptyStateCard(
  { title, description }: { title: string; description: string },
) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full py-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon name="query_stats" size={24} className="text-muted-foreground" />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground text-center max-w-[200px]">
        {description}
      </p>
    </div>
  );
}

function CreditsUsedPerAgentCard({
  agents: workspaceAgents,
}: {
  agents: ReturnType<typeof useAgents>;
}) {
  const [range, setRange] = useState<"day" | "week" | "month">("month");
  const withWorkpaceLink = useWorkspaceLink();
  const usage = useUsagePerAgent({ range });

  const total = usage.total;
  const enrichedAgents = usage.items.map((_agent) => {
    const agent = workspaceAgents.data?.find((a) => a.id === _agent.id);
    return {
      id: _agent.id,
      total: _agent.total,
      avatar: agent?.avatar,
      label: agent?.name || _agent.label || _agent.id,
      color: color(_agent.id),
    };
  }).sort((a, b) => b.total - a.total);

  if (enrichedAgents.length === 0) {
    return (
      <Card className="bg-background w-full md:max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border-none">
        <div className="w-full text-sm mb-8 flex justify-between items-center">
          <span>Credits Used Per Agent</span>
          <div className="flex items-center gap-2">
            <Select
              value={range}
              onValueChange={(value: "day" | "week" | "month") =>
                setRange(value)}
            >
              <SelectTrigger className="!h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day" className="text-xs">Today</SelectItem>
                <SelectItem value="week" className="text-xs">
                  This Week
                </SelectItem>
                <SelectItem value="month" className="text-xs">
                  This Month
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <EmptyStateCard
          title="No usage data"
          description="There hasn't been any agent usage during this time period."
        />
      </Card>
    );
  }

  const chartConfig = Object.fromEntries(
    enrichedAgents.map((agent) => [
      agent.id,
      {
        label: agent.label,
        color: agent.color,
      },
    ]),
  ) satisfies ChartConfig;

  const agentsChartData = enrichedAgents.map((agent) => ({
    agentId: agent.id,
    total: agent.total,
    fill: agent.color,
  }));

  return (
    <Card className="bg-background w-full md:max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border-none">
      <div className="w-full text-sm mb-8 flex justify-between items-center">
        <span>Credits Used Per Agent</span>
        <div className="flex items-center gap-2">
          <Select
            value={range}
            onValueChange={(value: "day" | "week" | "month") => setRange(value)}
          >
            <SelectTrigger className="!h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day" className="text-xs">Today</SelectItem>
              <SelectItem value="week" className="text-xs">
                This Week
              </SelectItem>
              <SelectItem value="month" className="text-xs">
                This Month
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <CardContent className="flex flex-row items-center justify-center gap-8 w-full pb-0">
        <div className="flex-shrink-0">
          <ChartContainer
            config={chartConfig}
            style={{
              width: "250px",
              height: "200px",
            }}
            className="mx-auto aspect-square max-h-[250px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel labelKey="label" />}
              />
              <Pie
                data={agentsChartData}
                dataKey="total"
                nameKey="agentId"
                innerRadius={47.5}
              >
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                      return (
                        <text
                          x={viewBox.cx}
                          y={viewBox.cy}
                          textAnchor="middle"
                          dominantBaseline="middle"
                        >
                          <tspan
                            x={viewBox.cx}
                            y={viewBox.cy}
                            className="fill-foreground text-lg"
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={viewBox.cx}
                            y={(viewBox.cy || 0) + 18}
                            className="fill-muted-foreground text-[10px]"
                          >
                            Total
                          </tspan>
                        </text>
                      );
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        </div>
        <ul className="flex flex-col overflow-y-auto max-h-[200px] gap-4 min-w-[180px]">
          {enrichedAgents.map((agent) => (
            <li key={agent.id} className="flex items-center gap-2">
              <Link
                to={withWorkpaceLink(
                  `/agent/${agent.id}/${crypto.randomUUID()}`,
                )}
              >
                <div className="flex items-center gap-2 hover:underline">
                  <span
                    className="inline-block w-3 h-3 rounded-full"
                    style={{ backgroundColor: agent.color }}
                  />
                  {agent.avatar && (
                    <img
                      src={agent.avatar}
                      alt={agent.label}
                      className="w-5 h-5 rounded-sm object-cover border border-muted"
                    />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {agent.label}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

CreditsUsedPerAgentCard.Fallback = () => (
  <Card className="bg-background w-full max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border-none">
    <div className="w-full text-sm mb-8 flex justify-between items-center">
      <span>Credits Used Per Agent</span>
    </div>
    <CardContent className="flex flex-row items-center justify-center gap-8 w-full pb-0">
      <Skeleton className="w-full h-[250px]" />
    </CardContent>
  </Card>
);

function CreditsUsedPerThread({
  agents: workspaceAgents,
  teamMembers,
}: {
  agents: ReturnType<typeof useAgents>;
  teamMembers: Member[];
}) {
  const withWorkpaceLink = useWorkspaceLink();
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const threads = useUsagePerThread({ range });

  const enrichedThreads = threads.items.map((thread) => {
    const agent = workspaceAgents.data?.find((a) => a.id === thread.agentId);
    const member = teamMembers.find((m) => m.user_id === thread.generatedBy);
    return {
      agent,
      member,
      ...thread,
    };
  });

  return (
    <Card className="bg-background w-full h-full flex flex-col rounded-md border-none gap-0">
      <div className="w-full text-sm p-4 border-b border-border flex justify-between items-center">
        <span>Credits Used Per Thread</span>
        <Select
          value={range}
          onValueChange={(value: "day" | "week" | "month") => setRange(value)}
        >
          <SelectTrigger className="!h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day" className="text-xs">Today</SelectItem>
            <SelectItem value="week" className="text-xs">This Week</SelectItem>
            <SelectItem value="month" className="text-xs">
              This Month
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-8 pt-3">
        {enrichedThreads.length === 0
          ? (
            <EmptyStateCard
              title="No thread data"
              description="There haven't been any threads created during this time period."
            />
          )
          : (
            enrichedThreads.map((thread) => (
              <Dialog key={thread.id}>
                <DialogTrigger asChild>
                  <div className="flex items-center justify-between p-4 mb-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <AgentAvatar
                        url={thread.agent?.avatar}
                        fallback={thread.agent?.name}
                        size="base"
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-foreground">
                          {thread.agent?.name || "Unknown Agent"}
                        </span>
                        <div className="flex items-center gap-2">
                          <UserAvatar
                            url={thread.member?.profiles?.metadata?.avatar_url}
                            fallback={thread.member?.profiles?.metadata
                              ?.full_name || "User"}
                            size="xs"
                          />
                          <span className="text-xs text-muted-foreground">
                            {thread.member?.profiles?.metadata?.full_name ||
                              "Unknown User"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {thread.total}
                      </span>
                    </div>
                  </div>
                </DialogTrigger>
                <ThreadDetails
                  thread={thread}
                  withWorkpaceLink={withWorkpaceLink}
                />
              </Dialog>
            ))
          )}
      </div>
    </Card>
  );
}

CreditsUsedPerThread.Fallback = () => (
  <Card className="bg-background w-full h-full flex flex-col rounded-md border-none gap-0">
    <div className="w-full text-sm p-4 border-b border-border flex justify-between items-center">
      <span>Credits Used Per Thread</span>
    </div>
    <CardContent className="flex flex-col items-center justify-center gap-2 p-3 overflow-y-auto">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="w-full h-[72px] bg-muted rounded-md" />
      ))}
    </CardContent>
  </Card>
);


function CreditsUsedPerTool({
}: {
}) {
  const [range, setRange] = useState<"day" | "week" | "month">("week");
  const tools = useUsagePerTool({ range });

  const enrichedTools = tools.items.map((tool) => {
    return {
      ...tool,
    };
  });

  return (
    <Card className="bg-background w-full h-full flex flex-col rounded-md border-none gap-0">
      <div className="w-full text-sm p-4 border-b border-border flex justify-between items-center">
        <span>Credits Used Per Tool</span>
        <Select
          value={range}
          onValueChange={(value: "day" | "week" | "month") => setRange(value)}
        >
          <SelectTrigger className="!h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day" className="text-xs">Today</SelectItem>
            <SelectItem value="week" className="text-xs">This Week</SelectItem>
            <SelectItem value="month" className="text-xs">
              This Month
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-8 pt-3">
        {enrichedTools.length === 0
          ? (
            <EmptyStateCard
              title="No tool data"
              description="There haven't been any tools used during this time period."
            />
          )
          : (
            enrichedTools.map((tool) => (
              <Dialog key={tool.id}>
                <DialogTrigger asChild>
                  <div className="flex items-center justify-between p-4 mb-2 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col gap-1">
                        <span>
                          {tool.id}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {tool.toolId}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {tool.total}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        {tool.total}
                      </span>
                    </div>
                  </div>
                </DialogTrigger>
              </Dialog>
            ))
          )}
      </div>
    </Card>
  );
}

CreditsUsedPerTool.Fallback = () => (
  <Card className="bg-background w-full h-full flex flex-col rounded-md border-none gap-0">
    <div className="w-full text-sm p-4 border-b border-border flex justify-between items-center">
      <span>Credits Used Per Tool</span>
    </div>
    <CardContent className="flex flex-col items-center justify-center gap-2 p-3 overflow-y-auto">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="w-full h-[72px] bg-muted rounded-md" />
      ))}
    </CardContent>
  </Card>
);

interface ThreadDetailsProps {
  thread: {
    agent?: Agent;
    member?: Member;
    id: string;
    total: string;
    tokens?: {
      totalTokens: number;
      promptTokens: number;
      completionTokens: number;
    };
  };
  withWorkpaceLink: (path: string) => string;
}

function ThreadDetails({ thread, withWorkpaceLink }: ThreadDetailsProps) {
  return (
    <DialogContent className="sm:max-w-[400px] p-6">
      <DialogHeader>
        <DialogTitle>Thread Details</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <AgentAvatar
            url={thread.agent?.avatar}
            fallback={thread.agent?.name}
            size="lg"
          />
          <div className="flex flex-col justify-center">
            <span className="text-base font-semibold text-foreground">
              {thread.agent?.name || "Unknown Agent"}
            </span>
            <span className="text-sm text-muted-foreground mt-1">
              {thread.total} credits used
            </span>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground mb-1">
            User
          </span>
          <div className="flex items-center gap-3">
            <UserAvatar
              url={thread.member?.profiles?.metadata?.avatar_url}
              fallback={thread.member?.profiles?.metadata?.full_name || "User"}
              size="sm"
            />
            <span className="text-sm text-foreground">
              {thread.member?.profiles?.metadata?.full_name || "Unknown User"}
            </span>
          </div>
        </div>

        <div className="border-t border-border" />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground mb-1">
            Token Usage
          </span>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {thread.tokens?.totalTokens || 0}
              </span>
              <span className="text-xs text-muted-foreground">Total</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {thread.tokens?.promptTokens || 0}
              </span>
              <span className="text-xs text-muted-foreground">Prompt</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {thread.tokens?.completionTokens || 0}
              </span>
              <span className="text-xs text-muted-foreground">Completion</span>
            </div>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="mt-2 w-full justify-center"
        >
          <Link
            to={withWorkpaceLink(`/audit/${thread.id}`)}
          >
            <Icon name="open_in_new" size={16} />
            View messages
          </Link>
        </Button>
      </div>
    </DialogContent>
  );
}

function userToMember(user: ReturnType<typeof useUser>): Member {
  return {
    id: -1,
    user_id: user.id,
    profiles: {
      email: user.email,
      id: user.id,
      is_anonymous: false,
      metadata: user.metadata,
      phone: user.phone,
    },
    roles: [],
    created_at: "",
    lastActivity: "",
  };
}

function useMembers() {
  const { teamSlug } = useParams();
  const { data: { members: _members } } = useTeamMembersBySlug(
    teamSlug ?? null,
  );
  const user = useUser();

  const members = useMemo(() => {
    // if no members, it is the personal workspace of the user
    // so we just format the current user to a Member
    return _members?.length ? _members : [userToMember(user)];
  }, [_members]);

  return members;
}

export default function Usage() {
  const _agents = useAgents();
  const agents = {
    ..._agents,
    data: _agents.data.concat([
      WELL_KNOWN_AGENTS.teamAgent,
      WELL_KNOWN_AGENTS.setupAgent,
    ]),
  };
  const members = useMembers();

  return (
    <div className="h-full text-foreground bg-background">
      <div className="flex flex-col items-center h-full gap-4 w-full">
        <div className="w-full h-full max-h-[400px]">
          <Suspense fallback={<CreditsUsedPerTool.Fallback />}>
            <CreditsUsedPerTool />
          </Suspense>
        </div>
        <div className="w-full flex items-center justify-center">
          <Suspense fallback={<CreditsUsedPerAgentCard.Fallback />}>
            <CreditsUsedPerAgentCard agents={agents} />
          </Suspense>
        </div>
        <div className="w-full h-full max-h-[400px]">
          <Suspense fallback={<CreditsUsedPerThread.Fallback />}>
            <CreditsUsedPerThread agents={agents} teamMembers={members} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
