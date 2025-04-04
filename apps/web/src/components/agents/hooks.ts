import { type Agent, SDK, type SidebarStorage, toAgentRoot } from "@deco/sdk";
import { useRuntime } from "@deco/sdk/hooks";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";

// Helper to get agent URL
const getAgentUrl = (agentId: string, threadId?: string): string =>
  `/agent/${agentId}/${threadId ?? ""}`;

// Helper to check if agent is pinned
const isAgentPinned = (
  sidebarState: SidebarStorage | null | undefined,
  context: { root: string } | null | undefined,
  agentUrl: string,
): boolean => {
  if (!context?.root || !sidebarState) return false;
  const sidebarItems = sidebarState[context.root] ?? [];
  return sidebarItems.some((item) => item.href === agentUrl);
};

// Helper to get sidebar item index
const getSidebarItemIndex = (
  sidebarState: SidebarStorage | null | undefined,
  context: { root: string } | null | undefined,
  agentUrl: string,
): number => {
  if (!context?.root || !sidebarState) return -1;
  const sidebarItems = sidebarState[context.root] ?? [];
  return sidebarItems.findIndex((item) => item.href === agentUrl);
};

export const useFocusAgent = () => {
  const { state: { context } } = useRuntime();
  const { pinAgent, isPinned } = useSidebarPinOperations();
  const navigate = useNavigate();

  const navigateToAgent = useCallback(
    (agentId: string, agent: Agent, threadId?: string) => {
      const url = getAgentUrl(agentId, threadId);

      // Navigate to the agent page
      // SDK.os.navigate(url);
      navigate(url);

      // Pin the agent to the sidebar if provided
      if (!isPinned(agentId)) {
        pinAgent(agent);
      }
    },
    [context, pinAgent],
  );

  return navigateToAgent;
};

// Custom hook for sidebar pin operations
export const useSidebarPinOperations = () => {
  const { state: { context, sidebarState }, dispatch } = useRuntime();

  // Function to pin an agent to the sidebar
  const pinAgent = useCallback(
    (agent: Agent) => {
      if (!context?.root) return;

      const agentUrl = getAgentUrl(agent.id);
      const isPinned = isAgentPinned(sidebarState, context, agentUrl);

      // Only pin if not already pinned
      if (!isPinned) {
        const sidebarItems = sidebarState?.[context.root] ?? [];
        const newSidebarState: SidebarStorage = {
          ...(sidebarState as SidebarStorage || {}),
          [context.root]: [
            ...sidebarItems,
            {
              label: agent.name,
              icon: agent.avatar || agent.name.substring(0, 2),
              href: agentUrl,
            },
          ],
        };

        dispatch({
          type: "update-sidebarState",
          payload: newSidebarState,
        });
      }
    },
    [context, sidebarState, dispatch],
  );

  // Function to unpin an agent from the sidebar
  const unpinAgent = useCallback(
    (agentId: string) => {
      if (!context?.root) return;

      const agentUrl = getAgentUrl(agentId);
      const index = getSidebarItemIndex(sidebarState, context, agentUrl);

      if (index !== -1) {
        const sidebarItems = sidebarState?.[context.root] ?? [];
        const newSidebarState = {
          ...sidebarState,
          [context.root]: sidebarItems.filter((_, i) => i !== index),
        };

        dispatch({
          type: "update-sidebarState",
          payload: newSidebarState,
        });
      }
    },
    [context, sidebarState, dispatch],
  );

  // Function to toggle pin status
  const togglePin = useCallback(
    (agent: Agent) => {
      if (!context?.root) return;

      const agentUrl = getAgentUrl(agent.id);
      const isPinned = isAgentPinned(sidebarState, context, agentUrl);

      if (isPinned) {
        unpinAgent(agent.id);
      } else {
        pinAgent(agent);
      }
    },
    [context, sidebarState, pinAgent, unpinAgent],
  );

  // Helper to check if an agent is pinned
  const isPinned = useCallback(
    (agentId: string): boolean => {
      const agentUrl = getAgentUrl(agentId);
      return isAgentPinned(sidebarState, context, agentUrl);
    },
    [context, sidebarState],
  );

  return { pinAgent, unpinAgent, togglePin, isPinned };
};

export const useAgentRoot = (agentId: string) => {
  const [agentRoot, setAgentRoot] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    const init = async () => {
      const resolved = await SDK.fs.resolvePath(toAgentRoot(agentId));

      if (cancel) return;

      setAgentRoot(resolved);
    };

    init().catch(console.error);

    return () => {
      cancel = true;
    };
  }, [agentId]);

  return agentRoot;
};
