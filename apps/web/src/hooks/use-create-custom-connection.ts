import { useCreateIntegration, useUpdateThreadMessages } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";
import { useCallback } from "react";
import { useNavigateWorkspace } from "./use-navigate-workspace.ts";

/**
 * Creates an empty connection and redirects to the connection detail page.
 * Use this for creating custom connections, like connecting to a proprietary MCP server.
 */
export const useCreateCustomConnection = () => {
  const create = useCreateIntegration();
  const updateThreadMessages = useUpdateThreadMessages();
  const navigateWorkspace = useNavigateWorkspace();

  return useCallback(async () => {
    try {
      const result = await create.mutateAsync({
        name: "Custom connection",
        description: "A custom connection to a MCP server",
        icon: "https://deco.chat/img/logo.png",
        connection: {
          type: "HTTP",
          url: "https://example.com/mcp",
        },
      });
      updateThreadMessages(result.id);
      navigateWorkspace(`/integration/${result.id}`);
    } catch (err) {
      console.error(err);
      toast.error(
        err instanceof Error ? err.message : "Failed to create integration",
      );
    }
  }, [create, updateThreadMessages, navigateWorkspace]);
};
