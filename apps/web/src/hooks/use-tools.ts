import { useAgent } from "@deco/sdk";
import { useMemo } from "react";

export const useTools = (agentId?: string) => {
  const { data: agent } = agentId ? useAgent(agentId) : { data: null };

  return useMemo(() => agent?.tools_set ?? {}, [agent]);
};
