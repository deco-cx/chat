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
import type { Agent, Member } from "@deco/sdk";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Combobox } from "@deco/ui/components/combobox.tsx";

interface AgentInfoProps {
  agentId?: string;
  className?: string;
  noTooltip?: boolean;
}

function AgentInfo({ agentId, className, noTooltip = false }: AgentInfoProps) {
  const { data: agents } = useAgents();
  const agent = useMemo(
    () => agents?.find((a) => a.id === agentId),
    [agents, agentId],
  );

  const content = (
    <div className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}>
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
  );

  if (noTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
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
  const { country, stateCode, formattedNumber, flagEmoji } =
    getPhoneMetadata(userId);

  const displayName = name || "Unknown";
  const displayEmail = email || "";
  const avatarFallback = stateCode
    ? stateCode
    : displayName.slice(0, 1).toUpperCase();

  const content = (
    <div className={`flex items-center gap-2 min-w-[48px] ${className ?? ""}`}>
      <div className="relative">
        <UserAvatar
          url={avatarUrl}
          fallback={avatarFallback}
          size="sm"
          className={stateCode ? "text-[13px] font-semibold" : undefined}
        />
        {flagEmoji ? (
          <span className="absolute -bottom-1 -left-1 text-[14px] drop-shadow">
            {flagEmoji}
          </span>
        ) : null}
      </div>
      <div
        className={`flex-col items-start text-left leading-tight w-full ${
          showDetails ? "hidden md:flex" : "flex"
        }`}
      >
        <span
          className="truncate block text-xs font-medium text-foreground"
          style={{ maxWidth }}
        >
          {displayName}
        </span>
        <span
          className="truncate block text-xs font-normal text-muted-foreground"
          style={{ maxWidth }}
        >
          {formattedNumber || displayEmail}
        </span>
      </div>
    </div>
  );

  if (noTooltip) return content;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col">
          <span>{displayName}</span>
          {displayEmail ? <span>{displayEmail}</span> : null}
          {formattedNumber ? <span>{formattedNumber}</span> : null}
          {country ? (
            <span className="text-xs text-muted-foreground">{country}</span>
          ) : null}
        </div>
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

interface PhoneMetadata {
  country?: string;
  stateCode?: string;
  formattedNumber?: string;
  flagEmoji?: string;
}

const BRAZIL_STATE_CODES: Record<string, string> = {
  "11": "SP",
  "12": "SP",
  "13": "SP",
  "14": "SP",
  "15": "SP",
  "16": "SP",
  "17": "SP",
  "18": "SP",
  "19": "SP",
  "21": "RJ",
  "22": "RJ",
  "24": "RJ",
  "27": "ES",
  "28": "ES",
  "31": "MG",
  "32": "MG",
  "33": "MG",
  "34": "MG",
  "35": "MG",
  "37": "MG",
  "38": "MG",
  "41": "PR",
  "42": "PR",
  "43": "PR",
  "44": "PR",
  "45": "PR",
  "46": "PR",
  "47": "SC",
  "48": "SC",
  "49": "SC",
  "51": "RS",
  "53": "RS",
  "54": "RS",
  "55": "RS",
  "61": "DF",
  "62": "GO",
  "64": "GO",
  "63": "TO",
  "65": "MT",
  "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA",
  "73": "BA",
  "74": "BA",
  "75": "BA",
  "77": "BA",
  "79": "SE",
  "81": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE",
  "88": "CE",
  "86": "PI",
  "89": "PI",
  "87": "PE",
  "90": "PE",
  "91": "PA",
  "93": "PA",
  "94": "PA",
  "92": "AM",
  "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA",
  "99": "MA",
};

const BRAZIL_STATES: Record<string, string> = {
  AC: "Acre",
  AL: "Alagoas",
  AM: "Amazonas",
  AP: "Amapá",
  BA: "Bahia",
  CE: "Ceará",
  DF: "Distrito Federal",
  ES: "Espírito Santo",
  GO: "Goiás",
  MA: "Maranhão",
  MG: "Minas Gerais",
  MS: "Mato Grosso do Sul",
  MT: "Mato Grosso",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  PR: "Paraná",
  RJ: "Rio de Janeiro",
  RN: "Rio Grande do Norte",
  RO: "Rondônia",
  RR: "Roraima",
  RS: "Rio Grande do Sul",
  SC: "Santa Catarina",
  SE: "Sergipe",
  SP: "São Paulo",
  TO: "Tocantins",
};

const US_STATE_CODES: Record<string, string> = {
  "201": "NJ",
  "202": "DC",
  "203": "CT",
  "205": "AL",
  "206": "WA",
  "207": "ME",
  "208": "ID",
  "209": "CA",
  "210": "TX",
  "212": "NY",
  "213": "CA",
  "214": "TX",
  "215": "PA",
  "216": "OH",
  "217": "IL",
  "218": "MN",
  "219": "IN",
  "220": "OH",
  // ... (additional US area codes as needed)
};

const COUNTRY_FLAGS: Record<string, string> = {
  BR: "🇧🇷",
  US: "🇺🇸",
};

function getPhoneMetadata(phone?: string | null): PhoneMetadata {
  if (!phone) return {};

  const normalized = phone.replace(/[^\d+]/g, "");

  if (normalized.startsWith("+55") || normalized.startsWith("55")) {
    const digits = normalized.replace(/^\+?55/, "");
    const areaCode = digits.substring(0, 2);
    const stateCode = BRAZIL_STATE_CODES[areaCode];
    const stateName = stateCode ? BRAZIL_STATES[stateCode] : undefined;
    const localNumber = digits.substring(2);
    const formatted = `+55 ${areaCode} ${localNumber.replace(
      /(\d{4,5})(\d{4})$/,
      "$1-$2",
    )}`;

    return {
      country: stateName ? `Brazil • ${stateName}` : "Brazil",
      stateCode,
      formattedNumber: formatted,
      flagEmoji: COUNTRY_FLAGS.BR,
    };
  }

  if (normalized.startsWith("+1") || normalized.startsWith("1")) {
    const digits = normalized.replace(/^\+?1/, "");
    const areaCode = digits.substring(0, 3);
    const stateCode = US_STATE_CODES[areaCode];
    const localNumber = digits.substring(3);
    const formatted = `+1 (${areaCode}) ${localNumber.replace(
      /(\d{3})(\d{4})$/,
      "$1-$2",
    )}`;

    return {
      country: stateCode ? `United States • ${stateCode}` : "United States",
      stateCode,
      formattedNumber: formatted,
      flagEmoji: COUNTRY_FLAGS.US,
    };
  }

  return {
    formattedNumber: normalized,
  };
}

interface AuditFiltersProps {
  agents: Agent[];
  members: Member[];
  selectedAgent?: string;
  selectedUser?: string;
  onAgentChange: (value: string) => void;
  onUserChange: (value: string) => void;
}

export function AuditFilters({
  agents,
  members,
  selectedAgent,
  selectedUser,
  onAgentChange,
  onUserChange,
}: AuditFiltersProps) {
  // Ordenar membros por nome
  const sortedMembers = [...(members ?? [])].sort((a, b) => {
    const nameA =
      a.profiles?.metadata?.full_name || a.profiles?.email || a.user_id;
    const nameB =
      b.profiles?.metadata?.full_name || b.profiles?.email || b.user_id;
    return nameA.localeCompare(nameB);
  });

  return (
    <div className="flex gap-4 items-end overflow-x-auto">
      <div className="flex flex-col gap-2 min-w-[180px]">
        <Combobox
          options={[
            { value: "all", label: "All agents" },
            ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
          ]}
          value={selectedAgent ?? "all"}
          onChange={(value) => {
            onAgentChange(value);
          }}
        />
      </div>
      {sortedMembers.length > 0 && (
        <div className="flex flex-col gap-2 min-w-[180px]">
          <Select value={selectedUser ?? "all"} onValueChange={onUserChange}>
            <SelectTrigger id="user-select" className="w-full">
              <SelectValue placeholder="All users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {sortedMembers.map((member) => {
                const name =
                  member.profiles?.metadata?.full_name ||
                  member.profiles?.email ||
                  member.user_id;
                const email = member.profiles?.email;
                return (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <span>
                      {name}
                      {email && email !== name && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {email}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
