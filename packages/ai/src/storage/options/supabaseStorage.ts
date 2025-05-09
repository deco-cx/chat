import type { AuthUser } from "@supabase/supabase-js";
import type { WebdrawSupabase } from "@webdraw/auth";
import { hasAccessToPath } from "@webdraw/auth/user";
import type { Workspace } from "@deco/sdk/path";
import { pickCapybaraAvatar } from "../../capybaras.ts";
import {
  type Agent,
  AgentSchema,
  type Integration,
  IntegrationSchema,
} from "../../schemas.ts";
import type { PromptSchema } from "../../triggers/services.ts";
import {
  INNATE_INTEGRATIONS,
  NEW_AGENT_TEMPLATE,
  NEW_INTEGRATION_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../constants.ts";
import {
  AgentNotFoundError,
  IntegrationNotFoundError,
  TriggerNotFoundError,
} from "../error.ts";
import type {
  AgentStorage,
  DecoChatStorage,
  IntegrationsStorage,
  TriggersStorage,
} from "../index.ts";
import { agentToIntegration } from "./common.ts";
import type z from "zod";
import type { Json } from "@webdraw/auth";
import type { Database } from "@webdraw/auth";
import type { TriggerData, TriggerRun } from "../../triggers/services.ts";

type UserMetadata = {
  iss?: string;
  sub?: string;
  name?: string;
  email?: string;
  picture?: string;
  full_name?: string;
  avatar_url?: string;
  provider_id?: string;
  custom_claims?: { hd?: string };
  email_verified?: boolean;
  phone_verified?: boolean;
};

const readAgent = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Agent> => {
  try {
    if (id in WELL_KNOWN_AGENTS) {
      return AgentSchema.parse(WELL_KNOWN_AGENTS[id]);
    }

    const { data, error } = await supabase
      .from("deco_chat_agents")
      .select("*")
      .eq("id", id)
      .eq("workspace", workspace)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new AgentNotFoundError("Agent not found");
    }

    return AgentSchema.parse(data);
  } catch (error) {
    throw error;
  }
};

const listAgents = async ({
  workspace,
  supabase,
}: {
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Agent[]> => {
  const { data, error } = await supabase
    .from("deco_chat_agents")
    .select("*")
    .eq("workspace", workspace);

  if (error) {
    throw error;
  }

  return data.map((agent) => AgentSchema.parse(agent));
};

const getAgentsByIds = async ({
  ids,
  workspace,
  supabase,
}: {
  ids: string[];
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Agent[]> => {
  if (ids.length === 0) return [];

  const dbIds = ids.filter((id) => !(id in WELL_KNOWN_AGENTS));

  let dbAgents: Agent[] = [];
  if (dbIds.length > 0) {
    const { data, error } = await supabase
      .from("deco_chat_agents")
      .select("*")
      .in("id", dbIds)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }

    dbAgents = data.map((item) => AgentSchema.parse(item));
  }

  return ids
    .map((id) => {
      if (id in WELL_KNOWN_AGENTS) {
        return AgentSchema.parse(WELL_KNOWN_AGENTS[id]);
      }
      return dbAgents.find((agent) => agent.id === id);
    })
    .filter((a): a is Agent => !!a);
};

const createAgent = async ({
  agent,
  workspace,
  supabase,
}: {
  agent: Partial<Agent>;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Agent> => {
  try {
    const data = AgentSchema.parse({
      ...NEW_AGENT_TEMPLATE,
      avatar: pickCapybaraAvatar(),
      ...agent,
    });

    const { error } = await supabase
      .from("deco_chat_agents")
      .insert({ ...data, workspace });

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw error;
  }
};

const updateAgent = async ({
  id,
  agent,
  workspace,
  supabase,
}: {
  id: string;
  agent: Agent;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Agent> => {
  try {
    const data = AgentSchema.parse(agent);

    const { error } = await supabase
      .from("deco_chat_agents")
      .update(data)
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }

    return data;
  } catch (error) {
    throw error;
  }
};

const deleteAgent = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<void> => {
  try {
    const { error } = await supabase
      .from("deco_chat_agents")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
};

const parseIntegrationId = (id: string) => {
  const [type, uuid] = id.split(":");

  return { type: type || "i", uuid: uuid || type };
};

const formatIntegrationId = (type: "a" | "i", uuid: string) => {
  return `${type}:${uuid}`;
};

const parseIntegration = (data: unknown) => {
  const i = IntegrationSchema.parse(data);

  return {
    ...i,
    id: formatIntegrationId("i", i.id),
  };
};

const parseAgentAsIntegration = (data: unknown, workspace: Workspace) => {
  const a = AgentSchema.parse(data);

  return agentToIntegration({
    ...a,
    id: formatIntegrationId("a", a.id),
  }, workspace);
};

const readIntegration = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Integration> => {
  if (id in INNATE_INTEGRATIONS) {
    return INNATE_INTEGRATIONS[id as keyof typeof INNATE_INTEGRATIONS];
  }

  const { type, uuid } = parseIntegrationId(id);

  const { data, error } = await supabase
    .from(type === "a" ? "deco_chat_agents" : "deco_chat_integrations")
    .select("*")
    .eq("id", uuid)
    .eq("workspace", workspace)
    .single();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new IntegrationNotFoundError("Integration not found");
  }

  return type === "a"
    ? parseAgentAsIntegration(data, workspace)
    : parseIntegration(data);
};

const listIntegrations = async ({
  workspace,
  supabase,
}: {
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Integration[]> => {
  const [integrationsResult, agentsResult] = await Promise.all([
    supabase
      .from("deco_chat_integrations")
      .select("*")
      .eq("workspace", workspace),
    supabase
      .from("deco_chat_agents")
      .select("*")
      .eq("workspace", workspace),
  ]);

  const error = integrationsResult.error || agentsResult.error;

  if (error) {
    throw error;
  }

  const supaIntegrations = integrationsResult.data
    .map(parseIntegration);

  const agentIntegrations = agentsResult.data
    .map((agent) => parseAgentAsIntegration(agent, workspace));

  const innateIntegrations = Object.values(INNATE_INTEGRATIONS);

  return [...supaIntegrations, ...agentIntegrations, ...innateIntegrations];
};

const createIntegration = async ({
  integration,
  workspace,
  supabase,
}: {
  integration: Integration;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Integration> => {
  try {
    const { success, data, error: validationError } = IntegrationSchema
      .safeParse({
        ...NEW_INTEGRATION_TEMPLATE,
        ...integration,
      });

    if (!success) {
      throw validationError;
    }

    const { error } = await supabase
      .from("deco_chat_integrations")
      .upsert({ ...data, workspace, id: parseIntegrationId(data.id).uuid });

    if (error) {
      throw error;
    }

    return { ...data, id: formatIntegrationId("i", data.id) };
  } catch (error) {
    throw error;
  }
};

const updateIntegration = async ({
  id,
  integration,
  workspace,
  supabase,
}: {
  id: string;
  integration: Integration;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<Integration> => {
  try {
    const { success, data, error: validationError } = IntegrationSchema
      .safeParse(integration);

    if (!success) {
      throw validationError;
    }

    const { id: _, ...rest } = data;

    const { type, uuid } = parseIntegrationId(id);

    if (type === "a") {
      throw new Error("Cannot update agent");
    }

    const { error } = await supabase
      .from("deco_chat_integrations")
      .update({ ...rest })
      .eq("id", uuid)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }

    return { ...data, id: formatIntegrationId("i", data.id) };
  } catch (error) {
    throw error;
  }
};

const deleteIntegration = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<void> => {
  try {
    const { type, uuid } = parseIntegrationId(id);

    if (type === "a") {
      throw new Error("Cannot delete agent");
    }

    const { error } = await supabase
      .from("deco_chat_integrations")
      .delete()
      .eq("id", uuid)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
};

const SELECT_TRIGGER_QUERY = `
  *, 
  profile:profiles(
    metadata:users_meta_data_view(
      raw_user_meta_data
    )
  )
`;
const mapTriggerToTriggerData = (
  trigger: Database["public"]["Tables"]["deco_chat_triggers"]["Row"] & {
    profile?: {
      metadata: {
        raw_user_meta_data: Json;
      };
    } | null;
  },
): TriggerData & { url?: string } => {
  const metadata = (trigger.metadata ?? {}) as Record<string, unknown>;
  const userMetadata = trigger.profile?.metadata?.raw_user_meta_data as
    | UserMetadata
    | undefined;

  return {
    id: trigger.id,
    type: metadata.type as "cron" | "webhook",
    title: metadata.title as string,
    description: metadata.description as string,
    cronExp: metadata.cron_exp as string,
    prompt: metadata.prompt as z.infer<typeof PromptSchema>,
    url: metadata.url as string,
    passphrase: metadata.passphrase as string,
    schema: metadata.schema as Record<string, unknown>,
    createdAt: trigger.created_at,
    updatedAt: trigger.updated_at,
    author: userMetadata
      ? {
        id: trigger?.user_id ?? "",
        name: userMetadata.name ?? "",
        email: userMetadata.email ?? "",
        avatar: userMetadata.avatar_url ?? "",
      }
      : undefined,
  };
};

const listTriggers = async ({
  workspace,
  supabase,
  agentId,
}: {
  workspace: Workspace;
  supabase: WebdrawSupabase;
  agentId?: string;
}): Promise<TriggerData[]> => {
  const query = supabase
    .from("deco_chat_triggers")
    .select(SELECT_TRIGGER_QUERY)
    .eq("workspace", workspace);

  if (agentId) {
    query.eq("agent_id", agentId);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  const agentIds = Array.from(
    new Set(data.map((trigger) => trigger.agent_id).filter(Boolean)),
  );

  const agents = await getAgentsByIds({ ids: agentIds, workspace, supabase });
  const agentsById = agents.reduce((acc, agent) => {
    acc[agent.id] = agent;
    return acc;
  }, {} as Record<string, Agent>);

  return data.map((trigger) => ({
    ...mapTriggerToTriggerData(trigger),
    agent: agentsById[String(trigger.agent_id)] ?? undefined,
  }));
};

const readTrigger = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<TriggerData> => {
  const { data, error } = await supabase
    .from("deco_chat_triggers")
    .select(SELECT_TRIGGER_QUERY)
    .eq("id", id)
    .eq("workspace", workspace)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new TriggerNotFoundError("Trigger not found");
  }

  const agent = await readAgent({ id: data.agent_id, workspace, supabase });
  return { ...mapTriggerToTriggerData(data), agent };
};

const createTrigger = async ({
  trigger,
  agentId,
  workspace,
  supabase,
  userId,
}: {
  trigger: TriggerData & { url?: string };
  agentId: string;
  workspace: Workspace;
  supabase: WebdrawSupabase;
  userId: string;
}): Promise<TriggerData> => {
  const isWebhook = trigger.type === "webhook";
  const isCron = trigger.type === "cron";
  const { data, error } = await supabase
    .from("deco_chat_triggers")
    .insert({
      id: trigger.id || crypto.randomUUID(),
      agent_id: agentId,
      workspace: workspace,
      metadata: {
        type: trigger.type,
        title: trigger.title,
        description: trigger.description || null,
        cron_exp: isCron ? trigger.cronExp : null,
        prompt: isCron ? trigger.prompt : null,
        url: isWebhook ? trigger.url : null,
        passphrase: isWebhook ? trigger.passphrase : null,
        schema: isWebhook ? trigger.schema : null,
      } as Json,
      user_id: userId,
    })
    .select(SELECT_TRIGGER_QUERY)
    .single();

  if (error) {
    throw error;
  }

  return mapTriggerToTriggerData(data);
};

const deleteTrigger = async ({
  id,
  workspace,
  supabase,
}: {
  id: string;
  workspace: Workspace;
  supabase: WebdrawSupabase;
}): Promise<void> => {
  try {
    const { error } = await supabase
      .from("deco_chat_triggers")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) {
      throw error;
    }
  } catch (error) {
    throw error;
  }
};

const listTriggerRuns = async ({
  id,
  supabase,
}: {
  id: string;
  supabase: WebdrawSupabase;
}): Promise<TriggerRun[]> => {
  const { data, error } = await supabase
    .from("deco_chat_trigger_runs")
    .select("*")
    .eq("trigger_id", id);

  if (error) {
    throw error;
  }

  return data.map((run) => ({
    id: run.id,
    triggerId: run.trigger_id,
    timestamp: run.timestamp,
    result: run.result as Record<string, unknown>,
    status: run.status,
    metadata: run.metadata as Record<string, unknown>,
  }));
};

const createTriggerRun = async ({
  run,
  supabase,
}: {
  run: Omit<TriggerRun, "id" | "timestamp">;
  supabase: WebdrawSupabase;
}): Promise<TriggerRun> => {
  const { data, error } = await supabase
    .from("deco_chat_trigger_runs")
    .insert({
      trigger_id: run.triggerId,
      result: run.result as Json,
      metadata: run.metadata as Json,
      status: run.status,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw error || new Error("Failed to create trigger run data");
  }

  return {
    id: data.id,
    triggerId: data.trigger_id,
    result: data.result as Record<string, unknown>,
    status: data.status,
    metadata: data.metadata as Record<string, unknown>,
    timestamp: data.timestamp,
  };
};

export const createSupabaseStorage = (
  supabase: WebdrawSupabase,
  user?: AuthUser,
): DecoChatStorage => {
  const auth = (workspace: Workspace, user: AuthUser) => {
    if (!hasAccessToPath(user, workspace)) {
      throw new Error("Unauthorized");
    }
  };

  const agents: AgentStorage = {
    for: (workspace) => {
      if (user && workspace) {
        auth(workspace, user);
      }

      return {
        list: () => listAgents({ workspace, supabase }),
        get: (id: string) => readAgent({ id, workspace, supabase }),
        create: (agent: Agent) => createAgent({ agent, workspace, supabase }),
        update: (id: string, agent: Agent) =>
          updateAgent({ id, agent, workspace, supabase }),
        delete: (id: string) => deleteAgent({ id, workspace, supabase }),
      };
    },
  };

  const integrations: IntegrationsStorage = {
    for: (workspace) => {
      if (user && workspace) {
        auth(workspace, user);
      }

      return {
        list: () => listIntegrations({ workspace, supabase }),
        get: (id: string) => readIntegration({ id, workspace, supabase }),
        create: (integration: Integration) =>
          createIntegration({ integration, workspace, supabase }),
        update: (id: string, integration: Integration) =>
          updateIntegration({ id, integration, workspace, supabase }),
        delete: (id: string) => deleteIntegration({ id, workspace, supabase }),
      };
    },
  };

  const triggers: TriggersStorage = {
    for: (workspace) => {
      if (user && workspace) {
        auth(workspace, user);
      }

      return {
        list: (agentId?: string) =>
          listTriggers({ workspace, supabase, agentId }),
        get: (id: string) => readTrigger({ id, workspace, supabase }),
        create: (
          trigger: TriggerData & { url?: string },
          agentId: string,
          userId: string,
        ) => createTrigger({ trigger, agentId, workspace, supabase, userId }),
        delete: (id: string) => deleteTrigger({ id, workspace, supabase }),
        run: (run: Omit<TriggerRun, "id" | "timestamp">) =>
          createTriggerRun({ run, supabase }),
        listRuns: (id: string) => listTriggerRuns({ id, supabase }),
      };
    },
  };

  return { agents, integrations, triggers };
};
