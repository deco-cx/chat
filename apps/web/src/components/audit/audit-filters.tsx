import type { Agent, Member } from "@deco/sdk";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Combobox } from "@deco/ui/components/combobox.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { ChevronsUpDown } from "lucide-react";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { UserAvatar } from "../common/avatar/user.tsx";

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

  const selectedAgentData =
    selectedAgent && selectedAgent !== "all"
      ? agents.find((agent) => agent.id === selectedAgent)
      : undefined;

  const selectedUserData =
    selectedUser && selectedUser !== "all"
      ? sortedMembers.find((member) => member.user_id === selectedUser)
      : undefined;

  const selectedUserDisplayName = selectedUserData
    ? selectedUserData.profiles?.metadata?.full_name ||
      selectedUserData.profiles?.email ||
      selectedUserData.user_id
    : "";
  const selectedUserAvatarUrl =
    selectedUserData?.profiles?.metadata?.avatar_url;
  const selectedUserFallback = selectedUserDisplayName
    ? selectedUserDisplayName.substring(0, 2).toUpperCase()
    : "UN";

  const userOptions = [
    { value: "all", label: "All users" },
    { value: "unknown", label: "Unknown" },
    ...sortedMembers.map((member) => {
      const name =
        member.profiles?.metadata?.full_name ||
        member.profiles?.email ||
        member.user_id;
      return {
        value: member.user_id,
        label: name,
        meta: member,
      };
    }),
  ];

  const selectedUserOption = userOptions.find(
    (option) => option.value === (selectedUser ?? "all"),
  );

  return (
    <div className="flex gap-2 sm:gap-3 items-end overflow-x-auto w-full">
      <div className="flex flex-col gap-2 min-w-[150px] max-w-[200px] flex-1">
        <Combobox
          options={[
            { value: "all", label: "All agents" },
            ...agents.map((agent) => ({ value: agent.id, label: agent.name })),
          ]}
          value={selectedAgent ?? "all"}
          onChange={(value) => {
            const nextValue = value === "" ? "all" : value;
            onAgentChange(nextValue);
          }}
          triggerClassName="w-full"
          renderTrigger={() => (
            <Button
              variant="outline"
              role="combobox"
              className="w-full justify-between gap-2 max-w-full text-sm"
            >
              {selectedAgentData ? (
                <span className="flex items-center gap-2 truncate">
                  <AgentAvatar
                    url={selectedAgentData.avatar}
                    fallback={selectedAgentData.name}
                    size="xs"
                  />
                  <span className="truncate">{selectedAgentData.name}</span>
                </span>
              ) : (
                <span className="truncate">All agents</span>
              )}
              <ChevronsUpDown className="size-4 opacity-50" />
            </Button>
          )}
        />
      </div>
      <div className="flex flex-col gap-2 min-w-[140px] max-w-[190px] flex-1">
        <Select value={selectedUser ?? "all"} onValueChange={onUserChange}>
          <SelectTrigger id="user-select" className="w-full text-sm">
            {selectedUserOption && selectedUserOption.value !== "all" ? (
              selectedUserOption.value === "unknown" ? (
                <span className="flex items-center gap-1.5 truncate">
                  <UserAvatar fallback="UN" size="xs" muted />
                  <span className="truncate">Unknown</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 truncate">
                  <UserAvatar
                    url={selectedUserAvatarUrl}
                    fallback={selectedUserFallback}
                    size="xs"
                  />
                  <span className="truncate">{selectedUserDisplayName}</span>
                </span>
              )
            ) : (
              <SelectValue placeholder="All users" />
            )}
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            {userOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
