import { useAgents, useOrganizations, useTeamMembers } from "@deco/sdk";
import { WELL_KNOWN_AGENT_IDS } from "@deco/sdk/constants";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { format } from "date-fns";
import { useMemo } from "react";
import { useParams } from "react-router";
import { useUser } from "../../../hooks/use-user.ts";
import { IntegrationIcon } from "../../integrations/common.tsx";
import { AgentAvatar } from "../avatar/agent.tsx";
import { UserAvatar } from "../avatar/user.tsx";

interface AgentInfoProps {
  agentId?: string;
  className?: string;
}

function AgentInfo({ agentId, className }: AgentInfoProps) {
  const { data: agents } = useAgents();
  const agent = useMemo(
    () => agents?.find((a) => a.id === agentId),
    [agents, agentId],
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}
        >
          <AgentAvatar
            url={agent?.avatar}
            fallback={
              agentId === WELL_KNOWN_AGENT_IDS.teamAgent ? agentId : agent?.name
            }
            size="sm"
          />
          <span className="truncate hidden md:inline">
            {agentId === WELL_KNOWN_AGENT_IDS.teamAgent
              ? "New chat"
              : agent
                ? agent.name
                : "Deleted agent"}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent>{agent ? agent.name : agentId}</TooltipContent>
    </Tooltip>
  );
}

interface UserInfoProps {
  userId?: string;
  className?: string;
  showDetails?: boolean; // If true, show name/email block (for detail view)
  maxWidth?: string; // Custom max-width for name/email text
  noTooltip?: boolean; // If true, do not wrap with tooltip
}

function UserInfo({
  userId,
  className,
  showDetails = false,
  maxWidth = "200px", // Default to 200px, but allow customization
  noTooltip = false,
}: UserInfoProps) {
  const user = useUser();
  const params = useParams();
  const resolvedOrgSlug = params.org;
  const { data: teams } = useOrganizations();
  const orgId = useMemo(
    () => teams?.find((t) => t.slug === resolvedOrgSlug)?.id ?? null,
    [teams, resolvedOrgSlug],
  );

  // If userId matches current user, use user data directly
  const isCurrentUser = userId && user && userId === user.id;

  const {
    data: { members: teamMembers = [] },
  } = useTeamMembers(orgId ?? null);
  const members = !isCurrentUser && orgId !== null ? teamMembers : [];
  const member = useMemo(
    () => members.find((m) => m.user_id === userId),
    [members, userId],
  );

  // Data source for avatar and name/email
  const avatarUrl = isCurrentUser
    ? user.metadata.avatar_url
    : member?.profiles?.metadata?.avatar_url;
  const name = isCurrentUser
    ? user.metadata.full_name
    : member?.profiles?.metadata?.full_name;
  const email = isCurrentUser ? user.email : member?.profiles?.email;

  const content = (
    <div className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}>
      <UserAvatar url={avatarUrl} fallback={name} size="sm" />
      <div
        className={`flex-col items-start text-left leading-tight w-full ${
          showDetails ? "hidden md:flex" : "flex"
        }`}
      >
        <span
          className="truncate block text-xs font-medium text-foreground"
          style={{ maxWidth }}
        >
          {name || "Unknown"}
        </span>
        <span
          className="truncate block text-xs font-normal text-muted-foreground"
          style={{ maxWidth }}
        >
          {email || ""}
        </span>
      </div>
    </div>
  );

  if (noTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        {name ? (
          <div className="flex flex-col">
            <span>{name}</span>
            <span>{email}</span>
          </div>
        ) : (
          <span>{userId}</span>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

interface DateTimeCellProps {
  value: string | Date | undefined | null;
  dateFormat?: string;
  timeFormat?: string;
  className?: string;
}

export function DateTimeCell({
  value,
  dateFormat = "MMM dd, yyyy",
  timeFormat = "HH:mm:ss",
  className = "",
}: DateTimeCellProps) {
  if (!value) {
    return <span className={className}>-</span>;
  }
  const dateObj = typeof value === "string" ? new Date(value) : value;
  return (
    <div
      className={`flex flex-col items-start text-left leading-tight ${className}`}
    >
      <span className="font-medium text-foreground">
        {format(dateObj, dateFormat)}
      </span>
      <span className="font-normal text-muted-foreground">
        {format(dateObj, timeFormat)}
      </span>
    </div>
  );
}

interface IntegrationInfoProps {
  integration?: { id?: string; icon?: string; name: string };
  toolName?: string;
  className?: string;
}

function IntegrationInfo({
  integration,
  toolName,
  className,
}: IntegrationInfoProps) {
  const integrationId = integration?.id;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}
        >
          <IntegrationIcon
            icon={integration?.icon}
            name={integration?.name || integrationId || "Unknown"}
            size="sm"
          />
          <div className="flex flex-col">
            <span className="truncate hidden md:inline text-sm font-medium">
              {integration?.name || integrationId || "Unknown"}
            </span>
            {toolName && (
              <span className="text-xs text-muted-foreground truncate hidden md:inline">
                {toolName}
              </span>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col">
          <span>{integration?.name || integrationId || "Unknown"}</span>
          {toolName && <span>{toolName}</span>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

interface ActivityStatusCellProps {
  lastActivity?: string | Date | null;
  className?: string;
}

function ActivityStatusCell({
  lastActivity,
  className = "",
}: ActivityStatusCellProps) {
  // Helper function to format relative time
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    const diffInMonths = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 30));
    const diffInYears = Math.floor(diffInMs / (1000 * 60 * 60 * 24 * 365));

    if (diffInMinutes < 1) return "Active";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInHours < 24) {
      return `${diffInHours} hour${diffInHours === 1 ? "" : "s"} ago`;
    }
    if (diffInDays < 30) {
      return `${diffInDays} day${diffInDays === 1 ? "" : "s"} ago`;
    }
    if (diffInMonths < 12) {
      return `${diffInMonths} month${diffInMonths === 1 ? "" : "s"} ago`;
    }
    return `${diffInYears} year${diffInYears === 1 ? "" : "s"} ago`;
  }

  if (!lastActivity) {
    return <span className={`text-muted-foreground ${className}`}>Never</span>;
  }

  const activityDate =
    typeof lastActivity === "string" ? new Date(lastActivity) : lastActivity;

  const relativeTime = formatRelativeTime(activityDate);
  const isActive = relativeTime === "Active";

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {isActive && <div className="w-2 h-2 bg-success rounded-full"></div>}
      <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
        {relativeTime}
      </span>
    </div>
  );
}

export { ActivityStatusCell, AgentInfo, IntegrationInfo, UserInfo };
