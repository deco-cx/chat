import {
  type Agent,
  useCreateAgent as useCreateAgentSDK,
  useUpdateThreadMessages,
} from "@deco/sdk";
import { useFocusChat } from "../components/agents/hooks.ts";
import { trackEvent } from "./analytics.ts";

export const useCreateAgent = () => {
  const createAgent = useCreateAgentSDK();
  const updateThreadMessages = useUpdateThreadMessages();
  const focusEditAgent = useFocusChat();

  const create = async (
    agent: Partial<Agent>,
    { eventName }: { eventName?: string },
  ) => {
    const createdAgent = await createAgent.mutateAsync(agent);
    updateThreadMessages(createdAgent.id);
    focusEditAgent(createdAgent.id, crypto.randomUUID(), { history: false });
    trackEvent(eventName || "agent_create", {
      ok: true,
      data: agent,
    });
  };

  return create;
};
