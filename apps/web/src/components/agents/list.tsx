import type { Agent } from "@deco/sdk";
import {
  DEFAULT_REASONING_MODEL,
  useAgents,
  useCreateAgent,
  useIntegration,
  useRemoveAgent,
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
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense, useReducer, useState } from "react";
import { useNavigate } from "react-router";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { Avatar } from "../common/Avatar.tsx";
import { EmptyState } from "../common/EmptyState.tsx";
import { PageLayout } from "../pageLayout.tsx";
import { useFocusAgent } from "./hooks.ts";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCreateAdminDecoAgent } from "../../hooks/useDecoSiteAgent.ts";

export const useDuplicateAgent = (agent: Agent | null) => {
  const [duplicating, setDuplicating] = useState(false);
  const focusAgent = useFocusAgent();
  const createAgent = useCreateAgent();

  // Function to handle duplicating the agent
  const duplicate = async () => {
    if (!agent) return;

    try {
      setDuplicating(true);
      const duplicatedAgent = await createAgent.mutateAsync({
        name: `${agent.name} (Copy)`,
        id: crypto.randomUUID(),
        description: agent.description,
        instructions: agent.instructions,
        avatar: agent.avatar,
        tools_set: agent.tools_set,
        model: agent.model,
        views: agent.views,
      });
      focusAgent(duplicatedAgent.id);

      trackEvent("agent_duplicate", {
        success: true,
        data: duplicatedAgent,
      });
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

// Add this component before AgentCard
function IntegrationMiniature({ toolSetId }: { toolSetId: string }) {
  const { data: integration } = useIntegration(toolSetId);
  const navigate = useNavigate();

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
            navigate(`/integration/${integration.id}`);
          }}
          asChild
        >
          <div className="w-8 h-8 flex items-center justify-center border border-input rounded-lg p-1">
            {icon.startsWith("icon://")
              ? (
                <Icon
                  name={icon.replace("icon://", "")}
                  className="text-base rounded-none"
                />
              )
              : (
                <Avatar
                  url={icon}
                  fallback={integration.name.substring(0, 2)}
                  className="h-full w-full rounded-none"
                />
              )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{integration.name}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Agent Card Component
function AgentCard({ agent }: { agent: Agent }) {
  const removeAgent = useRemoveAgent();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const focusAgent = useFocusAgent();
  const { duplicate, duplicating } = useDuplicateAgent(agent);

  // Return loading state while fetching agent data
  if (!agent) {
    return (
      <Card className="shadow-sm hover:shadow-md transition-shadow rounded-2xl">
        <CardContent className="p-4 flex items-center justify-center h-[166px]">
          <Spinner />
        </CardContent>
      </Card>
    );
  }

  // Get display text - prefer description over system prompt
  const displayText = agent.description ||
    (agent.instructions
      ? agent.instructions.substring(0, 100) +
        (agent.instructions.length > 100 ? "..." : "")
      : "");

  // Function to handle actual deletion
  const handleDelete = async () => {
    try {
      await removeAgent.mutateAsync(agent.id);
      setDeleteDialogOpen(false);

      trackEvent("agent_delete", {
        success: true,
        data: agent,
      });
    } catch (error) {
      console.error("Error deleting Agent:", error);

      trackEvent("agent_delete", {
        success: false,
        error,
      });
    }
  };

  return (
    <>
      <Card
        className="shadow-sm group cursor-pointer hover:shadow-md transition-shadow flex flex-col rounded-2xl"
        onClick={() => {
          focusAgent(agent.id);
        }}
      >
        <CardContent className="p-4 gap-4 flex flex-col justify-start flex-grow">
          <div className="grid grid-cols-[min-content_auto_min-content] gap-4">
            <div className="h-16 w-16 flex items-center justify-center overflow-hidden">
              <Avatar
                url={agent.avatar && /^(data:)|(https?:)/.test(agent.avatar)
                  ? agent.avatar
                  : undefined}
                fallback={agent.avatar &&
                    !/^(data:)|(https?:)/.test(agent.avatar)
                  ? agent.avatar
                  : agent.name.substring(0, 2)}
                className="h-full w-full rounded-xl"
              />
            </div>

            <div className="grid grid-cols-1 gap-1">
              <div className="text-base font-semibold truncate">
                {agent.name}
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {displayText}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  className="xl:invisible xl:w-0 xl:group-hover:visible xl:group-hover:w-10"
                >
                  <Icon name="more_horiz" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  disabled={duplicating}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    duplicate();
                  }}
                >
                  <Icon name="content_copy" className="mr-2" />
                  {duplicating ? "Duplicating..." : "Duplicate"}
                </DropdownMenuItem>
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
          </div>

          {/* Integrations list slot */}
          <div className="flex gap-2 flex-wrap h-8 justify-end">
            {Object
              .entries(agent.tools_set ?? {})
              .filter(([_, tools]) => tools.length > 0)
              .map(([toolSetId]) => (
                <ErrorBoundary key={toolSetId} fallback={null}>
                  <Suspense fallback={null}>
                    <IntegrationMiniature toolSetId={toolSetId} />
                  </Suspense>
                </ErrorBoundary>
              ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => setDeleteDialogOpen(open)}
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDelete();
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

// Define simplified state interface
interface ListState {
  filter: string;
}

// Define action types
type ListAction = { type: "SET_FILTER"; payload: string };

// Initial state
const initialState: ListState = {
  filter: "",
};

// Reducer function
function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_FILTER":
      return { ...state, filter: action.payload };
    default:
      return state;
  }
}

export default function List() {
  const [state, dispatch] = useReducer(listReducer, initialState);
  const { filter } = state;
  const focusAgent = useFocusAgent();
  const [creating, setCreating] = useState(false);
  const createAgent = useCreateAgent();
  const { data: agents } = useAgents();
  useCreateAdminDecoAgent({ agents });

  // Filter agents based on the filter string
  const filteredAgents = agents?.filter((agent) =>
    agent.name.toLowerCase().includes(filter.toLowerCase())
  );

  // Function to handle creating a new Agent
  const handleCreate = async () => {
    try {
      setCreating(true);
      const agent = await createAgent.mutateAsync({
        name: "New Agent",
        id: crypto.randomUUID(),
        avatar: "",
        instructions: "This agent has not been configured yet.",
        tools_set: {},
        model: DEFAULT_REASONING_MODEL,
        views: [{ url: "", name: "Chat" }],
      });
      focusAgent(agent.id);

      trackEvent("agent_create", {
        success: true,
        data: agent,
      });
    } catch (error) {
      console.error("Error creating new agent:", error);

      trackEvent("agent_create", {
        success: false,
        error,
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <PageLayout
      header={
        <>
          <div className="justify-self-start">
            <Input
              placeholder="Filter agents..."
              value={filter}
              onChange={(e) =>
                dispatch({ type: "SET_FILTER", payload: e.target.value })}
              className="w-full md:w-64"
            />
          </div>
          <div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="gap-2"
            >
              {creating
                ? (
                  <>
                    <Spinner size="xs" />
                    Creating...
                  </>
                )
                : (
                  <>
                    <Icon name="add" />
                    Create Agent
                  </>
                )}
            </Button>
          </div>
        </>
      }
      main={
        <>
          {!agents
            ? (
              <div className="flex h-48 items-center justify-center">
                <Spinner size="lg" />
              </div>
            )
            : agents.length > 0
            ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-6 peer">
                  {filteredAgents?.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
                <div className="flex-col items-center justify-center h-48 peer-empty:flex hidden">
                  <Icon
                    name="search_off"
                    className="mb-2 text-4xl text-muted-foreground"
                  />
                  <p className="text-muted-foreground">
                    No agents match your filter. Try adjusting your search.
                  </p>
                </div>
              </>
            )
            : (
              <EmptyState
                icon="groups"
                title="No agents yet"
                description="Create an agent to automate tasks and improve your workflow."
                buttonProps={{
                  disabled: creating,
                  children: creating ? "Creating..." : "Create Agent",
                  onClick: handleCreate,
                }}
              />
            )}
        </>
      }
    />
  );
}
