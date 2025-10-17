import type { Agent } from "@deco/sdk";
import {
  AgentWithActivity,
  useAgents,
  useRemoveAgent,
  useSDK,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card as UICard } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";
import type { KeyboardEvent } from "react";
import { useCallback, useMemo, useReducer, useState } from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { getPublicChatLink } from "../agent/chats.tsx";
import { AgentVisibility } from "../common/agent-visibility.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { Table } from "../common/table/index.tsx";
import { DateTimeCell, UserInfo } from "../common/table/table-cells.tsx";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import { ResourceHeader } from "../resources-v2/resource-header.tsx";
import { useFocusChat } from "./hooks.ts";

export const useDuplicateAgent = (agent: Agent | null) => {
  const [duplicating, setDuplicating] = useState(false);
  const createAgent = useCreateAgent();

  const duplicate = async () => {
    if (!agent) return;

    try {
      setDuplicating(true);
      const newAgent = {
        name: `${agent.name} (Copy)`,
        id: crypto.randomUUID(),
        description: agent.description,
        instructions: agent.instructions,
        avatar: agent.avatar,
        tools_set: agent.tools_set,
        model: agent.model,
        views: agent.views,
      };
      await createAgent(newAgent, { eventName: "agent_duplicate" });
    } catch (error) {
      console.error("Error duplicating agent:", error);

      trackEvent("agent_duplicate", {
        success: false,
        error,
      });
    } finally {
      setDuplicating(false);
    }
  };

  return { duplicate, duplicating };
};

const useCopyLink = (agentId: string) => {
  const { locator } = useSDK();

  const copyLink = useCallback(() => {
    const link = getPublicChatLink(agentId, locator);
    navigator.clipboard.writeText(link);
  }, [agentId, locator]);

  return copyLink;
};

function Actions({ agent }: { agent: Agent }) {
  const { duplicate, duplicating } = useDuplicateAgent(agent);
  const removeAgent = useRemoveAgent();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const copyLink = useCopyLink(agent.id);

  async function handleDelete() {
    await removeAgent.mutateAsync(agent.id);
    setDeleteDialogOpen(false);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => e.stopPropagation()}
          >
            <Icon name="more_horiz" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            disabled={duplicating}
            onClick={(e) => {
              e.stopPropagation();
              duplicate();
            }}
          >
            <Icon name="content_copy" className="mr-2" />
            {duplicating ? "Duplicating..." : "Duplicate"}
          </DropdownMenuItem>
          {agent.visibility === "PUBLIC" && (
            <DropdownMenuItem
              disabled={duplicating}
              onClick={(e) => {
                e.stopPropagation();

                copyLink();
              }}
            >
              <Icon name="link" className="mr-2" />
              Copy link
            </DropdownMenuItem>
          )}
          <DropdownMenuItem
            className="text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDialogOpen(true);
            }}
          >
            <Icon name="delete" className="mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {agent.name} agent. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await handleDelete();
              }}
              disabled={removeAgent.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeAgent.isPending ? (
                <>
                  <Spinner size="xs" />
                  <span className="ml-2">Deleting...</span>
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Card({ agent }: { agent: Agent }) {
  const focusAgent = useFocusChat();

  return (
    <UICard
      className="group cursor-pointer hover:shadow-sm transition-shadow overflow-hidden bg-card border-0 min-h-48"
      onClick={() => {
        focusAgent(agent.id, crypto.randomUUID(), {
          history: false,
        });
      }}
    >
      <div className="flex flex-col h-full">
        {/* Content Section */}
        <div className="p-5 flex flex-col gap-3 flex-1 relative">
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div onClick={(e) => e.stopPropagation()}>
              <Actions agent={agent} />
            </div>
          </div>
          <AgentAvatar url={agent.avatar} fallback={agent.name} size="lg" />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-medium text-foreground truncate">
                {agent.name}
              </h3>
              <AgentVisibility.Icon agent={agent} size={16} />
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 leading-normal">
              {agent.description || "No description"}
            </p>
          </div>
        </div>
      </div>
    </UICard>
  );
}

interface ListState {
  filter: string;
}

type ListAction = { type: "SET_FILTER"; payload: string };

const initialState: ListState = {
  filter: "",
};

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    default:
      return state;
  }
}

function TableView({ agents }: { agents: AgentWithActivity[] }) {
  const focusChat = useFocusChat();
  const [sortKey, setSortKey] = useState<"name" | "description" | "lastAccess">(
    "name",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(
    agent: AgentWithActivity,
    key: "name" | "description",
  ): string {
    if (key === "description") return agent.description?.toLowerCase() || "";
    return agent.name?.toLowerCase() || "";
  }

  const sortedAgents = [...agents].sort((a, b) => {
    const aVal =
      sortKey === "lastAccess" ? a.lastAccess || "" : getSortValue(a, sortKey);
    const bVal =
      sortKey === "lastAccess" ? b.lastAccess || "" : getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns = [
    {
      id: "name",
      header: "Name",
      render: (agent: AgentWithActivity) => (
        <div className="flex items-center gap-2 min-w-0">
          <AgentAvatar
            url={agent.avatar}
            fallback={agent.name.substring(0, 2)}
            size="sm"
          />
          <span
            className="font-medium text-xs sm:text-sm leading-tight line-clamp-2 break-words"
            title={agent.name}
          >
            {agent.name}
          </span>
        </div>
      ),
      sortable: true,
      cellClassName:
        "max-w-[380px] sm:max-w-[320px] md:max-w-[280px] lg:max-w-[380px]",
      wrap: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (agent: AgentWithActivity) => agent.description || "",
      cellClassName: "max-w-xl",
      sortable: true,
    },
    {
      id: "lastAccess",
      header: "Last used",
      render: (agent: AgentWithActivity) => (
        <DateTimeCell value={agent.lastAccess ?? undefined} />
      ),
      sortable: true,
    },
    {
      id: "lastAccessor",
      header: "Last used by",
      render: (agent: AgentWithActivity) => (
        <UserInfo userId={agent.lastAccessor ?? undefined} noTooltip />
      ),
    },
    {
      id: "actions",
      header: "",
      render: (agent: AgentWithActivity) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Actions agent={agent} />
        </div>
      ),
    },
  ];

  return (
    <Table
      columns={columns}
      data={sortedAgents}
      sortKey={sortKey}
      sortDirection={sortDirection}
      onSort={(key) => {
        if (sortKey === key) {
          setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
        } else {
          setSortKey(key as "name" | "description" | "lastAccess");
          setSortDirection("asc");
        }
      }}
      onRowClick={(agent) => {
        focusChat(agent.id, crypto.randomUUID(), {
          history: false,
        });
      }}
    />
  );
}

function CardsView({ agents }: { agents: AgentWithActivity[] }) {
  return (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
      }}
    >
      {agents.map((agent) => (
        <div key={agent.id} className="relative group">
          <Card agent={agent} />
        </div>
      ))}
    </div>
  );
}

const VISIBILITIES = ["all", "public", "workspace"] as const;

type Visibility = (typeof VISIBILITIES)[number];
type TabId = "active" | Visibility;

export const useFocusTeamAgent = () => {
  const focusChat = useFocusChat();
  const handleCreate = () => {
    focusChat(WELL_KNOWN_AGENT_IDS.teamAgent, crypto.randomUUID(), {
      history: false,
    });
  };

  return handleCreate;
};

function AgentsList() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const handleCreate = useFocusTeamAgent();
  const navigateWorkspace = useNavigateWorkspace();
  const { filter } = state;
  const { data: agents } = useAgents();
  const [viewMode, setViewMode] = useViewMode("agents");
  const [searchOpen, setSearchOpen] = useState(false);
  const { value: selectedTab, update: setSelectedTab } = useLocalStorage<TabId>(
    {
      key: "agents-visibility",
      defaultValue: "active",
      migrate: (value) => {
        if (value === "all") {
          return "active";
        }
        return value;
      },
    },
  );

  const agentsByVisibility = useMemo(() => {
    const initial: Record<
      "all" | "public" | "workspace" | "private",
      AgentWithActivity[]
    > = {
      all: [],
      public: [],
      workspace: [],
      private: [],
    };

    return (
      (agents as AgentWithActivity[] | undefined)?.reduce((acc, agent) => {
        acc["all"].push(agent);
        if (agent.visibility === "PUBLIC") {
          acc.public.push(agent);
        } else if (agent.visibility === "WORKSPACE") {
          acc.workspace.push(agent);
        } else if (agent.visibility === "PRIVATE") {
          acc.private.push(agent);
        }
        return acc;
      }, initial) ?? initial
    );
  }, [agents]);

  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const activeAgents = useMemo(() => {
    return (agentsByVisibility["all"] ?? []).filter((agent) => {
      const last = agent.lastAccess;
      if (!last) return false;
      const when = new Date(last);
      return !Number.isNaN(when.getTime()) && when >= sevenDaysAgo;
    });
  }, [agentsByVisibility, sevenDaysAgo]);

  const listForTab = useMemo(() => {
    if (selectedTab === "active") return activeAgents;
    return agentsByVisibility[selectedTab] ?? [];
  }, [selectedTab, activeAgents, agentsByVisibility]);

  const filteredAgents = listForTab.filter((agent) =>
    agent.name.toLowerCase().includes(filter.toLowerCase()),
  );

  // Prepare decopilot context value for agents list
  const decopilotContextValue = useMemo(() => {
    const rules: string[] = [
      `You are helping with agent management and organization. Focus on operations related to agent creation, configuration, management, and organization.`,
      `When working with agents, prioritize operations that help users create new agents, manage existing agents, understand agent capabilities, and organize their agent collection effectively. Consider the current agent list and available agent types when providing assistance.`,
    ];

    return {
      rules,
    };
  }, []);

  const mainTabs = useMemo(() => {
    return [
      {
        id: "agents",
        label: "Agents",
        onClick: () => navigateWorkspace("/agents"),
      },
      {
        id: "threads",
        label: "Threads",
        onClick: () => navigateWorkspace("/agents/threads"),
      },
    ];
  }, [navigateWorkspace]);

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <div className="h-full p-0 overflow-y-auto">
        <div className="max-w-[1600px] px-4 lg:px-6 xl:px-10 w-full mx-auto pt-12 space-y-4 md:space-y-6 lg:space-y-8">
          <div className="max-w-[1500px] mx-auto w-full space-y-4 md:space-y-6 lg:space-y-8">
            <ResourceHeader
              title="Agents"
              tabs={mainTabs}
              activeTab="agents"
              searchOpen={searchOpen}
              searchValue={filter}
              onSearchToggle={() => setSearchOpen(!searchOpen)}
              onSearchChange={(value: string) =>
                dispatch({ type: "SET_FILTER", payload: value })
              }
              onSearchBlur={() => {
                if (!filter) {
                  setSearchOpen(false);
                }
              }}
              onSearchKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                if (e.key === "Escape") {
                  dispatch({ type: "SET_FILTER", payload: "" });
                  setSearchOpen(false);
                  (e.target as HTMLInputElement).blur();
                }
              }}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              ctaButton={
                <Button
                  variant="special"
                  className="h-9 rounded-xl w-full md:w-auto"
                  onClick={handleCreate}
                >
                  <Icon name="add" size={16} />
                  New agent
                </Button>
              }
            />

            {/* Filter buttons */}
            <div className="flex items-center gap-1">
              {(["active", ...VISIBILITIES] as TabId[]).map((id) => (
                <Button
                  key={id}
                  onClick={() => setSelectedTab(id as TabId)}
                  variant={selectedTab === id ? "secondary" : "ghost"}
                  size="sm"
                  className={`h-8 ${selectedTab === id ? "" : "text-muted-foreground"}`}
                >
                  <span className="flex items-center gap-1.5">
                    {id === "active" ? (
                      "Active"
                    ) : id === "all" ? (
                      "All"
                    ) : id === "public" ? (
                      <>
                        <Icon name="public" className="w-4 h-4" /> Public
                      </>
                    ) : (
                      <>
                        <Icon name="groups" className="w-4 h-4" /> Team
                      </>
                    )}
                  </span>
                </Button>
              ))}
            </div>

            {filteredAgents.length > 0 ? (
              <>
                {viewMode === "cards" && <CardsView agents={filteredAgents} />}
                {viewMode === "table" && (
                  <div className="overflow-x-auto -mx-16 px-16">
                    <div className="w-fit min-w-full max-w-[1500px] mx-auto">
                      <TableView agents={filteredAgents} />
                    </div>
                  </div>
                )}

                {selectedTab === "active" && (
                  <div className="w-full text-center text-xs text-muted-foreground py-3">
                    showing only agents used in the last 7 days. click
                    <Button
                      variant="link"
                      className="px-1"
                      onClick={() => setSelectedTab("all")}
                    >
                      All
                    </Button>
                    to see more
                  </div>
                )}
              </>
            ) : (
              <>
                {selectedTab === "active" ? (
                  <EmptyState
                    icon="history"
                    title="No agents used in the last 7 days"
                    description="Click All to see more."
                    buttonProps={{
                      children: "All",
                      onClick: () => setSelectedTab("all"),
                      variant: "outline",
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={
                      (agents?.length ?? 0) === 0
                        ? "robot_2"
                        : selectedTab === "public" &&
                            agentsByVisibility["public"].length === 0
                          ? "public"
                          : selectedTab === "workspace" &&
                              agentsByVisibility["workspace"].length === 0
                            ? "groups"
                            : "search_off"
                    }
                    title={
                      (agents?.length ?? 0) === 0
                        ? "No agents yet"
                        : selectedTab === "public" &&
                            agentsByVisibility["public"].length === 0
                          ? "No public agents available"
                          : selectedTab === "workspace" &&
                              agentsByVisibility["workspace"].length === 0
                            ? "No team agents yet"
                            : "No agents match your filter"
                    }
                    description={
                      (agents?.length ?? 0) === 0
                        ? "You haven't created any agents yet. Create one to get started."
                        : selectedTab === "public" &&
                            agentsByVisibility["public"].length === 0
                          ? "Once agents are shared publicly, they'll appear here for anyone to explore and try out."
                          : selectedTab === "workspace" &&
                              agentsByVisibility["workspace"].length === 0
                            ? "Agents shared with your team will show up here. Create one to start collaborating."
                            : "Try adjusting your search. If you still can't find what you're looking for, you can create a new agent."
                    }
                    buttonProps={{
                      children: "New agent",
                      onClick: handleCreate,
                    }}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DecopilotLayout>
  );
}

export default AgentsList;
