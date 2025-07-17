import {
  type ChangeEvent,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Agent,
  type Integration,
  listTools,
  type MCPTool,
  type Member,
  type RoleFormData,
  type TeamRole,
  useAgents,
  useCreateTeamRole,
  useDeleteTeamRole,
  useIntegrations,
  useTeamMembers,
  useTeamRoles,
  useTools,
  useUpdateTeamRole,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Table, TableColumn } from "../../common/table/index.tsx";
import { useParams } from "react-router";
import { UserAvatar } from "../../common/avatar/user.tsx";
import { useUser } from "../../../hooks/use-user.ts";
import { useTeams } from "@deco/sdk";
import { AgentAvatar } from "../../common/avatar/agent.tsx";
import { IntegrationAvatar } from "../../common/avatar/integration.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@deco/ui/components/sidebar.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import { Checkbox } from "@deco/ui/components/checkbox.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Label } from "@deco/ui/components/label.tsx";

// Internal form data type with simplified tools format
interface InternalRoleFormData {
  name: string;
  description?: string;
  tools: Record<string, string[]>; // Simplified internal format
  agents: string[];
  members: string[];
}

interface RoleDialogUserInfoProps {
  userId: string;
}

interface RoleDialogIntegrationListItemProps {
  toolsSet: Record<string, string[]>;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  integration: Integration;
  searchTerm?: string;
  onNavigateToIntegration?: (integration: Integration) => void;
}

interface IntegrationDetailViewProps {
  integration: Integration;
  toolsSet: Record<string, string[]>;
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  onBack: () => void;
}

interface AddRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role?: TeamRole;
  teamId?: number;
  onSave: (roleData: InternalRoleFormData, isEditing: boolean) => void;
  initialTab?: string;
}

interface RoleDialogSidebarProps {
  selectedTab: string;
  onTabChange: (tab: string) => void;
  selectedToolsCount: number;
  selectedAgentsCount: number;
  selectedMembersCount: number;
  onToolsTabClick: () => void;
}

interface RoleGeneralPanelProps {
  formData: InternalRoleFormData;
  setFormData: (
    data:
      | InternalRoleFormData
      | ((prev: InternalRoleFormData) => InternalRoleFormData),
  ) => void;
}

interface RoleToolsPanelProps {
  formData: InternalRoleFormData;
  setFormData: (
    data:
      | InternalRoleFormData
      | ((prev: InternalRoleFormData) => InternalRoleFormData),
  ) => void;
  currentView: string;
  selectedIntegration: Integration | null;
  toolsSearch: string;
  setToolsSearch: (search: string) => void;
  selectingAllTools: boolean;
  setSelectingAllTools: (selecting: boolean) => void;
  filteredIntegrations: Integration[];
  setIntegrationTools: (integrationId: string, tools: string[]) => void;
  handleNavigateToIntegration: (integration: Integration) => void;
  handleBackToIntegrations: () => void;
}

interface RoleAgentsPanelProps {
  formData: InternalRoleFormData;
  setFormData: (
    data:
      | InternalRoleFormData
      | ((prev: InternalRoleFormData) => InternalRoleFormData),
  ) => void;
  agentsSearch: string;
  setAgentsSearch: (search: string) => void;
  filteredAgents: Agent[];
  agents: Agent[];
  handleAgentToggle: (agentId: string, checked: boolean) => void;
}

interface RoleMembersPanelProps {
  formData: InternalRoleFormData;
  setFormData: (
    data:
      | InternalRoleFormData
      | ((prev: InternalRoleFormData) => InternalRoleFormData),
  ) => void;
  membersSearch: string;
  setMembersSearch: (search: string) => void;
  filteredMembers: Member[];
  handleMemberToggle: (userId: string, checked: boolean) => void;
}

interface RolesTableViewProps {
  teamId?: number;
}

// Sub-Components for Role Dialog
function RoleDialogSidebar({
  selectedTab,
  onTabChange,
  selectedToolsCount,
  selectedAgentsCount,
  selectedMembersCount,
  onToolsTabClick,
}: RoleDialogSidebarProps) {
  return (
    <div className="w-48 pr-4 flex-shrink-0">
      <SidebarMenu className="gap-0.5">
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={selectedTab === "general"}
            onClick={() => onTabChange("general")}
            className="cursor-pointer justify-between"
          >
            <span>General</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={selectedTab === "tools"}
            onClick={onToolsTabClick}
            className="cursor-pointer justify-between"
          >
            <span>Tools</span>
            {selectedToolsCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {selectedToolsCount}
              </Badge>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={selectedTab === "agents"}
            onClick={() => onTabChange("agents")}
            className="cursor-pointer justify-between"
          >
            <span>Agents</span>
            {selectedAgentsCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {selectedAgentsCount}
              </Badge>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            isActive={selectedTab === "members"}
            onClick={() => onTabChange("members")}
            className="cursor-pointer justify-between"
          >
            <span>Members</span>
            {selectedMembersCount > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {selectedMembersCount}
              </Badge>
            )}
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </div>
  );
}

function RoleGeneralPanel({ formData, setFormData }: RoleGeneralPanelProps) {
  const handleNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setFormData((prev: InternalRoleFormData) => ({
        ...prev,
        name: e.target.value,
      }));
    },
    [setFormData],
  );

  const handleDescriptionChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      setFormData((prev: InternalRoleFormData) => ({
        ...prev,
        description: e.target.value,
      }));
    },
    [setFormData],
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="role-name" className="text-sm font-medium">
          Name
        </Label>
        <Input
          id="role-name"
          value={formData.name}
          onChange={handleNameChange}
          placeholder="Enter role name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role-description" className="text-sm font-medium">
          Description
        </Label>
        <Textarea
          id="role-description"
          value={formData.description}
          onChange={handleDescriptionChange}
          placeholder="Describe what this role can do"
          rows={3}
        />
      </div>
    </div>
  );
}

function RoleToolsPanel({
  formData,
  setFormData,
  currentView,
  selectedIntegration,
  toolsSearch,
  setToolsSearch,
  selectingAllTools,
  setSelectingAllTools,
  filteredIntegrations,
  setIntegrationTools,
  handleNavigateToIntegration,
  handleBackToIntegrations,
}: RoleToolsPanelProps) {
  const handleToolsSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setToolsSearch(e.target.value);
    },
    [setToolsSearch],
  );

  const handleSelectAll = useCallback(async () => {
    const hasAnySelected = Object.values(formData.tools).some(
      (tools) => Array.isArray(tools) && tools.length > 0,
    );

    if (hasAnySelected) {
      setFormData((prev: InternalRoleFormData) => ({ ...prev, tools: {} }));
    } else {
      setSelectingAllTools(true);
      const newTools: Record<string, string[]> = {};

      try {
        for (const integration of filteredIntegrations) {
          try {
            const toolsData = await listTools(integration.connection);
            const toolNames = toolsData.tools?.map(
              (tool: { name: string; description?: string }) => tool.name,
            ) || [];
            newTools[integration.id] = toolNames;
          } catch (error) {
            console.error(
              `Failed to load tools for ${integration.name}:`,
              error,
            );
            newTools[integration.id] = [];
          }
        }

        setFormData((prev: InternalRoleFormData) => ({
          ...prev,
          tools: newTools,
        }));
      } finally {
        setSelectingAllTools(false);
      }
    }
  }, [formData.tools, filteredIntegrations, setFormData, setSelectingAllTools]);

  const totalSelectedTools = useMemo(
    () =>
      Object.values(formData.tools).reduce(
        (acc: number, tools) => acc + (Array.isArray(tools) ? tools.length : 0),
        0,
      ),
    [formData.tools],
  );

  const selectedIntegrations = useMemo(
    () =>
      Object.keys(formData.tools).filter((id) => {
        const tools = formData.tools[id];
        return Array.isArray(tools) && tools.length > 0;
      }).length,
    [formData.tools],
  );

  return (
    <div className="space-y-4">
      {currentView === "integrations"
        ? (
          <>
            <Input
              placeholder="Search integrations..."
              value={toolsSearch}
              onChange={handleToolsSearchChange}
              className="w-full"
            />

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {totalSelectedTools} tools from {selectedIntegrations}{" "}
                integrations
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={selectingAllTools}
                onClick={handleSelectAll}
              >
                {selectingAllTools
                  ? "Loading..."
                  : Object.values(formData.tools).some(
                      (tools) => Array.isArray(tools) && tools.length > 0,
                    )
                  ? "Deselect All"
                  : "Select All"}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredIntegrations.map((integration) => (
                <RoleDialogIntegrationListItem
                  key={integration.id}
                  toolsSet={formData.tools}
                  setIntegrationTools={setIntegrationTools}
                  integration={integration}
                  searchTerm=""
                  onNavigateToIntegration={handleNavigateToIntegration}
                />
              ))}
              {filteredIntegrations.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No integrations found.
                </div>
              )}
            </div>
          </>
        )
        : currentView === "integration-detail" && selectedIntegration
        ? (
          <IntegrationDetailView
            integration={selectedIntegration}
            toolsSet={formData.tools}
            setIntegrationTools={setIntegrationTools}
            onBack={handleBackToIntegrations}
          />
        )
        : null}
    </div>
  );
}

function RoleAgentsPanel({
  formData,
  setFormData,
  agentsSearch,
  setAgentsSearch,
  filteredAgents,
  agents,
  handleAgentToggle,
}: RoleAgentsPanelProps) {
  const handleAgentsSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setAgentsSearch(e.target.value);
    },
    [setAgentsSearch],
  );

  const handleSelectAllAgents = useCallback(() => {
    if (formData.agents.length > 0) {
      setFormData((prev) => ({ ...prev, agents: [] }));
    } else {
      const allAgentIds = filteredAgents.map((agent) => agent.id);
      setFormData((prev) => ({
        ...prev,
        agents: allAgentIds,
      }));
    }
  }, [formData.agents.length, filteredAgents, setFormData]);

  const hasAgentsWithMissingTools = useMemo(
    () =>
      formData.agents.some((agentId) => {
        const agent = agents.find((a) => a.id === agentId);
        const agentTools = agent?.tools_set || {};
        return Object.keys(agentTools).some(
          (integrationId) =>
            !formData.tools[integrationId] ||
            !Array.isArray(formData.tools[integrationId]) ||
            formData.tools[integrationId].length === 0,
        );
      }),
    [formData.agents, formData.tools, agents],
  );

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search agents..."
        value={agentsSearch}
        onChange={handleAgentsSearchChange}
        className="w-full"
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {formData.agents.length} agents selected
        </span>
        <Button variant="outline" size="sm" onClick={handleSelectAllAgents}>
          {formData.agents.length > 0 ? "Deselect All" : "Select All"}
        </Button>
      </div>

      {hasAgentsWithMissingTools && (
        <Alert variant="warning">
          <Icon name="warning" />
          <AlertDescription>
            Some selected agents have tools that this role doesn't have access
            to. Those tools will be automatically added.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredAgents.map((agent) => (
          <Card
            key={agent.id}
            className="w-full cursor-pointer"
            onClick={() =>
              handleAgentToggle(agent.id, !formData.agents.includes(agent.id))}
          >
            <CardContent className="flex items-start p-3 w-full">
              <AgentAvatar
                url={agent.avatar}
                fallback={agent.name}
                size="base"
              />
              <div className="flex flex-col items-start text-left leading-tight w-full min-w-0 ml-3 pr-3">
                <span
                  className="truncate block text-sm font-medium text-foreground"
                  style={{ maxWidth: "300px" }}
                >
                  {agent.name}
                </span>
                <span
                  className="block text-xs font-normal text-muted-foreground break-words whitespace-pre-line"
                  style={{
                    maxWidth: "300px",
                    wordBreak: "break-word",
                  }}
                >
                  {agent.description || "No description"}
                </span>
              </div>
              <div
                className="ml-auto flex items-start"
                onClick={(e) => e.stopPropagation()}
              >
                <Checkbox
                  checked={formData.agents.includes(agent.id)}
                  onCheckedChange={(checked: boolean) =>
                    handleAgentToggle(agent.id, checked as boolean)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredAgents.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No agents found.
          </div>
        )}
      </div>
    </div>
  );
}

function RoleMembersPanel({
  formData,
  setFormData,
  membersSearch,
  setMembersSearch,
  filteredMembers,
  handleMemberToggle,
}: RoleMembersPanelProps) {
  const handleMembersSearchChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setMembersSearch(e.target.value);
    },
    [setMembersSearch],
  );

  const handleSelectAllMembers = useCallback(() => {
    if (formData.members.length > 0) {
      setFormData((prev) => ({ ...prev, members: [] }));
    } else {
      const allMemberIds = filteredMembers.map((member) => member.user_id);
      setFormData((prev) => ({
        ...prev,
        members: allMemberIds,
      }));
    }
  }, [formData.members.length, filteredMembers, setFormData]);

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search members..."
        value={membersSearch}
        onChange={handleMembersSearchChange}
        className="w-full"
      />

      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {formData.members.length} members selected
        </span>
        <Button variant="outline" size="sm" onClick={handleSelectAllMembers}>
          {formData.members.length > 0 ? "Deselect All" : "Select All"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredMembers.map((member) => {
          const memberCurrentRoles = member.roles || [];

          return (
            <Card
              key={member.id}
              className="w-full cursor-pointer"
              onClick={() =>
                handleMemberToggle(
                  member.user_id,
                  !formData.members.includes(member.user_id),
                )}
            >
              <CardContent className="flex items-start p-3 w-full">
                <div className="flex flex-col w-full pr-3">
                  <RoleDialogUserInfo userId={member.user_id} />
                  {memberCurrentRoles.length > 0 && (
                    <div className="mt-2">
                      <div className="flex flex-wrap gap-1">
                        {memberCurrentRoles.map((role) => (
                          <Badge
                            key={role.id}
                            variant="secondary"
                            className="text-xs"
                          >
                            {role.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div
                  className="ml-auto flex items-start"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Checkbox
                    checked={formData.members.includes(member.user_id)}
                    onCheckedChange={(checked: boolean) =>
                      handleMemberToggle(member.user_id, checked)}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredMembers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No members found.
          </div>
        )}
      </div>
    </div>
  );
}

function RoleDialogUserInfo({ userId }: RoleDialogUserInfoProps) {
  const user = useUser();
  const params = useParams();
  const resolvedTeamSlug = params.teamSlug;
  const { data: teams } = useTeams();

  const teamId: number | null = useMemo(
    () => teams?.find((t) => t.slug === resolvedTeamSlug)?.id ?? null,
    [teams, resolvedTeamSlug],
  );

  const isCurrentUser: boolean = useMemo(
    () => !!userId && !!user && userId === user.id,
    [userId, user],
  );

  const {
    data: { members: teamMembers = [] },
  } = useTeamMembers(teamId ?? null);

  const members: typeof teamMembers = useMemo(
    () => (!isCurrentUser && teamId !== null ? teamMembers : []),
    [isCurrentUser, teamId, teamMembers],
  );

  const member = useMemo(
    () => members.find((m) => m.user_id === userId),
    [members, userId],
  );

  const avatarData = useMemo(
    () => ({
      url: isCurrentUser
        ? user?.metadata.avatar_url
        : member?.profiles?.metadata?.avatar_url,
      name: isCurrentUser
        ? user?.metadata.full_name
        : member?.profiles?.metadata?.full_name,
      email: isCurrentUser ? user?.email : member?.profiles?.email,
    }),
    [isCurrentUser, user, member],
  );

  return (
    <div className="flex items-center gap-2 min-w-[48px]">
      <UserAvatar url={avatarData.url} fallback={avatarData.name} size="base" />
      <div className="flex flex-col items-start text-left leading-tight w-full">
        <span
          className="truncate block text-sm font-medium text-foreground"
          style={{ maxWidth: "300px" }}
        >
          {avatarData.name || "Unknown"}
        </span>
        <span
          className="truncate block text-xs font-normal text-muted-foreground"
          style={{ maxWidth: "300px" }}
        >
          {avatarData.email || ""}
        </span>
      </div>
    </div>
  );
}

function RoleDialogIntegrationListItem({
  toolsSet,
  setIntegrationTools,
  integration,
  onNavigateToIntegration,
}: RoleDialogIntegrationListItemProps) {
  const { data: toolsData, isLoading } = useTools(integration.connection);

  const toolsInfo: {
    total: number;
    allTools: MCPTool[];
    enabledCount: number;
    isAll: boolean;
    isEmpty: boolean;
  } = useMemo(() => {
    const total = toolsData?.tools?.length ?? 0;
    const allTools = toolsData?.tools || [];
    const enabledCount = allTools.filter((tool) =>
      toolsSet[integration.id]?.includes(tool.name)
    ).length;
    const isAll = enabledCount === total && total > 0;
    const isEmpty = !isLoading && allTools.length === 0;

    return { total, allTools, enabledCount, isAll, isEmpty };
  }, [toolsData, toolsSet, integration.id, isLoading]);

  const handleAll = useCallback(
    (checked: boolean) => {
      setIntegrationTools(
        integration.id,
        checked ? toolsInfo.allTools.map((tool) => tool.name) : [],
      );
    },
    [integration.id, setIntegrationTools, toolsInfo.allTools],
  );

  const handleClick = useCallback(() => {
    if (!toolsInfo.isEmpty) {
      onNavigateToIntegration?.(integration);
    }
  }, [toolsInfo.isEmpty, onNavigateToIntegration, integration]);

  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
    },
    [],
  );

  return (
    <Card
      key={integration.id}
      className={`w-full ${
        toolsInfo.isEmpty ? "cursor-default" : "cursor-pointer"
      }`}
      onClick={handleClick}
    >
      <CardContent className="flex items-center justify-between p-3 w-full">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <IntegrationAvatar
            url={integration.icon}
            fallback={integration.name}
            size="base"
          />
          <div className="flex flex-col min-w-0">
            <h4 className="text-sm font-medium truncate text-foreground">
              {integration.name}
            </h4>
            <p className="text-xs text-muted-foreground truncate">
              {isLoading
                ? <Skeleton className="h-3 w-16" />
                : toolsInfo.isEmpty
                ? (
                  "No tools available"
                )
                : (
                  `${toolsInfo.enabledCount}/${toolsInfo.total} tools selected`
                )}
            </p>
          </div>
        </div>

        {!toolsInfo.isEmpty && (
          <div className="flex items-center gap-2 ml-4">
            <Checkbox
              checked={toolsInfo.isAll}
              onCheckedChange={handleAll}
              onClick={handleCheckboxClick}
            />
            <Icon name="chevron_right" size={20} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IntegrationDetailView({
  integration,
  toolsSet,
  setIntegrationTools,
  onBack,
}: IntegrationDetailViewProps) {
  const { data: toolsData, isLoading } = useTools(integration.connection);
  const [toolsSearch, setToolsSearch] = useState("");

  const toolsInfo: {
    total: number;
    allTools: MCPTool[];
    enabledCount: number;
    isAll: boolean;
  } = useMemo(() => {
    const total = toolsData?.tools?.length ?? 0;
    const allTools = toolsData?.tools || [];
    const enabledCount = allTools.filter((tool) =>
      toolsSet[integration.id]?.includes(tool.name)
    ).length;
    const isAll = enabledCount === total && total > 0;

    return { total, allTools, enabledCount, isAll };
  }, [toolsData, toolsSet, integration.id]);

  // Filter tools based on search with memoization
  const filteredTools: MCPTool[] = useMemo(
    () =>
      toolsInfo.allTools.filter((tool) => {
        if (!toolsSearch) return true;
        const searchTerm = toolsSearch.toLowerCase();
        const toolNameFormatted = tool.name.replace(/_/g, " ").toLowerCase();
        const toolNameOriginal = tool.name.toLowerCase();
        const toolDescription = tool.description?.toLowerCase() || "";
        return (
          toolNameFormatted.includes(searchTerm) ||
          toolNameOriginal.includes(searchTerm) ||
          toolDescription.includes(searchTerm)
        );
      }),
    [toolsInfo.allTools, toolsSearch],
  );

  const handleAll = useCallback(
    (checked: boolean) => {
      setIntegrationTools(
        integration.id,
        checked ? toolsInfo.allTools.map((tool) => tool.name) : [],
      );
    },
    [integration.id, setIntegrationTools, toolsInfo.allTools],
  );

  return (
    <div className="space-y-4">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
          onClick={onBack}
          className="text-primary hover:text-primary/80 cursor-pointer"
        >
          Tools
        </button>
        <Icon name="chevron_right" size={16} />
        <span className="text-foreground">{integration.name}</span>
      </div>

      {/* Integration header */}
      <div className="flex items-center gap-3 py-4">
        <IntegrationAvatar
          url={integration.icon}
          fallback={integration.name}
          size="base"
        />
        <div className="flex flex-col min-w-0">
          <h3 className="text-base font-semibold text-foreground">
            {integration.name}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isLoading ? <Skeleton className="h-4 w-24" /> : (
              `${toolsInfo.total} tools available`
            )}
          </p>
        </div>
      </div>

      {/* Tools search and controls */}
      <div className="space-y-3">
        <Input
          placeholder="Search tools..."
          value={toolsSearch}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setToolsSearch(e.target.value)}
          className="w-full"
        />

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {toolsInfo.enabledCount} of {filteredTools.length} tools selected
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={isLoading || toolsInfo.total === 0}
            onClick={() => handleAll(!toolsInfo.isAll)}
          >
            {toolsInfo.isAll ? "Deselect All" : "Select All"}
          </Button>
        </div>
      </div>

      {/* Tools list */}
      <div className="space-y-2">
        {isLoading
          ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-5 w-5" />
                </div>
              ))}
            </div>
          )
          : filteredTools.length === 0
          ? (
            <div className="text-center py-8 text-muted-foreground">
              {toolsSearch
                ? "No tools match your search."
                : "No tools available."}
            </div>
          )
          : (
            filteredTools.map((tool) => {
              const enabled = toolsSet[integration.id]?.includes(tool.name) ??
                false;
              const handleCheckboxChange = (checked: boolean) => {
                const withoutTool = toolsSet[integration.id]?.filter(
                  (t) => t !== tool.name,
                );
                const withTool = [
                  ...(toolsSet[integration.id] || []),
                  tool.name,
                ];
                const toolsToUpdate = checked ? withTool : withoutTool;
                setIntegrationTools(integration.id, toolsToUpdate);
              };

              return (
                <label
                  key={tool.name}
                  className="flex items-start justify-between gap-3 p-3 border rounded-xl cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate text-foreground">
                      {tool.name
                        .replace(/_/g, " ")
                        .toLowerCase()
                        .replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    </span>
                    <span className="text-xs text-muted-foreground break-words">
                      {tool.description || "No description"}
                    </span>
                  </div>
                  <Checkbox
                    checked={enabled}
                    onCheckedChange={handleCheckboxChange}
                    className="cursor-pointer mt-0.5 flex-shrink-0"
                  />
                </label>
              );
            })
          )}
      </div>
    </div>
  );
}

function AddRoleDialog({
  open,
  onOpenChange,
  role,
  teamId,
  onSave,
  initialTab = "general",
}: AddRoleDialogProps) {
  const {
    data: { members },
  } = useTeamMembers(teamId ?? null);
  // Convert external role to internal format for editing
  const convertToInternal = (role?: TeamRole): InternalRoleFormData => {
    if (!role) {
      return {
        name: "",
        description: "",
        tools: {},
        agents: [],
        members: [],
      };
    }

    // Convert tools from API format to internal format
    const internalTools: Record<string, string[]> = {};
    if (role.tools) {
      Object.entries(role.tools).forEach(([integrationId, tools]) => {
        internalTools[integrationId] = tools.map((tool) =>
          typeof tool === "string" ? tool : tool.toolName
        );
      });
    }

    return {
      name: role.name || "",
      description: role.description || "",
      tools: internalTools,
      agents: role.agents || [],
      members: role.members || [],
    };
  };

  const [formData, setFormData] = useState<InternalRoleFormData>(() =>
    convertToInternal(role)
  );
  const [selectedTab, setSelectedTab] = useState(initialTab);
  const { data: integrations = [] } = useIntegrations();
  const { data: agents = [] } = useAgents();

  // Search states for each section
  const [toolsSearch, setToolsSearch] = useState("");
  const [agentsSearch, setAgentsSearch] = useState("");
  const [membersSearch, setMembersSearch] = useState("");
  const [selectingAllTools, setSelectingAllTools] = useState(false);

  // Navigation state for tools section
  const [currentView, setCurrentView] = useState<
    "integrations" | "integration-detail"
  >("integrations");
  const [selectedIntegration, setSelectedIntegration] = useState<
    Integration | null
  >(null);

  // Ref for the scrollable content area
  const contentAreaRef = useRef<HTMLDivElement>(null);

  // Reset selected tab when dialog opens/closes or role changes
  useEffect(() => {
    if (open) {
      setSelectedTab(initialTab);
      // Reset navigation state when dialog opens
      setCurrentView("integrations");
      setSelectedIntegration(null);
    }
  }, [open, initialTab]);

  // Reset navigation state when switching tabs
  useEffect(() => {
    if (selectedTab !== "tools") {
      setCurrentView("integrations");
      setSelectedIntegration(null);
    }
  }, [selectedTab]);

  const availableIntegrations = integrations.filter(
    (i) =>
      i.id.startsWith("i:") &&
      !["i:user-management", "i:workspace-management"].includes(i.id),
  );

  // Use deferred values for search to prevent blocking input
  const deferredToolsSearch = useDeferredValue(toolsSearch);
  const deferredAgentsSearch = useDeferredValue(agentsSearch);
  const deferredMembersSearch = useDeferredValue(membersSearch);

  // Memoized filtered data based on search
  const filteredIntegrations = useMemo(
    () =>
      availableIntegrations.filter((integration) =>
        integration.name
          .toLowerCase()
          .includes(deferredToolsSearch.toLowerCase())
      ),
    [availableIntegrations, deferredToolsSearch],
  );

  const filteredAgents = useMemo(
    () =>
      agents.filter(
        (agent) =>
          agent.name
            .toLowerCase()
            .includes(deferredAgentsSearch.toLowerCase()) ||
          (agent.description || "")
            .toLowerCase()
            .includes(deferredAgentsSearch.toLowerCase()),
      ),
    [agents, deferredAgentsSearch],
  );

  const filteredMembers = useMemo(
    () =>
      members.filter((member) => {
        const name = member.profiles.metadata.full_name || "";
        const email = member.profiles.email || "";
        const searchTerm = deferredMembersSearch.toLowerCase();
        return (
          name.toLowerCase().includes(searchTerm) ||
          email.toLowerCase().includes(searchTerm)
        );
      }),
    [members, deferredMembersSearch],
  );

  const setIntegrationTools = useCallback(
    (integrationId: string, tools: string[]) => {
      setFormData((prev: InternalRoleFormData) => ({
        ...prev,
        tools: {
          ...prev.tools,
          [integrationId]: tools,
        },
      }));
    },
    [],
  );

  // Navigation handlers for tools section
  const handleNavigateToIntegration = useCallback(
    (integration: Integration) => {
      setSelectedIntegration(integration);
      setCurrentView("integration-detail");
      // Reset scroll to top when navigating to integration detail
      setTimeout(() => {
        if (contentAreaRef.current) {
          contentAreaRef.current.scrollTop = 0;
        }
      }, 10);
    },
    [],
  );

  const handleBackToIntegrations = useCallback(() => {
    setCurrentView("integrations");
    setSelectedIntegration(null);
    // Reset scroll to top when going back to integrations list
    setTimeout(() => {
      if (contentAreaRef.current) {
        contentAreaRef.current.scrollTop = 0;
      }
    }, 10);
  }, []);

  const handleAgentToggle = useCallback(
    (agentId: string, checked: boolean) => {
      if (checked) {
        const agent = agents.find((a) => a.id === agentId);
        const agentTools = agent?.tools_set || {};
        const roleTools = formData.tools;

        const missingIntegrations: string[] = [];
        Object.keys(agentTools).forEach((integrationId) => {
          if (
            !roleTools[integrationId] ||
            roleTools[integrationId].length === 0
          ) {
            missingIntegrations.push(integrationId);
          }
        });

        // Automatically add missing tools
        if (missingIntegrations.length > 0) {
          missingIntegrations.forEach((integrationId) => {
            const agentIntegrationTools = agentTools[integrationId] || [];
            setIntegrationTools(integrationId, agentIntegrationTools);
          });
        }

        setFormData((prev) => ({
          ...prev,
          agents: [...prev.agents, agentId],
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          agents: prev.agents.filter((id) => id !== agentId),
        }));
      }
    },
    [agents, formData.tools, setIntegrationTools],
  );

  const handleMemberToggle = useCallback((userId: string, checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      members: checked
        ? [...prev.members, userId]
        : prev.members.filter((id) => id !== userId),
    }));
  }, []);

  // Update formData when role prop changes
  useEffect(() => {
    if (role) {
      setFormData({
        name: role.name || "",
        description: role.description || "",
        tools: Object.fromEntries(
          Object.entries(role.tools || {}).map(([integrationId, tools]) => [
            integrationId,
            tools.map((tool) =>
              typeof tool === "string" ? tool : tool.toolName
            ),
          ]),
        ),
        agents: role.agents || [],
        members: role.members || [],
      });
    } else {
      setFormData({
        name: "",
        description: "",
        tools: {},
        agents: [],
        members: [],
      });
    }
  }, [role]);

  const handleSave = () => {
    onSave(formData, !!role);
    onOpenChange(false);
    toast.success(
      role ? "Role updated successfully" : "Role created successfully",
    );
  };

  // Memoized counts for display to prevent recalculation on every render
  const selectedToolsCount = useMemo(
    () =>
      Object.values(formData.tools).reduce(
        (total: number, tools) =>
          total + (Array.isArray(tools) ? tools.length : 0),
        0,
      ),
    [formData.tools],
  );

  const selectedAgentsCount = useMemo(
    () => formData.agents.length,
    [formData.agents.length],
  );

  const selectedMembersCount = useMemo(
    () => formData.members.length,
    [formData.members.length],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit min-w-[900px] max-w-[95vw] max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{role ? "Edit Role" : "Add New Role"}</DialogTitle>
        </DialogHeader>

        <div className="flex h-[60vh]">
          {/* Left sidebar menu */}
          <RoleDialogSidebar
            selectedTab={selectedTab}
            onTabChange={setSelectedTab}
            selectedToolsCount={selectedToolsCount}
            selectedAgentsCount={selectedAgentsCount}
            selectedMembersCount={selectedMembersCount}
            onToolsTabClick={() => {
              setSelectedTab("tools");
              // If we're in integration detail view, go back to integrations list
              if (currentView === "integration-detail") {
                handleBackToIntegrations();
              }
            }}
          />

          {/* Right content area */}
          <div
            ref={contentAreaRef}
            className="flex-1 pl-6 overflow-y-auto min-w-0"
          >
            {selectedTab === "general" && (
              <RoleGeneralPanel formData={formData} setFormData={setFormData} />
            )}

            {selectedTab === "tools" && (
              <RoleToolsPanel
                formData={formData}
                setFormData={setFormData}
                currentView={currentView}
                selectedIntegration={selectedIntegration}
                toolsSearch={toolsSearch}
                setToolsSearch={setToolsSearch}
                selectingAllTools={selectingAllTools}
                setSelectingAllTools={setSelectingAllTools}
                filteredIntegrations={filteredIntegrations}
                setIntegrationTools={setIntegrationTools}
                handleNavigateToIntegration={handleNavigateToIntegration}
                handleBackToIntegrations={handleBackToIntegrations}
              />
            )}

            {selectedTab === "agents" && (
              <RoleAgentsPanel
                formData={formData}
                setFormData={setFormData}
                agentsSearch={agentsSearch}
                setAgentsSearch={setAgentsSearch}
                filteredAgents={filteredAgents}
                agents={agents}
                handleAgentToggle={handleAgentToggle}
              />
            )}

            {selectedTab === "members" && (
              <RoleMembersPanel
                formData={formData}
                setFormData={setFormData}
                membersSearch={membersSearch}
                setMembersSearch={setMembersSearch}
                filteredMembers={filteredMembers}
                handleMemberToggle={handleMemberToggle}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            {role ? "Update Role" : "Create Role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Sub-Components for Roles Table View
export function RolesTableView({ teamId }: RolesTableViewProps) {
  // Data fetching hooks
  const { data: roles = [] } = useTeamRoles(teamId ?? null);
  const { data: agents = [] } = useAgents();
  const { data: integrations = [] } = useIntegrations();
  const {
    data: { members },
  } = useTeamMembers(teamId ?? null, {
    withActivity: true,
  });
  const createRoleMutation = useCreateTeamRole();
  const updateRoleMutation = useUpdateTeamRole();
  const deleteRoleMutation = useDeleteTeamRole();

  // Local state
  const [rolesQuery, setRolesQuery] = useState("");
  const [rolesSortKey, setRolesSortKey] = useState<string>("tools");
  const [rolesSortDirection, setRolesSortDirection] = useState<"asc" | "desc">(
    "desc",
  );
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<TeamRole | undefined>(
    undefined,
  );
  const [roleDialogInitialTab, setRoleDialogInitialTab] = useState("general");

  // Utility Functions
  function mapRoleDataToFormData(roleData: InternalRoleFormData): RoleFormData {
    return {
      ...roleData,
      tools: Object.fromEntries(
        Object.entries(roleData.tools).map(([integrationId, tools]) => [
          integrationId,
          tools.map((tool) =>
            typeof tool === "string"
              ? { toolName: tool, effect: "allow" as const }
              : tool
          ),
        ]),
      ),
    };
  }

  const handleCreateRole = useCallback(
    async (roleData: InternalRoleFormData) => {
      if (!teamId) return;
      try {
        await createRoleMutation.mutateAsync({
          teamId,
          roleData: mapRoleDataToFormData(roleData),
        });
        toast.success("Role created successfully");
      } catch (error) {
        toast.error("Failed to create role");
        console.error("Role create error:", error);
      }
    },
    [teamId, createRoleMutation],
  );

  const handleUpdateRole = useCallback(
    async (roleId: number, roleData: InternalRoleFormData) => {
      if (!teamId) return;
      try {
        await updateRoleMutation.mutateAsync({
          teamId,
          roleId,
          roleData: mapRoleDataToFormData(roleData),
        });
        toast.success("Role updated successfully");
      } catch (error) {
        toast.error("Failed to update role");
        console.error("Role update error:", error);
      }
    },
    [teamId, updateRoleMutation],
  );

  const handleRolesSort = useCallback(
    (key: string) => {
      if (rolesSortKey === key) {
        setRolesSortDirection((prev: "asc" | "desc") =>
          prev === "asc" ? "desc" : "asc"
        );
      } else {
        setRolesSortKey(key);
        setRolesSortDirection("asc");
      }
    },
    [rolesSortKey],
  );

  const getRoleSortValue = useCallback(
    (role: TeamRole, key: string): string => {
      switch (key) {
        case "role":
          return role.name.toLowerCase();
        case "tools": {
          const roleTools = role.tools || {};
          const toolCount = Object.values(roleTools).flat().length;
          return toolCount.toString().padStart(5, "0");
        }
        case "agents":
          return (role.agents || []).length.toString().padStart(5, "0");
        case "members":
          return (role.members || []).length.toString().padStart(5, "0");
        default:
          return "";
      }
    },
    [],
  );

  const handleEditRole = useCallback(
    (role: TeamRole | undefined, initialTab = "general") => {
      setEditingRole(role);
      setRoleDialogInitialTab(initialTab);
      setRoleDialogOpen(true);
    },
    [],
  );

  // Roles table columns
  const rolesColumns = useMemo(
    () =>
      [
        {
          id: "role",
          header: "Role",
          render: (role: TeamRole) => (
            <div
              className="flex flex-col cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleEditRole(role, "general")}
            >
              <span className="font-medium">{role.name}</span>
              <span className="text-xs text-muted-foreground">
                {role.description}
              </span>
            </div>
          ),
          sortable: true,
        },
        {
          id: "tools",
          header: "Tools",
          render: (role: TeamRole) => {
            const roleTools = role.tools || {};
            const integrationsWithTools = integrations.filter(
              (integration) =>
                roleTools[integration.id] &&
                roleTools[integration.id].length > 0,
            );

            if (integrationsWithTools.length === 0) {
              return (
                <span
                  className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleEditRole(role, "tools")}
                >
                  No tools
                </span>
              );
            }

            return (
              <div
                className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handleEditRole(role, "tools")}
              >
                <div className="flex -space-x-1">
                  {integrationsWithTools.slice(0, 3).map((integration) => (
                    <IntegrationAvatar
                      key={integration.id}
                      url={integration.icon}
                      fallback={integration.name}
                      size="sm"
                      className="border border-background"
                    />
                  ))}
                </div>
                {integrationsWithTools.length > 3 && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    +{integrationsWithTools.length - 3}
                  </span>
                )}
              </div>
            );
          },
        },
        {
          id: "agents",
          header: "Agents",
          render: (role: TeamRole) => {
            const roleAgents = role.agents || [];
            const roleAgentsList = agents.filter((agent) =>
              roleAgents.includes(agent.id)
            );

            if (roleAgentsList.length === 0) {
              return (
                <span
                  className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleEditRole(role, "agents")}
                >
                  No agents
                </span>
              );
            }

            return (
              <div
                className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handleEditRole(role, "agents")}
              >
                <div className="flex -space-x-1">
                  {roleAgentsList.slice(0, 3).map((agent) => (
                    <AgentAvatar
                      key={agent.id}
                      url={agent.avatar}
                      fallback={agent.name}
                      size="sm"
                      className="border border-background"
                    />
                  ))}
                </div>
                {roleAgentsList.length > 3 && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    +{roleAgentsList.length - 3}
                  </span>
                )}
              </div>
            );
          },
        },
        {
          id: "members",
          header: "Members",
          render: (role: TeamRole) => {
            const roleMembers = role.members || [];
            const roleMembersList = members.filter((member) =>
              roleMembers.includes(member.profiles.id)
            );

            if (roleMembersList.length === 0) {
              return (
                <span
                  className="text-muted-foreground text-sm cursor-pointer hover:text-foreground transition-colors"
                  onClick={() => handleEditRole(role, "members")}
                >
                  No members
                </span>
              );
            }

            return (
              <div
                className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => handleEditRole(role, "members")}
              >
                <div className="flex -space-x-1">
                  {roleMembersList.slice(0, 3).map((member) => (
                    <UserAvatar
                      key={member.profiles.id}
                      url={member.profiles.metadata.avatar_url}
                      fallback={member.profiles.metadata.full_name ||
                        member.profiles.email}
                      size="sm"
                      className="border border-background"
                    />
                  ))}
                </div>
                {roleMembersList.length > 3 && (
                  <span className="ml-2 text-xs font-medium text-muted-foreground">
                    +{roleMembersList.length - 3}
                  </span>
                )}
              </div>
            );
          },
        },
        {
          id: "actions",
          header: "",
          render: (role: TeamRole) => (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Icon name="more_horiz" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleEditRole(role)}>
                  <Icon name="edit" />
                  Edit role
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={role.team_id === null}
                  onClick={async () => {
                    if (role.team_id !== null && teamId) {
                      try {
                        await deleteRoleMutation.mutateAsync({
                          teamId,
                          roleId: role.id,
                        });
                        toast.success("Role deleted successfully");
                      } catch (error) {
                        toast.error("Failed to delete role");
                        console.error("Role delete error:", error);
                      }
                    }
                  }}
                >
                  <Icon name="delete" />
                  Delete role
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ),
        },
      ] satisfies TableColumn<TeamRole>[],
    [agents, integrations, handleEditRole, members, teamId, deleteRoleMutation],
  );

  // Filter roles based on search
  const filteredRoles: TeamRole[] = useMemo(
    () =>
      (roles as unknown as TeamRole[]).filter((role) =>
        role.name.toLowerCase().includes(rolesQuery.toLowerCase())
      ),
    [roles, rolesQuery],
  );

  // Sort the filtered roles
  const sortedRoles = useMemo(
    () =>
      [...filteredRoles].sort((a, b) => {
        const aValue = getRoleSortValue(a, rolesSortKey);
        const bValue = getRoleSortValue(b, rolesSortKey);

        if (rolesSortDirection === "asc") {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }),
    [filteredRoles, rolesSortKey, rolesSortDirection, getRoleSortValue],
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search roles..."
            value={rolesQuery}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setRolesQuery(e.target.value)}
            className="w-80"
          />
          <Button onClick={() => handleEditRole(undefined)}>
            <Icon name="add" />
            Add role
          </Button>
        </div>
        {roles.length === 0
          ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles available. Create roles to manage team member
              permissions.
            </div>
          )
          : filteredRoles.length === 0
          ? (
            <div className="text-center py-8 text-muted-foreground">
              No roles found matching your search.
            </div>
          )
          : (
            <Table
              columns={rolesColumns}
              data={sortedRoles}
              sortKey={rolesSortKey}
              sortDirection={rolesSortDirection}
              onSort={handleRolesSort}
            />
          )}
      </div>

      <AddRoleDialog
        open={roleDialogOpen}
        onOpenChange={(open) => {
          setRoleDialogOpen(open);
          if (!open) {
            setEditingRole(undefined);
            setRoleDialogInitialTab("general");
          }
        }}
        role={editingRole}
        teamId={teamId}
        initialTab={roleDialogInitialTab}
        onSave={async (roleData, isEditing) => {
          if (isEditing && editingRole) {
            await handleUpdateRole(editingRole.id, roleData);
          } else {
            await handleCreateRole(roleData);
          }
          setEditingRole(undefined);
        }}
      />
    </>
  );
}
