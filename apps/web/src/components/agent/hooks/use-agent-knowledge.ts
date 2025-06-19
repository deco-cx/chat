import { useMemo } from "react";
import {
  type Agent,
  KNOWLEDGE_BASE_DIMENSION,
  useCreateKnowledge,
  useIntegrations,
  useUpdateAgent,
} from "@deco/sdk";
import { getKnowledgeBaseIntegrationId } from "@deco/sdk/utils";

/* Must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 63 characters long. */
const parseToValidIndexName = (uuid: string) => `_${uuid.replaceAll("-", "_")}`;

export const useAgentKnowledgeIntegration = (
  agent: Agent,
) => {
  const { id: idProp } = agent;
  const id = useMemo(() => parseToValidIndexName(idProp), [idProp]);
  const knowledgeIntegrationId = useMemo(
    () => getKnowledgeBaseIntegrationId(id),
    [id],
  );
  const integrations = useIntegrations();
  const knowledgeIntegration = useMemo(
    () =>
      integrations.data?.find((integration) =>
        integration.id === knowledgeIntegrationId
      ),
    [knowledgeIntegrationId, integrations],
  );

  const createKnowledge = useCreateKnowledge();
  const updateAgent = useUpdateAgent();

  const createAgentKnowledge = async () => {
    if (knowledgeIntegration) {
      return { name: id, dimmension: KNOWLEDGE_BASE_DIMENSION };
    }
    const kb = await createKnowledge.mutateAsync({ name: id });
    integrations.refetch();

    // Add the KNOWLEDGE_BASE_SEARCH tool to the agent
    const updatedToolsSet = {
      ...agent.tools_set,
      [knowledgeIntegrationId]: ["KNOWLEDGE_BASE_SEARCH"],
    };

    await updateAgent.mutateAsync({
      ...agent,
      tools_set: updatedToolsSet,
    });

    return kb;
  };

  return {
    integration: knowledgeIntegration,
    createAgentKnowledge,
  };
};
