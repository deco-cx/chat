import type { Agent } from "@deco/sdk";
import {
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
import { Card as UICard, CardContent } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
  useEffect,
} from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { getPublicChatLink } from "../agent/chats.tsx";
import { AgentVisibility } from "../common/agent-visibility.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table } from "../common/table/index.tsx";
import { DateTimeCell, UserInfo } from "../common/table/table-cells.tsx";
import type { Tab } from "../dock/index.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import { useFocusChat } from "./hooks.ts";
import { useViewMode } from "@deco/ui/hooks/use-view-mode.ts";

// Agent model enriched with last-used fields from API
interface AgentWithActivity extends Agent {
  lastAccess?: string | null;
  lastAccessor?: string | null;
}

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
      className="group cursor-pointer hover:shadow-md transition-shadow flex flex-col rounded-xl p-4 h-full"
      onClick={() => {
        focusAgent(agent.id, crypto.randomUUID(), {
          history: false,
        });
      }}
    >
      <CardContent className="gap-4 flex flex-col flex-grow">
        <div className="flex flex-col gap-3 w-full">
          <div className="relative w-full">
            <AgentAvatar url={agent.avatar} fallback={agent.name} size="lg" />
            <div
              className="absolute top-0 right-0"
              onClick={(e) => e.stopPropagation()}
            >
              <Actions agent={agent} />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {agent.name}
              <AgentVisibility.Icon agent={agent} size={16} />
            </div>
            <div className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
              {agent.description || "No description"}
            </div>
          </div>
        </div>
      </CardContent>
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
      accessor: (agent: AgentWithActivity) => (
        <span
          className="text-muted-foreground text-sm leading-tight line-clamp-2 break-words"
          title={agent.description || ""}
        >
          {agent.description}
        </span>
      ),
      sortable: true,
      cellClassName:
        "max-w-[380px] sm:max-w-[320px] md:max-w-[280px] lg:max-w-[380px]",
      wrap: true,
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-3 peer">
      {agents.map((agent) => (
        <div key={agent.id} className="relative group">
          <Card agent={agent} />
        </div>
      ))}
    </div>
  );
}

const VISIBILITIES = ["all", "public", "workspace"] as const;
const VISIBILITY_LABELS = {
  all: "All",
  public: (
    <>
      <Icon name="public" /> Public
    </>
  ),
  workspace: (
    <>
      <Icon name="groups" /> Team
    </>
  ),
} as const;

type Visibility = (typeof VISIBILITIES)[number];
type TabId = "active" | Visibility;

function List() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const { handleCreate } = useContext(Context)!;
  const { filter } = state;
  const { data: agents } = useAgents();
  const [viewMode, setViewMode] = useViewMode("agents");
  const { value: selectedTab, update: setSelectedTab } = useLocalStorage<TabId>(
    {
      key: "agents-visibility",
      defaultValue: "active",
    },
  );

  // Migration: Previously saved value may be "all"; make "active" the new default on first load
  useEffect(() => {
    if (selectedTab === "all") {
      setSelectedTab("active");
    }
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agentsByVisibility = useMemo(() => {
    const initial: Record<"all" | "public" | "workspace", AgentWithActivity[]> = {
      all: [],
      public: [],
      workspace: [],
    };

    return (
      (agents as AgentWithActivity[] | undefined)?.reduce((acc, agent) => {
        acc["all"].push(agent);
        acc[agent.visibility.toLowerCase() as "public" | "workspace"].push(
          agent,
        );
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

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <ListPageHeader
        filter={{
          items: (["active", ...VISIBILITIES] as TabId[]).map((id) => ({
            id,
            active: selectedTab === id,
            label:
              id === "active" ? "Active" : VISIBILITY_LABELS[id as Visibility],
            count:
              id === "active"
                ? activeAgents.length
                : agentsByVisibility[id as Visibility].length,
          })),
          onClick: (item) => setSelectedTab(item.id as TabId),
        }}
        input={{
          placeholder: "Search agent",
          value: filter,
          onChange: (e) =>
            dispatch({ type: "SET_FILTER", payload: e.target.value }),
        }}
        view={{ viewMode, onChange: setViewMode }}
      />

      {filteredAgents.length > 0 ? (
        <div
          className={
            selectedTab === "active"
              ? "min-h-0 overflow-x-auto"
              : "flex-1 min-h-0 overflow-x-auto"
          }
        >
          {viewMode === "table" ? (
            <TableView agents={filteredAgents} />
          ) : (
            <CardsView agents={filteredAgents} />
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
        </div>
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

      {/* footer note moved inside list container when Active */}
    </div>
  );
}

const TABS: Record<string, Tab> = {
  list: {
    Component: List,
    title: "Agents",
    initialOpen: true,
  },
};

const Context = createContext<{ handleCreate: () => void } | null>(null);

export default function Page() {
  const focusChat = useFocusChat();

  const handleCreate = () => {
    focusChat(WELL_KNOWN_AGENT_IDS.teamAgent, crypto.randomUUID(), {
      history: false,
    });
  };

  return (
    <Context.Provider value={{ handleCreate }}>
      <PageLayout
        tabs={TABS}
        hideViewsButton
        breadcrumb={
          <DefaultBreadcrumb items={[{ label: "Agents", link: "/agents" }]} />
        }
        actionButtons={
          <Button
            onClick={handleCreate}
            variant="special"
            size="sm"
            className="gap-2"
          >
            <Icon name="add" />
            <span className="hidden md:inline">New agent</span>
          </Button>
        }
      />
    </Context.Provider>
  );
}
