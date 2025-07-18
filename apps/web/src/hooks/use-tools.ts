import { useAgent } from "@deco/sdk";
import { useMemo } from "react";

export const useAgentTools = (agentId: string) => {
  const { data: agent } = useAgent(agentId);

  return useMemo(() => agent?.tools_set ?? {}, [agent]);
};
