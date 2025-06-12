import { useMemo } from "react";
import {
  type Agent,
  KNOWLEDGE_BASE_DIMENSION,
  useCreateKnowledge,
  useIntegrations,
} from "@deco/sdk";
import { getKnowledgeBaseIntegrationId } from "@deco/sdk/utils";

const convertUUIDToValidAlphanumeric = (uuid: string) =>
  uuid.replaceAll("-", "");

export const useAgentKnowledgeIntegration = (
  { id: idProp }: Agent,
) => {
  const id = useMemo(() => convertUUIDToValidAlphanumeric(idProp), [idProp]);
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

  const createAgentKnowledge = async () => {
    if (knowledgeIntegration) {
      return { name: id, dimmension: KNOWLEDGE_BASE_DIMENSION };
    }
    const kb = await createKnowledge.mutateAsync({ name: id });
    integrations.refetch();

    // Add the knowledge_base_search tool at agent

    return kb;
  };

  return {
    integration: knowledgeIntegration,
    createAgentKnowledge,
  };
};
