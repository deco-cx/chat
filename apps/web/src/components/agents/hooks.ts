import { useUpdateThreadMessages } from "@deco/sdk";
import { useCallback } from "react";
import { useNavigateWorkspace } from "../../hooks/use-navigate-workspace.ts";

interface AgentNavigationOptions {
  message?: string;
  history?: boolean;
}

const getChatPath = (agentId: string, threadId: string): string =>
  `/agent/${agentId}/${threadId}`;

// Maximum number of recent agents to store
export const MAX_RECENT_ITEMS = 20;

export const useFocusChat = () => {
  const navigateWorkspace = useNavigateWorkspace();
  const updateMessages = useUpdateThreadMessages();

  const navigateToAgent = useCallback(
    (agentId: string, threadId: string, options?: AgentNavigationOptions) => {
      // Atualiza lista de agents recentes no localStorage
      const key = "recentAgents";
      const stored = localStorage.getItem(key);
      let recent: string[] = stored ? JSON.parse(stored) : [];
      // Remove se já existe
      recent = recent.filter((id) => id !== agentId);
      // Adiciona no início
      recent.unshift(agentId);
      // Limita a 20
      if (recent.length > MAX_RECENT_ITEMS) recent = recent.slice(0, MAX_RECENT_ITEMS);
      localStorage.setItem(key, JSON.stringify(recent));

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
