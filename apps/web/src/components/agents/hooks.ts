import type { Agent } from "@deco/sdk";
import { MCPClient, useUpdateThreadMessages } from "@deco/sdk";
import { useCallback, useState } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

interface AgentNavigationOptions {
  message?: string;
  history?: boolean;
}

const getChatPath = (agentId: string, threadId: string): string =>
  `/agent/${agentId}/${threadId}`;

export const useFocusChat = () => {
  const navigateWorkspace = useNavigateWorkspace();
  const updateMessages = useUpdateThreadMessages();

  const navigateToAgent = useCallback(
    (agentId: string, threadId: string, options?: AgentNavigationOptions) => {
      // If history is false, disable fetching history for faster navigation
      if (options?.history === false) {
        updateMessages(threadId);
      }

      const pathname = getChatPath(agentId, threadId);
      // Add query parameters if options are provided
      let url = pathname;
      const searchParams = new URLSearchParams();

      if (options?.message) {
        searchParams.append("message", options.message);
      }

      // Only append search params if we have any
      if (searchParams.toString()) {
        url = `${pathname}?${searchParams.toString()}`;
      }

      // Navigate to the agent page
      navigateWorkspace(url);
    },
    [navigateWorkspace, updateMessages],
  );

  return navigateToAgent;
};

interface WorkspaceOption {
  id: string;
  label: string;
  slug: string;
  isPersonal: boolean;
  avatarUrl?: string;
}

export const useCopyAgentToWorkspace = () => {
  const [isLoading, setIsLoading] = useState(false);

  const copyAgent = useCallback(async (agent: Agent, targetWorkspace: WorkspaceOption) => {
    setIsLoading(true);
    
    try {
      // Determine target workspace string
      const workspaceId = targetWorkspace.isPersonal 
        ? `users/${targetWorkspace.id}`
        : `shared/${targetWorkspace.slug}`;

      // Create MCP client for target workspace
      const targetClient = MCPClient.forWorkspace(workspaceId);

      // Prepare agent data for copying
      const copiedAgent = {
        id: crypto.randomUUID(),
        name: `${agent.name} (Copy)`,
        avatar: agent.avatar,
        description: agent.description,
        instructions: agent.instructions,
        model: agent.model,
        tools_set: agent.tools_set,
        max_steps: agent.max_steps,
        max_tokens: agent.max_tokens,
        memory: agent.memory,
        views: agent.views,
        visibility: agent.visibility,
        access: agent.access,
      };

      // Create the agent in the target workspace
      await targetClient.AGENTS_CREATE(copiedAgent);
      
      return copiedAgent;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { copyAgent, isLoading };
};
