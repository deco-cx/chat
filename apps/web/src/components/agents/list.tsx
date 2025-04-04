import type { Agent } from "@deco/sdk";
import { createAgent } from "@deco/sdk/crud";
import {
  useAgent,
  useAgents,
  useIntegration,
  useRuntime,
} from "@deco/sdk/hooks";
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
import { useReducer, useState } from "react";
import { useNavigate } from "react-router";
import { useFocusAgent, useSidebarPinOperations } from "./hooks.ts";
import { Avatar } from "../common/Avatar.tsx";
import { EmptyState } from "../common/EmptyState.tsx";

export const useDuplicateAgent = (agent: Agent | null) => {
  const [duplicating, setDuplicating] = useState(false);
  const focusAgent = useFocusAgent();

  // Function to handle duplicating the agent
  const duplicate = async () => {
    if (!agent) return;

    try {
      setDuplicating(true);
      const duplicatedAgent = await createAgent({
        name: `${agent.name} (Copy)`,
        description: agent.description,
        instructions: agent.instructions,
        avatar: agent.avatar,
      });
      focusAgent(duplicatedAgent.id, duplicatedAgent);
    } catch (error) {
      console.error("Error duplicating agent:", error);
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
function AgentCard({ agentId, filter }: { agentId: string; filter: string }) {
  const { data: agent, loading, remove } = useAgent(agentId);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const focusAgent = useFocusAgent();
  const { togglePin, unpinAgent, isPinned } = useSidebarPinOperations();
  const { duplicate, duplicating } = useDuplicateAgent(agent);
  const { state } = useRuntime();
  const { context } = state;

  // Return loading state while fetching agent data
  if (loading || !agent) {
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
      setDeleting(true);

      // Unpin the agent from the sidebar if it was pinned
      if (isPinned(agentId)) {
        unpinAgent(agentId);
      }

      await remove();
      setDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error deleting Agent:", error);
    } finally {
      setDeleting(false);
    }
  };

  if (!agent.name.toLowerCase().includes(filter.toLowerCase())) {
    return null;
  }

  const agentPinned = isPinned(agentId);

  // Handle pin/unpin agent to sidebar
  const handlePinToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePin(agent);
  };

  return (
    <>
      <Card
        className="shadow-sm group cursor-pointer hover:shadow-md transition-shadow flex flex-col rounded-2xl"
        onClick={() => {
          focusAgent(agentId, agent);
        }}
      >
        <CardContent className="p-4 gap-4 flex flex-col justify-start flex-grow">
          <div className="flex justify-between">
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => e.stopPropagation()}
                  className="opacity-0 group-hover:opacity-100"
                >
                  <Icon name="more_horiz" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  disabled={!context?.root}
                  onClick={handlePinToggle}
                >
                  <Icon
                    name={agentPinned ? "keep_off" : "keep"}
                    className="mr-2"
                  />
                  {agentPinned ? "Unpin from sidebar" : "Pin to sidebar"}
                </DropdownMenuItem>
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
          <div className="flex flex-col gap-1 flex-grow">
            <h3 className="text-base font-semibold">{agent.name}</h3>
            <p className="text-sm text-muted-foreground line-clamp-3">
              {displayText}
            </p>
          </div>

          {/* Integrations list slot */}
          <div className="flex gap-2 flex-wrap">
            {Object
              .entries(agent.tools_set ?? {})
              .filter(([_, tools]) => tools.length > 0)
              .map(([toolSetId]) => (
                <IntegrationMiniature key={toolSetId} toolSetId={toolSetId} />
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
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
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

  // Use the useAgents hook to get all agent IDs
  const { items: agentIds, loading: agentsLoading } = useAgents();

  // Function to handle creating a new Agent
  const handleCreate = async () => {
    try {
      setCreating(true);
      const agent = await createAgent();
      focusAgent(agent.id, agent);
    } catch (error) {
      console.error("Error creating new agent:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 flex-grow">
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Filter agents..."
          value={filter}
          onChange={(e) =>
            dispatch({ type: "SET_FILTER", payload: e.target.value })}
          className="w-full md:w-64"
        />
        <Button onClick={handleCreate} disabled={creating} className="gap-2">
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

      {agentsLoading
        ? (
          <div className="flex h-48 items-center justify-center">
            <Spinner size="lg" />
          </div>
        )
        : agentIds.length > 0
        ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 peer">
              {agentIds.map((agentId) => (
                <AgentCard
                  key={agentId}
                  agentId={agentId}
                  filter={filter}
                />
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
    </div>
  );
}
