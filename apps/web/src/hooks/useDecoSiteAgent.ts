import { useMutation } from "@tanstack/react-query";
import { useParams } from "react-router";
import {
  listTools,
  useAgents,
  useCreateAgent,
  useCreateIntegration,
  useRemoveAgent,
} from "@deco/sdk";
import { useEffect } from "react";

// deno-lint-ignore no-explicit-any
const fetchDecoAdmin = async <T = any>(
  resolveType: string,
  init?: RequestInit,
): Promise<T> => {
  return await fetch(
    `http://localhost:4200/live/invoke/deco-sites/admin/${resolveType}`,
    {
      ...init,
      credentials: "include",
    },
  ).then((r) => r.json());
};

const DECO_CX_ADMIN_URL = "https://admin.deco.cx";
// const DECO_CX_ADMIN_URL ="http://localhost:4200"
const DECO_CX_ASSISTANT_NAME = "Analyser - deco.cx";
const isDecoCxAssistant = (assistantName: string) =>
  assistantName.endsWith(DECO_CX_ASSISTANT_NAME);
const getAssistanteNameForDecoSite = (sitename: string) =>
  `${sitename} ${DECO_CX_ASSISTANT_NAME}`;

export const useCreateAdminDecoAgent = (
  { agents }: {
    agents: ReturnType<typeof useAgents>["data"];
  },
) => {
  const { teamSlug } = useParams();
  const createIntegration = useCreateIntegration();
  const createAgent = useCreateAgent();

  const create = useMutation({
    mutationFn: async () => {
      const sites = await fetchDecoAdmin(
        "loaders/sites/getSites.ts",
        {
          credentials: "include",
        },
      ).catch(console.error);
      const site = sites?.sites[0] as undefined | { name: string; id: number };
      if (!site) return;
      const token = await fetchDecoAdmin("actions/profile/createApiKey.ts", {
        method: "POST",
      }).catch(console.error);

      if (typeof token !== "object" || typeof token.id !== "string") return;

      const integration = await createIntegration.mutateAsync({
        name: "Admin deco.cx",
        description: "Integration with deco.cx admin",
        icon: "https://admin.deco.cx/favicon.ico",
        connection: {
          type: "HTTP",
          url: [DECO_CX_ADMIN_URL, "mcp/messages"].join("/"),
          token: token.id,
        },
      });

      const tools = await listTools(integration.connection);
      const toolNames = tools.tools.map((t) => t.name);
      const analyticsTools = toolNames.filter((toolName) =>
        toolName.toLowerCase().includes("analytics")
      );

      const agent = await createAgent.mutateAsync({
        name: getAssistanteNameForDecoSite(site.name),
        avatar: integration.icon,
        instructions:
          `This is an agent to analyse traffic of deco.cx site "${site.name}" with this URL https://${site.name}.deco.site`,
        tools_set: {
          [integration.id]: analyticsTools.length ? analyticsTools : toolNames,
        },
      });

      return agent;
    },
    // onSuccess: (result) => {
    // const key = getKeyFor(context, result.id);
    //
    // // update item
    // client.setQueryData(key, result);
    //
    // // update list
    // client.setQueryData(getKeyFor(context), (old: Agent[] | undefined) => {
    //   if (!old) return [result];
    //   return [result, ...old];
    // });
    //
    // // invalidate list
    // client.invalidateQueries({ queryKey: getKeyFor(context) });
    // },
  });

  useEffect(function createFirstAgent() {
    const alreadyExistsDecoAssistant = agents?.find((agent) =>
      isDecoCxAssistant(agent.name)
    );

    // if (alreadyExistsDecoAssistant) {
    //   removeAgent.mutateAsync(alreadyExistsDecoAssistant.id);
    //   return;
    // }

    console.log({ myAgents: agents, alreadyExistsDecoAssistant });
    // check if agents with slugname already exists
    if (!agents || alreadyExistsDecoAssistant || !!teamSlug) return;

    create.mutateAsync();
  }, [agents]);
};
