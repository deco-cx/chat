import type { Agent } from "@deco/sdk";
import {
  useAgents,
  useIntegration,
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import {
  createContext,
  Suspense,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useState,
} from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import { useLocalStorage } from "../../hooks/use-local-storage.ts";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";
import { getPublicChatLink } from "../agent/chats.tsx";
import { AgentVisibility } from "../common/agent-visibility.tsx";
import { AgentAvatar, Avatar } from "../common/avatar/index.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { ListPageHeader } from "../common/list-page-header.tsx";
import { Table } from "../common/table/index.tsx";
import { Tab } from "../dock/index.tsx";
import { IntegrationIcon } from "../integrations/list/common.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
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

function IntegrationMiniature({ toolSetId }: { toolSetId: string }) {
  const { data: integration } = useIntegration(toolSetId);
  const navigateWorkspace = useNavigateWorkspace();

  if (!integration) {
    return null;
  }

  const icon = integration.icon || "icon://conversion_path";

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip>
        <TooltipTrigger
          onClick={(e) => {
            e.stopPropagation();
            navigateWorkspace(`/integration/${integration.id}`);
          }}
          asChild
        >
          <div className="w-8 h-8 flex items-center justify-center border border-input rounded-lg overflow-hidden">
            <IntegrationIcon
              icon={icon}
              name={integration.name}
              variant="small"
              className="h-full w-full"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{integration.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function IntegrationBadges({ agent, max }: { agent: Agent; max?: number }) {
  const integrations = Object
    .entries(agent.tools_set ?? {})
    .filter(([_, tools]) => tools.length > 0)
    .slice(0, max ?? Infinity);

  return (
    <div className="flex gap-2 flex-wrap">
      {integrations.map(([toolSetId]) => (
        <ErrorBoundary key={toolSetId} fallback={null}>
          <Suspense fallback={null}>
            <IntegrationMiniature toolSetId={toolSetId} />
          </Suspense>
        </ErrorBoundary>
      ))}
    </div>
  );
}

const useCopyLink = (agentId: string) => {
  const { workspace } = useSDK();

  const copyLink = useCallback(() => {
    const link = getPublicChatLink(agentId, workspace);
    navigator.clipboard.writeText(link);
  }, [agentId, workspace]);

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
          {agent.access?.includes("public") && (
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
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {agent.name}{" "}
              agent. This action cannot be undone.
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
              className="bg-destructive hover:bg-destructive/90"
            >
              {removeAgent.isPending
                ? (
                  <>
                    <Spinner size="xs" />
                    <span className="ml-2">Deleting...</span>
                  </>
                )
                : (
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
            <div className="h-12 w-12 flex justify-center overflow-hidden rounded-lg shadow-sm">
              <AgentAvatar
                name={agent.name}
                avatar={agent.avatar}
                className="h-full w-full rounded-lg"
              />
            </div>
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
          <IntegrationBadges agent={agent} />
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

function TableView({ agents }: {
  agents: Agent[];
}) {
  const focusChat = useFocusChat();
  const [sortKey, setSortKey] = useState<"name" | "description">("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  function getSortValue(
    agent: Agent,
    key: "name" | "description",
  ): string {
    if (key === "description") {
      return agent.description?.toLowerCase() || "";
    }
    return agent.name?.toLowerCase() || "";
  }
  const sortedAgents = [...agents].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const columns = [
    {
      id: "name",
      header: "Name",
      render: (agent: Agent) => (
        <div className="flex items-center gap-2">
          <Avatar
            url={agent.avatar}
            fallback={agent.name.substring(0, 2)}
            className="h-8 w-8 rounded-lg"
          />
          <span className="font-medium">{agent.name}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      accessor: (agent: Agent) => agent.description,
      sortable: true,
      cellClassName: "max-w-xl",
    },
    {
      id: "integrations",
      header: "Integrations",
      render: (agent: Agent) => <IntegrationBadges agent={agent} max={5} />,
    },
    {
      id: "actions",
      header: "",
      render: (agent: Agent) => (
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
          setSortKey(key as "name" | "description");
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

function CardsView({ agents }: {
  agents: Agent[];
}) {
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

const VISIBILITIES = ["all", "public", "workspace", "private"] as const;
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
  private: (
    <>
      <Icon name="lock" /> Private
    </>
  ),
} as const;

type Visibility = typeof VISIBILITIES[number];

function List() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const { handleCreate } = useContext(Context)!;
  const { filter } = state;
  const { data: agents } = useAgents();
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const { value: visibility, update: setVisibility } = useLocalStorage<
    Visibility
  >({ key: "agents-visibility", defaultValue: "all" });

  const agentsByVisibility = useMemo(() => {
    const initial = Object.fromEntries(
      VISIBILITIES.map((v) => [v, []] as [string, Agent[]]),
    );

    return agents?.reduce((acc, item) => {
      acc["all"].push(item);
      acc[
        item.access?.includes("public")
          ? "public"
          : item.access?.includes("private")
          ? "private"
          : "workspace"
      ]?.push(item);

      return acc;
    }, initial);
  }, [agents]);

  const filteredAgents =
    agentsByVisibility[visibility]?.filter((item) =>
      item.name.toLowerCase().includes(filter.toLowerCase())
    ) ?? [];

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <ListPageHeader
        filter={{
          items: VISIBILITIES.map((v) => ({
            id: v,
            active: visibility === v,
            label: VISIBILITY_LABELS[v],
            count: agentsByVisibility[v].length,
          })),
          onClick: (item) => setVisibility(item.id as Visibility),
        }}
        input={{
          placeholder: "Search agent",
          value: filter,
          onChange: (e) =>
            dispatch({ type: "SET_FILTER", payload: e.target.value }),
        }}
        view={{ viewMode, onChange: setViewMode }}
      />

      {filteredAgents.length > 0
        ? (
          <div className="flex-1 min-h-0 overflow-x-auto">
            {viewMode === "table"
              ? <TableView agents={filteredAgents} />
              : <CardsView agents={filteredAgents} />}
          </div>
        )
        : (
          <EmptyState
            icon={agents.length === 0 ? "robot_2" : visibility === "public" &&
                agentsByVisibility["public"].length === 0
              ? "public"
              : visibility === "workspace" &&
                  agentsByVisibility["workspace"].length === 0
              ? "groups"
              : "search_off"}
            title={agents.length === 0
              ? "No agents yet"
              : visibility === "public" &&
                  agentsByVisibility["public"].length === 0
              ? "No public agents available"
              : visibility === "workspace" &&
                  agentsByVisibility["workspace"].length === 0
              ? "No team agents yet"
              : "No agents match your filter"}
            description={agents.length === 0
              ? "You haven't created any agents yet. Create one to get started."
              : visibility === "public" &&
                  agentsByVisibility["public"].length === 0
              ? "Once agents are shared publicly, they'll appear here for anyone to explore and try out."
              : visibility === "workspace" &&
                  agentsByVisibility["workspace"].length === 0
              ? "Agents shared with your team will show up here. Create one to start collaborating."
              : "Try adjusting your search. If you still can't find what you're looking for, you can create a new agent."}
            buttonProps={{
              children: "New Agent",
              onClick: handleCreate,
            }}
          />
        )}
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

const Context = createContext<
  { handleCreate: () => void } | null
>(null);

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
        displayViewsTrigger={false}
        tabs={TABS}
        breadcrumb={
          <DefaultBreadcrumb items={[{ label: "Agents", link: "/agents" }]} />
        }
        actionButtons={
          <Button
            onClick={handleCreate}
            variant="special"
            className="gap-2"
          >
            <Icon name="add" />
            <span className="hidden md:inline">New Agent</span>
          </Button>
        }
      />
    </Context.Provider>
  );
}
