import { useAgents, useTeamMembers, useTeams } from "@deco/sdk";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { useMemo } from "react";
import { useParams } from "react-router";
import { Avatar } from "../avatar/index.tsx";
import { AgentAvatar } from "../avatar/agent.tsx";
import { useUser } from "../../../hooks/use-user.ts";
import { IntegrationIcon } from "../../integrations/common.tsx";
import { format } from "date-fns";

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
            fallback={agent?.name ?? agentId ?? "Unknown"}
            size="sm"
          />
          <span className="truncate hidden md:inline">
            {agent ? agent.name : agentId || "Unknown"}
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
}

function UserInfo({
  userId,
  className,
  showDetails = false,
}: UserInfoProps) {
  const user = useUser();
  const params = useParams();
  const resolvedTeamSlug = params.teamSlug;
  const { data: teams } = useTeams();
  const teamId = useMemo(
    () => teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null,
    [teams, resolvedTeamSlug],
  );

  // If userId matches current user, use user data directly
  const isCurrentUser = userId && user && userId === user.id;

  const { data: { members: teamMembers = [] } } = useTeamMembers(
    teamId ?? null,
  );
  const members = (!isCurrentUser && teamId !== null) ? teamMembers : [];
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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}
        >
          <Avatar
            shape="circle"
            url={avatarUrl}
            fallback={name}
            size="sm"
          />
          <div
            className={`flex-col items-start text-left leading-tight w-full ${
              showDetails ? "hidden md:flex" : "flex"
            }`}
          >
            <span className="truncate max-w-[120px] block text-xs font-medium text-foreground">
              {name || "Unknown"}
            </span>
            <span className="truncate max-w-[120px] block text-xs font-normal text-muted-foreground">
              {email || ""}
            </span>
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        {name
          ? (
            <div className="flex flex-col">
              <span>{name}</span>
              <span>{email}</span>
            </div>
          )
          : <span>{userId}</span>}
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
  integrationId?: string;
  className?: string;
}

function IntegrationInfo(
  { integration, integrationId, className }: IntegrationInfoProps,
) {
  if (integration) {
    return (
      <div
        className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}
      >
        <IntegrationIcon
          icon={integration.icon}
          className="h-10 w-10"
        />
        <span className="truncate hidden md:inline">{integration.name}</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}>
      <IntegrationIcon className="rounded-sm h-8 w-8" />
      <span className="truncate hidden md:inline">
        {integrationId || "Unknown"}
      </span>
    </div>
  );
}

export { AgentInfo, IntegrationInfo, UserInfo };
