import { SettingsMobileHeader } from "./SettingsMobileHeader.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useCurrentTeam } from "../sidebar/TeamSelector.tsx";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@deco/ui/components/chart.tsx";
import { Label, Pie, PieChart } from "recharts";
import { DepositDialog } from "../wallet/DepositDialog.tsx";
import { getWalletAccount } from "@deco/sdk";
import { useQuery } from "@tanstack/react-query";


function AccountBalance({ workspace }: { workspace: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["wallet"],
    queryFn: () => getWalletAccount(workspace),
  });

  if (isLoading) return <Skeleton className="w-32 h-12" />;
  if (error) return <p>Error loading wallet</p>;

  return <p className="text-5xl font-bold">{data?.balance}</p>;
}

function BalanceCard() {
  const team = useCurrentTeam();
  
  return (
    <Card className="w-full max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
      <div className="w-full text-sm mb-8">
        AI Usage Wallet
      </div>
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <div className="flex items-center gap-1 text-base mb-1">
          {team.label}
          <Icon
            name="visibility"
            size={18}
            className="ml-1 align-middle text-muted-foreground"
          />
        </div>
        <div className="mb-6">
          <AccountBalance workspace="/shared/deco.cx" />
        </div>
        <DepositDialog />
      </CardContent>
    </Card>
  );
}

interface Agent {
  label: string;
  color: string;
  value: number;
  iconUrl?: string;
}

interface CreditsUsedPerAgentCardProps {
  agents: Agent[];
  total: number;
  title?: string;
}

function CreditsUsedPerAgentCard(
  { agents, total, title = "Credits Used Per Agent" }:
    CreditsUsedPerAgentCardProps,
) {
  const chartConfig = Object.fromEntries(
    agents.map((agent, idx) => [
      `agent${idx}`,
      { label: agent.label, color: agent.color },
    ]),
  ) satisfies ChartConfig;

  const agentsChartData = agents.map((agent, idx) => ({
    browser: `agent${idx}`,
    visitors: agent.value,
    fill: agent.color,
  }));

  return (
    <Card className="w-full max-w-xl p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
      <div className="w-full text-sm mb-8">
        {title}
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
                content={<ChartTooltipContent hideLabel />}
              />
              <Pie
                data={agentsChartData}
                dataKey="visitors"
                nameKey="browser"
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
                            ${total}
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
        <ul className="flex flex-col gap-4 min-w-[180px]">
          {agents.map((agent, idx) => (
            <li key={agent.label} className="flex items-center gap-2">
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: agent.color }}
              />
              {agent.iconUrl && (
                <img
                  src={agent.iconUrl}
                  alt={agent.label}
                  className="w-5 h-5 rounded-sm object-cover border border-muted"
                />
              )}
              <span className="text-xs text-muted-foreground">
                {agent.label}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function CreditsUsedPerThread() {
  return (
    <Card className="w-full p-4 flex flex-col items-center rounded-md min-h-[340px] border border-slate-200">
      <div className="w-full text-sm mb-8">
        Credits Used Per Thread
      </div>
    </Card>
  );
}
export default function BillingSettings() {
  const agents = [
    {
      label: "Internal Rituals Agent",
      color: "#6D6DFF",
      value: 120,
      iconUrl: "https://assets.webdraw.app/uploads/capy-38.png",
    },
    {
      label: "HR Assistant",
      color: "#7ED6A2",
      value: 80,
      iconUrl: "https://assets.webdraw.app/uploads/capy-34.png",
    },
    {
      label: "Brandable",
      color: "#F48C8C",
      value: 180,
      iconUrl: "https://assets.webdraw.app/uploads/capy-37.png",
    },
    {
      label: "Research Buddy",
      color: "#B6E388",
      value: 60,
      iconUrl: "https://assets.webdraw.app/uploads/capy-36.png",
    },
    {
      label: "Onboarding Coach",
      color: "#FFD36E",
      value: 45,
      iconUrl: "https://assets.webdraw.app/uploads/capy-35.png",
    },
  ];
  const total = agents.reduce((sum, agent) => sum + agent.value, 0);

  return (
    <div className="h-full text-slate-700">
      <SettingsMobileHeader currentPage="billing" />
      <div className="flex gap-4 p-4">
        <div className="flex flex-col justify-center gap-4 max-w-4xl">
          <BalanceCard />
          <CreditsUsedPerAgentCard agents={agents} total={total} />
        </div>
        <CreditsUsedPerThread />
      </div>
    </div>
  );
}
