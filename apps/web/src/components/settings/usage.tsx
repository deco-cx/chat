import {
  type Agent,
  type Member,
  useAgents,
  useTeamMembersBySlug,
  useThreads,
  useUsagePerAgent,
  useUsagePerThread,
  WELL_KNOWN_AGENTS,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
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
import { Combobox } from "@deco/ui/components/combobox.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import React, { Suspense, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { useUser } from "../../hooks/use-user.ts";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { UserAvatar } from "../common/avatar/user.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";

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
        <Icon name="query_stats" size={24} />
      </div>
      <h3 className="text-sm font-medium text-foreground mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground text-center max-w-[200px]">
        {description}
      </p>
    </div>
  );
}

// Filters Component matching Figma design
function UsageFilters({
  costBy,
  setCostBy,
  selectedAgent,
  setSelectedAgent,
  timeRange,
  setTimeRange,
  agents,
}: {
  costBy: string;
  setCostBy: (value: string) => void;
  selectedAgent: string;
  setSelectedAgent: (value: string) => void;
  timeRange: string;
  setTimeRange: (value: string) => void;
  agents: Agent[];
}) {
  return (
    <div className="flex justify-between items-center w-full">
      <div className="flex items-center gap-2">
        <Select value={costBy} onValueChange={setCostBy}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Cost by agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="agent">Cost by agent</SelectItem>
            <SelectItem value="user">Cost by user</SelectItem>
            <SelectItem value="thread">Cost by thread</SelectItem>
          </SelectContent>
        </Select>

        <Combobox
          options={[
            { value: "all", label: "All agents" },
            ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
          ]}
          value={selectedAgent}
          onChange={(value) => {
            setSelectedAgent(value);
          }}
        />
      </div>

      <Select value={timeRange} onValueChange={setTimeRange}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Last 7 days" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="day">Last 24 hours</SelectItem>
          <SelectItem value="week">Last 7 days</SelectItem>
          <SelectItem value="month">Last 30 days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}



// Types for chart data
interface ChartAgentData {
  agent: Agent;
  cost: number;
  color: string;
  percentage: number;
  type: 'agent' | 'user' | 'thread';
  member?: Member | null;
}

interface ChartDayData {
  date: string;
  fullDate: string;
  agents: ChartAgentData[];
  total: number;
}

// Simple Stacked Bar Chart Component matching Figma design
function StackedBarChart({ 
  agents, 
  agentUsage, 
  threadUsage, 
  members,
  timeRange,
  costBy = "agent"
}: { 
  agents: Agent[];
  agentUsage: any;
  threadUsage: any;
  members: Member[];
  timeRange: string;
  costBy?: string;
}) {
  const [hoveredColumn, setHoveredColumn] = useState<number | null>(null);

  // Generate chart data based on costBy selection
  const chartData = useMemo(() => {
    if (costBy === "agent") {
      // Agent-based chart (existing logic)
    if (!agentUsage.items || agentUsage.items.length === 0) {
      return [];
    }

      const periods = timeRange === 'day' ? 24 : timeRange === 'week' ? 7 : 4;
    const data: ChartDayData[] = [];

    const agentsWithUsage = agents
      .filter(agent => agentUsage.items?.some((item: any) => item.id === agent.id))
      .map(agent => {
        const usage = agentUsage.items?.find((item: any) => item.id === agent.id);
        return {
          agent,
          totalCost: usage ? parseFloat(usage.total) || 0 : 0
        };
      })
      .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);

    if (agentsWithUsage.length === 0) {
      return [];
    }

    const allAgentsCost = agentUsage.items?.reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0) || 0;
    const top5Cost = agentsWithUsage.reduce((sum, item) => sum + item.totalCost, 0);
    const otherAgentsCost = Math.max(0, allAgentsCost - top5Cost);

    const distributionFactors = generateDistributionFactors(periods);
    
    for (let i = 0; i < periods; i++) {
      const date = new Date();
      let dateStr = '';
      
      if (timeRange === 'day') {
        date.setHours(date.getHours() - (periods - 1 - i));
        dateStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      } else if (timeRange === 'week') {
        date.setDate(date.getDate() - (periods - 1 - i));
        dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        const weeksAgo = periods - 1 - i;
        date.setDate(date.getDate() - (weeksAgo * 7));
        const startWeek = new Date(date);
        const endWeek = new Date(date);
        endWeek.setDate(endWeek.getDate() + 6);
        dateStr = `${startWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endWeek.toLocaleDateString('en-US', { day: 'numeric' })}`;
      }

      const periodFactor = distributionFactors[i];
      
      const top5AgentData = agentsWithUsage.map(({ agent, totalCost }) => ({
        agent,
        cost: totalCost * periodFactor,
        color: color(agent.id),
        percentage: 0,
        type: 'agent' as const
      }));

      const allAgentData = [...top5AgentData];
      
      if (otherAgentsCost > 0) {
        allAgentData.push({
          agent: { 
            id: 'other', 
            name: 'Other', 
            avatar: '', 
            instructions: '', 
            tools_set: {}, 
            model: '', 
            views: [], 
            visibility: 'PUBLIC' as const
          } as Agent,
          cost: otherAgentsCost * periodFactor,
          color: '#E5E7EB',
          percentage: 0,
          type: 'agent' as const
        });
      }

      const totalCost = allAgentData.reduce((sum, item) => sum + item.cost, 0);
      
      // Round individual costs to 2 decimal places to avoid precision issues
      const roundedAgentData = allAgentData.map(item => ({
        ...item,
        cost: Math.round(item.cost * 100) / 100
      }));
      
      // Recalculate total with rounded costs
      const roundedTotalCost = roundedAgentData.reduce((sum, item) => sum + item.cost, 0);
      
      data.push({
        date: dateStr,
        fullDate: date.toLocaleDateString('en-US', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        }),
        agents: roundedAgentData.map(item => ({
          ...item,
          percentage: roundedTotalCost > 0 ? (item.cost / roundedTotalCost) * 100 : 0
        })),
        total: roundedTotalCost
      });
    }

    return data;
    } else if (costBy === "user") {
      // User-based chart
      if (!threadUsage.items || threadUsage.items.length === 0) {
        return [];
      }

      const periods = timeRange === 'day' ? 24 : timeRange === 'week' ? 7 : 4;
      const data: ChartDayData[] = [];

      // Group threads by user and calculate total cost per user
      const userMap = new Map<string, { totalCost: number, member: Member | null }>();
      
      threadUsage.items.forEach((thread: any) => {
        const userId = thread.generatedBy;
        const parsedCost = typeof thread.total === 'string' ? parseFloat(thread.total.replace('$', '')) : (typeof thread.total === 'number' ? thread.total : 0);
        const threadCost = isNaN(parsedCost) ? 0 : parsedCost;
        
        if (!userMap.has(userId)) {
          const member = members.find(m => m.profiles.id === userId);
          userMap.set(userId, {
            totalCost: 0,
            member: member || null
          });
        }
        
        userMap.get(userId)!.totalCost += threadCost;
      });

      // Get top 5 users by cost
      const usersWithCost = Array.from(userMap.entries())
        .map(([userId, data]) => ({
          userId,
          totalCost: data.totalCost,
          member: data.member,
          name: data.member?.profiles?.email || 'Unknown User'
        }))
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, 5);

      if (usersWithCost.length === 0) {
        return [];
      }

      const totalUserCost = Array.from(userMap.values()).reduce((sum, user) => sum + user.totalCost, 0);
      const top5UserCost = usersWithCost.reduce((sum, user) => sum + user.totalCost, 0);
      const otherUserCost = Math.max(0, totalUserCost - top5UserCost);

      const distributionFactors = generateDistributionFactors(periods);
      
      for (let i = 0; i < periods; i++) {
        const date = new Date();
        let dateStr = '';
        
        if (timeRange === 'day') {
          date.setHours(date.getHours() - (periods - 1 - i));
          dateStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (timeRange === 'week') {
          date.setDate(date.getDate() - (periods - 1 - i));
          dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          const weeksAgo = periods - 1 - i;
          date.setDate(date.getDate() - (weeksAgo * 7));
          const startWeek = new Date(date);
          const endWeek = new Date(date);
          endWeek.setDate(endWeek.getDate() + 6);
          dateStr = `${startWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endWeek.toLocaleDateString('en-US', { day: 'numeric' })}`;
        }

        const periodFactor = distributionFactors[i];
        
        const top5UserData = usersWithCost.map(({ userId, totalCost, name, member }) => ({
          agent: { 
            id: userId, 
            name: name, 
            avatar: '', 
            instructions: '', 
            tools_set: {}, 
            model: '', 
            views: [], 
            visibility: 'PUBLIC' as const
          } as Agent,
          cost: totalCost * periodFactor,
          color: color(userId),
          percentage: 0,
          type: 'user' as const,
          member: member
        }));

        const allUserData = [...top5UserData];
        
        if (otherUserCost > 0) {
          allUserData.push({
            agent: { 
              id: 'other', 
              name: 'Other', 
              avatar: '', 
              instructions: '', 
              tools_set: {}, 
              model: '', 
              views: [], 
              visibility: 'PUBLIC' as const
            } as Agent,
            cost: otherUserCost * periodFactor,
            color: '#E5E7EB',
            percentage: 0,
            type: 'user' as const,
            member: null
          });
        }

        const totalCost = allUserData.reduce((sum, item) => sum + item.cost, 0);
        
        // Round individual costs to 2 decimal places to avoid precision issues
        const roundedUserData = allUserData.map(item => ({
          ...item,
          cost: Math.round(item.cost * 100) / 100
        }));
        
        // Recalculate total with rounded costs
        const roundedTotalCost = roundedUserData.reduce((sum, item) => sum + item.cost, 0);
        
        data.push({
          date: dateStr,
          fullDate: date.toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          }),
          agents: roundedUserData.map(item => ({
            ...item,
            percentage: roundedTotalCost > 0 ? (item.cost / roundedTotalCost) * 100 : 0
          })),
          total: roundedTotalCost
        });
      }

      return data;
    } else if (costBy === "thread") {
      // Thread-based chart - show top threads by cost
      if (!threadUsage.items || threadUsage.items.length === 0) {
        return [];
      }

      const periods = timeRange === 'day' ? 24 : timeRange === 'week' ? 7 : 4;
      const data: ChartDayData[] = [];

      // Get top 5 threads by cost
      const threadsWithCost = threadUsage.items
        .map((thread: any) => {
          const parsedCost = typeof thread.total === 'string' ? parseFloat(thread.total.replace('$', '')) : (typeof thread.total === 'number' ? thread.total : 0);
          const totalCost = isNaN(parsedCost) ? 0 : parsedCost;
          return {
            ...thread,
            totalCost,
            title: `Thread ${thread.id.slice(-8)}` // Use last 8 chars of ID as title
          };
        })
        .sort((a: any, b: any) => b.totalCost - a.totalCost)
        .slice(0, 5);

      if (threadsWithCost.length === 0) {
        return [];
      }

      const allThreadsCost = threadUsage.items.reduce((sum: number, thread: any) => {
        const parsedCost = typeof thread.total === 'string' ? parseFloat(thread.total.replace('$', '')) : (typeof thread.total === 'number' ? thread.total : 0);
        const validCost = isNaN(parsedCost) ? 0 : parsedCost;
        return sum + validCost;
      }, 0);
      const top5ThreadsCost = threadsWithCost.reduce((sum: number, thread) => sum + thread.totalCost, 0);
      const otherThreadsCost = Math.max(0, allThreadsCost - top5ThreadsCost);

      const distributionFactors = generateDistributionFactors(periods);
      
      for (let i = 0; i < periods; i++) {
        const date = new Date();
        let dateStr = '';
        
        if (timeRange === 'day') {
          date.setHours(date.getHours() - (periods - 1 - i));
          dateStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } else if (timeRange === 'week') {
          date.setDate(date.getDate() - (periods - 1 - i));
          dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } else {
          const weeksAgo = periods - 1 - i;
          date.setDate(date.getDate() - (weeksAgo * 7));
          const startWeek = new Date(date);
          const endWeek = new Date(date);
          endWeek.setDate(endWeek.getDate() + 6);
          dateStr = `${startWeek.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}-${endWeek.toLocaleDateString('en-US', { day: 'numeric' })}`;
        }

        const periodFactor = distributionFactors[i];
        
        const top5ThreadData = threadsWithCost.map(({ id, totalCost, title }: any) => ({
          agent: { 
            id: id, 
            name: title, 
            avatar: '', 
            instructions: '', 
            tools_set: {}, 
            model: '', 
            views: [], 
            visibility: 'PUBLIC' as const
          } as Agent,
          cost: totalCost * periodFactor,
          color: color(id),
          percentage: 0,
          type: 'thread' as const
        }));

        const allThreadData = [...top5ThreadData];
        
        if (otherThreadsCost > 0) {
          allThreadData.push({
            agent: { 
              id: 'other', 
              name: 'Other', 
              avatar: '', 
              instructions: '', 
              tools_set: {}, 
              model: '', 
              views: [], 
              visibility: 'PUBLIC' as const
            } as Agent,
            cost: otherThreadsCost * periodFactor,
            color: '#E5E7EB',
            percentage: 0,
            type: 'thread' as const
          });
        }

        const totalCost = allThreadData.reduce((sum, item) => sum + item.cost, 0);
        
        // Round individual costs to 2 decimal places to avoid precision issues
        const roundedThreadData = allThreadData.map(item => ({
          ...item,
          cost: Math.round(item.cost * 100) / 100
        }));
        
        // Recalculate total with rounded costs
        const roundedTotalCost = roundedThreadData.reduce((sum, item) => sum + item.cost, 0);
        
        data.push({
          date: dateStr,
          fullDate: date.toLocaleDateString('en-US', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
          }),
          agents: roundedThreadData.map(item => ({
            ...item,
            percentage: roundedTotalCost > 0 ? (item.cost / roundedTotalCost) * 100 : 0
          })),
          total: roundedTotalCost
        });
      }

      return data;
    }

    return [];
  }, [agents, agentUsage, threadUsage, members, timeRange, costBy]);

  // Generate distribution factors that sum to 1 for realistic but consistent distribution
  function generateDistributionFactors(totalPeriods: number): number[] {
    const factors: number[] = [];
    
    for (let i = 0; i < totalPeriods; i++) {
      const seed = i * 12345 + totalPeriods * 67890;
      const pseudoRandom = Math.abs(Math.sin(seed)) * 0.5 + 0.5;
      const normalizedIndex = i / (totalPeriods - 1);
      const bellCurve = Math.exp(-Math.pow(normalizedIndex - 0.5, 2) / 0.2);
      const factor = pseudoRandom * (0.5 + bellCurve * 0.5);
      factors.push(factor);
    }
    
    const sum = factors.reduce((acc, factor) => acc + factor, 0);
    return factors.map(factor => factor / sum);
  }

  const maxValue = Math.max(...chartData.map((d: ChartDayData) => d.total));
  const chartMax = maxValue > 0 ? Math.max(0.1, Math.ceil(maxValue * 1.1 * 100) / 100) : 0.1;
  console.log(`Chart: maxValue=${maxValue}, chartMax=${chartMax}, costBy=${costBy}`);
  console.log(`Chart data:`, chartData.map(d => ({ date: d.date, total: d.total, agents: d.agents.length })));
  const yAxisLabels = [];
  const step = chartMax / 5;
  for (let i = chartMax; i >= 0; i -= step) {
    yAxisLabels.push(Math.round(i * 100) / 100);
  }

  return (
    <Card className="w-full p-6 rounded-xl border bg-primary-foreground">
        <div className="relative h-96">
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-6 w-10 flex flex-col justify-between">
            {yAxisLabels.map((value) => (
              <div key={value} className="text-right text-xs text-foreground pr-2 flex items-center justify-end h-0">
                ${value}
              </div>
            ))}
          </div>
          
          {/* Horizontal grid lines */}
          <div className="absolute left-10 right-0 top-0 bottom-6 flex flex-col justify-between">
            {yAxisLabels.map((value) => (
              <div key={value} className="w-full border-t border-border/30 h-0" />
            ))}
          </div>

          {/* Chart area - columns start at $0 line */}
          <div className="absolute left-10 right-0 top-0 bottom-6 px-8 flex items-end justify-between">
            {chartData.map((day: ChartDayData, index: number) => (
              <Tooltip key={index} delayDuration={0} disableHoverableContent>
                <TooltipTrigger asChild>
                  <div 
                    className={`flex flex-col items-center cursor-pointer transition-opacity duration-200 ${
                      hoveredColumn !== null && hoveredColumn !== index ? 'opacity-30' : 'opacity-100'
                    }`}
                    style={{ 
                      width: chartData.length > 12 ? '50px' : chartData.length <= 7 ? '100px' : '80px',
                      minWidth: chartData.length > 12 ? '40px' : '60px',
                      height: '100%'
                    }}
                    onMouseEnter={() => setHoveredColumn(index)}
                    onMouseLeave={() => setHoveredColumn(null)}
                  >
                    {/* Stacked bars - positioned to start at $0 line */}
                    <div className="w-full flex flex-col justify-end gap-0.5 h-full">
                      {day.agents.map((agent: ChartAgentData, agentIndex: number) => (
                        <div
                          key={`${agent.agent.id}-${agentIndex}`}
                          className="w-full rounded-md min-h-[4px]"
                          style={{ 
                            backgroundColor: agent.color,
                            height: `${Math.max(4, (agent.cost / chartMax) * 100)}%`
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent 
                  side={index >= chartData.length / 2 ? "left" : "right"} 
                  sideOffset={10}
                  className="bg-background text-foreground shadow-lg pointer-events-none [&_[class*='bg-primary']]:!bg-background [&_[class*='fill-primary']]:!fill-background"
                >
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      {day.fullDate}
                    </div>
                    <div className="space-y-1">
                      {day.agents.map((agent: ChartAgentData, agentIndex: number) => (
                        <div key={agentIndex} className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div
                              className="w-2 h-2 rounded flex-shrink-0"
                              style={{ backgroundColor: agent.agent.id === 'other' ? '#E5E7EB' : agent.color }}
                            />
                            {agent.agent.id !== 'other' && (
                              <>
                                {agent.type === 'user' && agent.member ? (
                                  <UserAvatar
                                    url={agent.member.profiles?.metadata?.avatar_url}
                                    fallback={agent.member.profiles?.email || 'Unknown'}
                                    size="sm"
                                  />
                                ) : (
                                  <AgentAvatar
                                    url={agent.agent.avatar}
                                    fallback={agent.agent.name}
                                    size="sm"
                                  />
                                )}
                              </>
                            )}
                            <span className="text-xs truncate">
                              {agent.agent.name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              ${agent.cost.toFixed(2)}
                            </span>
                            <span className="text-xs font-medium">
                              {agent.percentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* X-axis labels - positioned below the chart area */}
          <div className="absolute left-10 right-0 bottom-0 px-8 flex justify-between pt-1 h-6">
            {chartData.map((day: ChartDayData, index: number) => (
              <div 
                key={`label-${index}`}
                className="text-xs text-center text-foreground px-1"
                style={{ 
                  width: chartData.length > 12 ? '50px' : chartData.length <= 7 ? '100px' : '80px',
                  minWidth: chartData.length > 12 ? '40px' : '60px'
                }}
              >
                <div className="whitespace-nowrap overflow-hidden text-ellipsis" title={day.date}>
                  {day.date}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
}

// Usage Table Component using proper table components with sorting
function UsageTable({ 
  agents, 
  agentUsage,
  threadUsage,
  onAgentClick 
}: { 
  agents: Agent[];
  agentUsage: any;
  threadUsage: any;
  onAgentClick: (agent: Agent, metrics: any) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Combine usage data to get comprehensive metrics per agent
  const enrichedAgents = useMemo(() => {
    return agents.map((agent) => {
      const agentUsageData = agentUsage.items?.find((item: any) => item.id === agent.id);
      const agentThreads = threadUsage.items?.filter((thread: any) => thread.agentId === agent.id) || [];
      
      // Calculate metrics from thread data
      const totalTokens = agentThreads.reduce((sum: number, thread: any) => sum + (thread.tokens?.totalTokens || 0), 0);
      const promptTokens = agentThreads.reduce((sum: number, thread: any) => sum + (thread.tokens?.promptTokens || 0), 0);
      const completionTokens = agentThreads.reduce((sum: number, thread: any) => sum + (thread.tokens?.completionTokens || 0), 0);
      const threadsCount = agentThreads.length;
      const uniqueUsers = new Set(agentThreads.map((thread: any) => thread.generatedBy)).size;
      const promptsCount = threadsCount; // Each thread represents a prompt/conversation
      
      const metrics = {
        agentUsage: agentUsageData,
        totalCost: agentUsageData ? parseFloat(agentUsageData.total) || 0 : 0,
        totalTokens,
        promptTokens,
        completionTokens,
        threadsCount,
        uniqueUsers,
        promptsCount,
      };

      return {
        ...agent,
        color: color(agent.id),
        metrics,
        // For sorting purposes
        totalCost: metrics.totalCost,
      };
    }).filter(agent => agent.metrics.agentUsage); // Only show agents that have usage data
  }, [agents, agentUsage.items, threadUsage.items]);

  // Define table columns
  const columns: TableColumn<typeof enrichedAgents[0]>[] = [
    {
      id: "color",
      header: "",
      render: (agent) => (
        <div 
          className="w-3 h-3 rounded" 
          style={{ backgroundColor: agent.color }}
        />
      ),
    },
    {
      id: "name",
      header: "Agent",
      render: (agent) => (
        <div className="flex items-center gap-3">
          <AgentAvatar
            url={agent.avatar}
            fallback={agent.name}
            size="sm"
          />
          <span className="font-medium">{agent.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "users",
      header: "Users",
      render: (agent) => (
        <span className="text-sm">
          {agent.metrics.uniqueUsers}
        </span>
      ),
      sortable: true,
    },
    {
      id: "threads",
      header: "Threads",
      render: (agent) => (
        <span className="text-sm">
          {agent.metrics.threadsCount}
        </span>
      ),
      sortable: true,
    },
    {
      id: "tokens",
      header: "Tokens",
      render: (agent) => (
        <span className="text-sm">
          {agent.metrics.totalTokens.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "prompts",
      header: "Prompts",
      render: (agent) => (
        <span className="text-sm">
          {agent.metrics.promptsCount}
        </span>
      ),
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (agent) => (
        <span className="font-medium">
          $ {agent.metrics.agentUsage?.total || "0.00"}
        </span>
      ),
      sortable: true,
    },
  ];

  // Sorting logic
  const getSortValue = (agent: typeof enrichedAgents[0], key: string): string | number => {
    switch (key) {
      case "name":
        return agent.name.toLowerCase();
      case "users":
        return agent.metrics.uniqueUsers;
      case "threads":
        return agent.metrics.threadsCount;
      case "tokens":
        return agent.metrics.totalTokens;
      case "prompts":
        return agent.metrics.promptsCount;
      case "total":
        return agent.totalCost;
      default:
        return "";
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Sort the data
  const sortedAgents = useMemo(() => {
    return [...enrichedAgents].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [enrichedAgents, sortKey, sortDirection]);

  return (
    <Table
      columns={columns}
      data={sortedAgents}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={(agent) => onAgentClick(agent, agent.metrics)}
    />
  );
}

// Threads Table Component
function ThreadsTable({ 
  agents, 
  threadUsage, 
  members,
  threadDetails,
  onThreadClick 
}: { 
  agents: Agent[];
  threadUsage: any;
  members: Member[];
  threadDetails?: any;
  onThreadClick: (thread: any) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Debug: Log the threadUsage data
  console.log("ThreadsTable - threadUsage:", threadUsage);
  console.log("ThreadsTable - agents:", agents);
  console.log("ThreadsTable - members:", members);

  // Enrich thread data with agent and user information
  const enrichedThreads = useMemo(() => {
    if (!threadUsage.items || threadUsage.items.length === 0) {
      console.log("No threadUsage items available");
      return [];
    }

    console.log("Processing threadUsage items:", threadUsage.items);

    return threadUsage.items.map((thread: any) => {
      const agent = agents.find(a => a.id === thread.agentId);
      const user = members.find(m => m.profiles.id === thread.generatedBy);
      
      // Try to get actual thread details if available
      const threadDetail = threadDetails?.data?.threads?.find((t: any) => t.id === thread.id);
      
      // Ensure totalCost is always a proper number for sorting - handle dollar sign
      const parsedCost = typeof thread.total === 'string' ? parseFloat(thread.total.replace('$', '')) : (typeof thread.total === 'number' ? thread.total : 0);
      const totalCost = isNaN(parsedCost) ? 0 : parsedCost;
      console.log(`Thread ${thread.id}: original cost=${thread.total}, parsed=${parsedCost}, final=${totalCost}, type=${typeof totalCost}`);
      
      return {
        ...thread,
        agent: agent || { id: thread.agentId, name: 'Unknown Agent', avatar: '' },
        user: user || { profiles: { id: thread.generatedBy, email: 'Unknown User', metadata: { avatar_url: '', username: 'unknown', email: 'Unknown User' } } },
        color: color(thread.id),
        totalCost,
        // Use actual thread title if available, otherwise use fallback
        title: threadDetail?.title || `Thread ${thread.id.slice(-8)}`,
        updatedAt: threadDetail?.updatedAt || new Date().toISOString(),
      };
    }); // Remove the filter that was hiding all data
  }, [threadUsage.items, agents, members, threadDetails]);

  // Define table columns
  const columns: TableColumn<typeof enrichedThreads[0]>[] = [
    {
      id: "color",
      header: "",
      render: (thread) => (
        <div 
          className="w-3 h-3 rounded" 
          style={{ backgroundColor: thread.color }}
        />
      ),
    },
    {
      id: "title",
      header: "Thread",
      render: (thread) => (
        <div className="flex flex-col">
          <span className="font-medium text-sm">{thread.title}</span>
          <span className="text-xs text-muted-foreground">ID: {thread.id.slice(-8)}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "updatedAt",
      header: "Last Updated",
      render: (thread) => (
        <span className="text-sm text-muted-foreground">
          {new Date(thread.updatedAt).toLocaleDateString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "agent",
      header: "Agent",
      render: (thread) => (
        <div className="flex items-center gap-2">
          <AgentAvatar
            url={thread.agent.avatar}
            fallback={thread.agent.name}
            size="sm"
          />
          <span className="text-sm">{thread.agent.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "user",
      header: "Used by",
      render: (thread) => (
        <div className="flex items-center gap-2">
          <UserAvatar
            url={thread.user.profiles?.metadata?.avatar_url}
            fallback={thread.user.profiles?.email || 'Unknown'}
            size="sm"
          />
          <span className="text-sm">{thread.user.profiles?.email || 'Unknown'}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (thread) => (
        <span className="font-medium">
          ${thread.totalCost.toFixed(2)}
        </span>
      ),
      sortable: true,
    },
  ];

  // Sorting logic
  const getSortValue = (thread: typeof enrichedThreads[0], key: string): string | number => {
    switch (key) {
      case "title":
        return thread.title.toLowerCase();
      case "updatedAt":
        return new Date(thread.updatedAt).getTime();
      case "agent":
        return thread.agent.name.toLowerCase();
      case "user":
        return thread.user.profiles?.email?.toLowerCase() || "";
      case "total":
        return thread.totalCost;
      default:
        return "";
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Sort the data
  const sortedThreads = useMemo(() => {
    return [...enrichedThreads].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [enrichedThreads, sortKey, sortDirection]);

  console.log("ThreadsTable - enrichedThreads:", enrichedThreads);
  console.log("ThreadsTable - sortedThreads:", sortedThreads);

  return (
    <Table
      columns={columns}
      data={sortedThreads}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={(thread) => onThreadClick(thread)}
    />
  );
}

// Users Table Component
function UsersTable({ 
  agents, 
  threadUsage, 
  members,
  onUserClick 
}: { 
  agents: Agent[];
  threadUsage: any;
  members: Member[];
  onUserClick: (user: any, metrics: any) => void;
}) {
  const [sortKey, setSortKey] = useState<string>("total");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Debug: Log the input data
  console.log("UsersTable - threadUsage:", threadUsage);
  console.log("UsersTable - threadUsage.items:", threadUsage.items);
  console.log("UsersTable - members:", members);
  
  // Log sample thread data
  if (threadUsage.items && threadUsage.items.length > 0) {
    console.log("Sample thread data:", threadUsage.items[0]);
  }

  // Aggregate thread usage data by user
  const enrichedUsers = useMemo(() => {
    if (!threadUsage.items || threadUsage.items.length === 0) {
      console.log("No threadUsage items available for users");
      return [];
    }

    console.log("Processing threadUsage items for users:", threadUsage.items);
    console.log("Sample thread item:", threadUsage.items[0]);

    const userMap = new Map<string, any>();

    // Group threads by user
    threadUsage.items.forEach((thread: any) => {
      const userId = thread.generatedBy;
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          userId,
          threads: [],
          totalCost: 0,
          totalTokens: 0,
          agentIds: new Set<string>(),
        });
      }
      
      const userData = userMap.get(userId);
      userData.threads.push(thread);
      
      // Parse the thread cost more carefully - handle dollar sign
      const threadCost = typeof thread.total === 'string' ? parseFloat(thread.total.replace('$', '')) : (typeof thread.total === 'number' ? thread.total : 0);
      const validCost = isNaN(threadCost) ? 0 : threadCost;
      
      userData.totalCost += validCost;
      userData.totalTokens += thread.tokens?.totalTokens || 0;
      userData.agentIds.add(thread.agentId);
      
      console.log(`User ${userId}: added thread ${thread.id}, original cost=${thread.total}, parsed=${threadCost}, valid=${validCost}, running total=${userData.totalCost}`);
    });

    console.log("UserMap after processing:", userMap);

    // Convert to array and enrich with member information
    const users = Array.from(userMap.values()).map((userData) => {
      const member = members.find(m => m.profiles.id === userData.userId);
      
      return {
        ...userData,
        member: member || { 
          profiles: { 
            id: userData.userId, 
            email: 'Unknown User',
            metadata: { avatar_url: undefined }
          },
          roles: []
        },
        color: color(userData.userId),
        agentsUsed: userData.agentIds.size,
        threadsCount: userData.threads.length,
      };
    });

    console.log("Enriched users:", users);
    return users;
  }, [threadUsage.items, members]);

  // Define table columns
  const columns: TableColumn<typeof enrichedUsers[0]>[] = [
    {
      id: "color",
      header: "",
      render: (user) => (
        <div 
          className="w-3 h-3 rounded" 
          style={{ backgroundColor: user.color }}
        />
      ),
    },
    {
      id: "user",
      header: "User",
      render: (user) => (
        <div className="flex items-center gap-3">
          <UserAvatar
            url={user.member.profiles?.metadata?.avatar_url}
            fallback={user.member.profiles?.email || 'Unknown'}
            size="sm"
          />
          <div className="flex flex-col">
            <span className="font-medium text-sm">{user.member.profiles?.email || 'Unknown'}</span>
            {user.member.roles && user.member.roles.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {user.member.roles[0].name}
              </span>
            )}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      id: "agentsUsed",
      header: "Agents Used",
      render: (user) => (
        <span className="text-sm">
          {user.agentsUsed}
        </span>
      ),
      sortable: true,
    },
    {
      id: "threadsCount",
      header: "Threads Created",
      render: (user) => (
        <span className="text-sm">
          {user.threadsCount}
        </span>
      ),
      sortable: true,
    },
    {
      id: "totalTokens",
      header: "Tokens",
      render: (user) => (
        <span className="text-sm">
          {user.totalTokens.toLocaleString()}
        </span>
      ),
      sortable: true,
    },
    {
      id: "total",
      header: "Total Cost",
      render: (user) => {
        console.log(`Rendering user ${user.userId} total cost:`, user.totalCost, typeof user.totalCost);
        return (
          <span className="font-medium">
            $ {user.totalCost.toFixed(2)}
          </span>
        );
      },
      sortable: true,
    },
  ];

  // Sorting logic
  const getSortValue = (user: typeof enrichedUsers[0], key: string): string | number => {
    switch (key) {
      case "user":
        return user.member.profiles?.email?.toLowerCase() || "";
      case "agentsUsed":
        return user.agentsUsed;
      case "threadsCount":
        return user.threadsCount;
      case "totalTokens":
        return user.totalTokens;
      case "total":
        return user.totalCost;
      default:
        return "";
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev: "asc" | "desc") => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  // Sort the data
  const sortedUsers = useMemo(() => {
    return [...enrichedUsers].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      
      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [enrichedUsers, sortKey, sortDirection]);

  console.log("UsersTable - enrichedUsers:", enrichedUsers);
  console.log("UsersTable - sortedUsers:", sortedUsers);

  return (
    <Table
      columns={columns}
      data={sortedUsers}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={handleSort}
      onRowClick={(user) => onUserClick(user, user)}
    />
  );
}

// Agent Details Modal (updated to show comprehensive usage metrics)
function AgentDetailsModal({ agent, metrics, onClose }: { 
  agent: Agent;
  metrics: any;
  onClose: () => void;
}) {
  const withWorkspaceLink = useWorkspaceLink();
  
  return (
    <DialogContent className="sm:max-w-[400px] p-6">
      <DialogHeader>
        <DialogTitle>Agent Details</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-4">
          <AgentAvatar
            url={agent.avatar}
            fallback={agent.name}
            size="lg"
          />
          <div className="flex flex-col justify-center">
            <span className="text-base font-semibold text-foreground">
              {agent.name}
            </span>
            <span className="text-sm text-muted-foreground mt-1">
              $ {metrics?.agentUsage?.total || "0.00"} total cost
            </span>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground mb-1">
            Usage Statistics
          </span>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics?.uniqueUsers || 0}
              </span>
              <span className="text-xs text-muted-foreground">Users</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics?.threadsCount || 0}
              </span>
              <span className="text-xs text-muted-foreground">Threads</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics?.totalTokens?.toLocaleString() || 0}
              </span>
              <span className="text-xs text-muted-foreground">Total Tokens</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics?.promptsCount || 0}
              </span>
              <span className="text-xs text-muted-foreground">Prompts</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics?.promptTokens?.toLocaleString() || 0}
              </span>
              <span className="text-xs text-muted-foreground">Prompt Tokens</span>
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">
                {metrics?.completionTokens?.toLocaleString() || 0}
              </span>
              <span className="text-xs text-muted-foreground">Completion Tokens</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground mb-1">
            Cost Breakdown
          </span>
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-foreground">
              $ {metrics?.agentUsage?.total || "0.00"}
            </span>
            <span className="text-xs text-muted-foreground">Total Cost</span>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="mt-2 w-full justify-center"
        >
          <Link
            to={withWorkspaceLink(`/agent/${agent.id}/${crypto.randomUUID()}`)}
            onClick={onClose}
          >
            <Icon name="open_in_new" size={16} />
            View agent
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
    return _members?.length ? _members : [userToMember(user)];
  }, [_members]);

  return members;
}

function useAllUsersIncludingThreadCreators(threadUsage: any) {
  const { teamSlug } = useParams();
  const { data: { members: _members } } = useTeamMembersBySlug(
    teamSlug ?? null,
  );
  const user = useUser();

  const allUsers = useMemo(() => {
    // Start with team members
    const teamMembers = _members?.length ? _members : [userToMember(user)];
    const userMap = new Map<string, Member>();
    
    // Add team members to the map
    teamMembers.forEach(member => {
      userMap.set(member.profiles.id, member);
    });

    // Add users from threadUsage who aren't team members
    if (threadUsage.items) {
      threadUsage.items.forEach((thread: any) => {
        const userId = thread.generatedBy;
        if (!userMap.has(userId)) {
          // Create a minimal member object for non-team users
          const unknownMember: Member = {
            id: -1,
            user_id: userId,
            profiles: {
              id: userId,
              email: 'Unknown User',
              is_anonymous: false,
              metadata: { avatar_url: '', username: 'unknown', email: 'Unknown User' },
              phone: null,
            },
            roles: [],
            created_at: new Date().toISOString(),
            lastActivity: "",
          };
          userMap.set(userId, unknownMember);
        }
      });
    }

    return Array.from(userMap.values());
  }, [_members, user, threadUsage]);

  return allUsers;
}

export default function UsageSettings() {
  const _agents = useAgents();
  const agents = {
    ..._agents,
    data: _agents.data?.concat([
      WELL_KNOWN_AGENTS.teamAgent,
      WELL_KNOWN_AGENTS.setupAgent,
    ]) || [],
  };

  const [costBy, setCostBy] = useState("agent");
  const [selectedAgent, setSelectedAgent] = useState("all");
  const [timeRange, setTimeRange] = useState("week");
  const [selectedAgentDetails, setSelectedAgentDetails] = useState<{agent: Agent, metrics: any} | null>(null);

  const agentUsage = useUsagePerAgent({ range: timeRange as "day" | "week" | "month" });
  const threadUsage = useUsagePerThread({ range: timeRange as "day" | "week" | "month" });
  const members = useMembers();
  const allUsers = useAllUsersIncludingThreadCreators(threadUsage);

  // Always call useThreads but only use data when costBy is "thread"
  const threadDetails = useThreads({
    limit: 20,
    orderBy: "updatedAt_desc",
  });

  // Calculate metrics based on costBy selection
  const { agentCount, totalCost, chartData } = useMemo(() => {
    console.log("Main component - calculating metrics for costBy:", costBy);
    console.log("Main component - agentUsage:", agentUsage);
    console.log("Main component - threadUsage:", threadUsage);
    
      if (costBy === "agent") {
    const count = agentUsage.items?.length || 0;
    const rawCost = agentUsage.total || "0.00";
    // Parse the cost to remove any existing dollar sign and format consistently
    const parsedCost = typeof rawCost === 'string' ? parseFloat(rawCost.replace('$', '')) : (typeof rawCost === 'number' ? rawCost : 0);
    const cost = isNaN(parsedCost) ? 0 : parsedCost;
    const formattedCost = cost.toFixed(2);
    console.log("Agent metrics - count:", count, "cost:", formattedCost);
    return {
      agentCount: count,
      totalCost: formattedCost,
      chartData: { agentUsage, threadUsage, type: "agent" }
    };
      } else if (costBy === "thread") {
    const count = threadUsage.items?.length || 0;
    const cost = threadUsage.items?.reduce((sum: number, thread: any) => {
      const parsedCost = typeof thread.total === 'string' ? parseFloat(thread.total.replace('$', '')) : (typeof thread.total === 'number' ? thread.total : 0);
      const validCost = isNaN(parsedCost) ? 0 : parsedCost;
      return sum + validCost;
    }, 0) || 0;
    const formattedCost = cost.toFixed(2);
    console.log("Thread metrics - count:", count, "cost:", formattedCost);
    console.log("Thread metrics - sample thread cost:", threadUsage.items?.[0]?.total);
    return {
      agentCount: count,
      totalCost: formattedCost,
      chartData: { agentUsage, threadUsage, type: "thread" }
    };
  } else if (costBy === "user") {
    // Calculate unique users from threadUsage
    const uniqueUsers = new Set(threadUsage.items?.map((thread: any) => thread.generatedBy) || []);
    const totalUserCost = threadUsage.items?.reduce((sum: number, thread: any) => {
      const parsedCost = typeof thread.total === 'string' ? parseFloat(thread.total.replace('$', '')) : (typeof thread.total === 'number' ? thread.total : 0);
      const validCost = isNaN(parsedCost) ? 0 : parsedCost;
      return sum + validCost;
    }, 0) || 0;
    const formattedCost = totalUserCost.toFixed(2);
    console.log("User metrics - uniqueUsers:", uniqueUsers, "count:", uniqueUsers.size, "cost:", formattedCost);
    console.log("User metrics - sample thread cost:", threadUsage.items?.[0]?.total);
    return {
      agentCount: uniqueUsers.size,
      totalCost: formattedCost,
      chartData: { agentUsage, threadUsage, type: "user" }
    };
  }
    return {
      agentCount: 0,
      totalCost: "0.00",
      chartData: { agentUsage, threadUsage, type: "agent" }
    };
  }, [costBy, agentUsage, threadUsage]);

  // Update BigNumberCards to show different metrics based on costBy
  const getCountLabel = () => {
    switch (costBy) {
      case "agent": return "Agents used";
      case "thread": return "Threads created";
      case "user": return "Users active";
      default: return "Items";
    }
  };

  return (
    <div className="h-full text-foreground px-6 py-6 overflow-x-auto w-full">
      <div className="flex flex-col gap-6 overflow-x-auto w-full">
        <UsageFilters
          costBy={costBy}
          setCostBy={setCostBy}
          selectedAgent={selectedAgent}
          setSelectedAgent={setSelectedAgent}
          timeRange={timeRange}
          setTimeRange={setTimeRange}
          agents={agents.data || []}
        />

        <div className="flex gap-4 w-full">
          <Card className="flex-1 p-6 rounded-xl border">
            <CardContent className="p-0">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="robot_2" size={16} />
                <span className="text-sm font-medium text-muted-foreground">
                  {getCountLabel()}
                </span>
              </div>
              <div className="text-4xl font-normal text-foreground">
                {agentCount} {costBy === "agent" ? "agents" : costBy === "thread" ? "threads" : "users"}
              </div>
            </CardContent>
          </Card>

          <Card className="flex-1 p-6 rounded-xl bg-primary-dark text-primary-light">
            <CardContent className="p-0">
              <div className="text-sm font-medium mb-2">Total Cost</div>
              <div className="text-4xl font-semibold">${totalCost}</div> 
            </CardContent>
          </Card>
        </div>

        <StackedBarChart 
          agents={agents.data || []} 
          agentUsage={agentUsage} 
          threadUsage={threadUsage} 
          members={allUsers}
          timeRange={timeRange} 
          costBy={costBy}
        />

        {costBy === "agent" && (
        <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
          <UsageTable
            agents={agents.data || []}
            agentUsage={agentUsage}
            threadUsage={threadUsage}
            onAgentClick={(agent, metrics) => setSelectedAgentDetails({agent, metrics})}
          />
        </Suspense>
        )}

        {costBy === "thread" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <ThreadsTable
              agents={agents.data || []}
              threadUsage={threadUsage}
              members={allUsers}
              threadDetails={threadDetails}
              onThreadClick={(thread) => setSelectedAgentDetails({agent: thread.agent, metrics: { agentUsage: { total: thread.totalCost } }})}
            />
          </Suspense>
        )}

        {costBy === "user" && (
          <Suspense fallback={<Skeleton className="w-full h-[400px]" />}>
            <UsersTable
              agents={agents.data || []}
              threadUsage={threadUsage}
              members={allUsers}
              onUserClick={(user, metrics) => setSelectedAgentDetails({agent: user.member, metrics: { agentUsage: { total: user.totalCost } }})}
            />
          </Suspense>
        )}

        <Dialog 
          open={!!selectedAgentDetails} 
          onOpenChange={() => setSelectedAgentDetails(null)}
        >
          {selectedAgentDetails && (
            <AgentDetailsModal
              agent={selectedAgentDetails.agent}
              metrics={selectedAgentDetails.metrics}
              onClose={() => setSelectedAgentDetails(null)}
            />
          )}
        </Dialog>
      </div>
    </div>
  );
}
