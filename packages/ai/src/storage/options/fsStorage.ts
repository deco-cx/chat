import { dirname } from "@std/path/posix";
import { Path, type Workspace } from "@deco/sdk/path";
import type { ServerTimingsBuilder } from "@webdraw/common/timings";
import type { FS } from "@webdraw/fs";
import * as defaultFs from "@webdraw/fs";
import { nullWhenENOENT } from "@webdraw/fs";
import { pickCapybaraAvatar } from "../../capybaras.ts";
import {
  type Agent,
  AgentSchema,
  type Integration,
  IntegrationSchema,
} from "../../schemas.ts";
import {
  INNATE_INTEGRATIONS,
  NEW_AGENT_TEMPLATE,
  NEW_INTEGRATION_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../constants.ts";
import { AgentNotFoundError, IntegrationNotFoundError } from "../error.ts";
import type {
  AgentStorage,
  DecoChatStorage,
  IntegrationsStorage,
  TriggersStorage,
} from "../index.ts";
import { agentToIntegration } from "./common.ts";
import { join } from "@std/path/posix";
import type { TriggerData } from "../../triggers/services.ts";

export const readAgent = async ({
  id,
  workspace,
  fs,
  timings,
}: {
  id: string;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}): Promise<Agent> => {
  try {
    if (id in WELL_KNOWN_AGENTS) {
      return AgentSchema.parse(WELL_KNOWN_AGENTS[id]);
    }

    const readTiming = timings?.start(`read-agent-${id}`);
    const str = await fs.readFile(
      Path.resolveHome(Path.files.Agent.manifest(id), workspace).path,
      "utf-8",
    ).catch(defaultFs.nullWhenENOENT);
    readTiming?.end();

    if (!str) {
      throw new AgentNotFoundError("Agent not found");
    }

    return AgentSchema.parse(JSON.parse(str));
  } catch (error) {
    throw error;
  }
};

export const listAgentIds = async ({
  workspace,
  fs,
  timings,
}: {
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  const listTiming = timings?.start(`list-agent-ids-${workspace}`);
  const fromFolder = await fs.readdir(
    Path.resolveHome(Path.folders.Agents(), workspace).path,
  ).catch(defaultFs.nullWhenENOENT);
  listTiming?.end();
  return fromFolder ?? [];
};

export const listAgents = async ({
  workspace,
  fs,
  timings,
}: {
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}): Promise<Agent[]> => {
  const agentIds = await listAgentIds({
    workspace,
    fs,
    timings,
  });

  const items = await Promise.all(
    agentIds.map(async (id) => {
      const data = await readAgent({
        id,
        workspace,
        fs,
        timings,
      }).catch(() => null);

      if (!data) return null;

      return { ...data, id };
    }),
  );

  return items.filter((item): item is Agent => item !== null);
};

export const createAgent = async ({
  agent,
  workspace,
  fs,
  timings,
}: {
  agent: Partial<Agent>;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}): Promise<Agent> => {
  try {
    const data = AgentSchema.parse({
      ...NEW_AGENT_TEMPLATE,
      avatar: pickCapybaraAvatar(),
      ...agent,
    });

    const agentPath =
      Path.resolveHome(Path.files.Agent.manifest(data.id), workspace).path;

    const mkdirTiming = timings?.start(`mkdir`);
    await fs.mkdir(dirname(agentPath), {
      recursive: true,
    });
    mkdirTiming?.end();

    const writeTiming = timings?.start(`write`);
    await fs.writeFile(
      agentPath,
      JSON.stringify(data, null, 2),
      "utf-8",
    );
    writeTiming?.end();

    return data;
  } catch (error) {
    throw error;
  }
};

const updateAgent = async ({
  id,
  agent,
  workspace,
  fs,
  timings,
}: {
  id: string;
  agent: Agent;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  try {
    const data = AgentSchema.parse(agent);

    const agentPath =
      Path.resolveHome(Path.files.Agent.manifest(id), workspace).path;

    const writeTiming = timings?.start(`write`);
    await fs.writeFile(
      agentPath,
      JSON.stringify(data, null, 2),
      "utf-8",
    );
    writeTiming?.end();

    return data;
  } catch (error) {
    throw error;
  }
};

export const deleteAgent = async ({
  id,
  workspace,
  fs,
  timings,
}: {
  id: string;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}): Promise<void> => {
  try {
    const rmTiming = timings?.start(`rm`);
    await fs.rm(
      Path.resolveHome(Path.files.Agent.manifest(id), workspace).path,
      { recursive: true },
    );
    rmTiming?.end();
  } catch (error) {
    throw error;
  }
};

const readIntegration = async ({
  id,
  workspace,
  fs,
  timings,
}: {
  id: string;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  if (id in INNATE_INTEGRATIONS) {
    return INNATE_INTEGRATIONS[id as keyof typeof INNATE_INTEGRATIONS];
  }

  const readIntegrationTiming = timings?.start(`read-integration-${id}`);
  const readAgentTiming = timings?.start(`read-agent-${id}`);

  const [agent, integration] = await Promise.all([
    readAgentAsIntegration({ id, workspace, fs, timings }).catch((err) => {
      if (err instanceof AgentNotFoundError) {
        return null;
      }

      throw err;
    }).finally(() => readAgentTiming?.end()),
    fs.readFile(
      Path.resolveHome(Path.files.mcp.server(id), workspace).path,
      "utf-8",
    ).catch(nullWhenENOENT).finally(() => readIntegrationTiming?.end()),
  ]);

  const parseIntegrationTiming = timings?.start(`parse-integration-${id}`);

  if (agent) {
    const response = IntegrationSchema.parse(agent);
    parseIntegrationTiming?.end();
    return response;
  }

  if (!integration) {
    throw new IntegrationNotFoundError("Integration not found");
  }

  const response = IntegrationSchema.parse(JSON.parse(integration));
  parseIntegrationTiming?.end();
  return response;
};

const listIntegrations = async ({
  workspace,
  fs,
  timings,
}: {
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  const readdirTiming = timings?.start("readdir-integrations");
  const listAgentIdsTiming = timings?.start("list-agent-ids");

  const [fromFolder, agent] = await Promise.all([
    fs.readdir(
      Path.resolveHome(Path.folders.Integrations(), workspace).path,
    ).catch(nullWhenENOENT).finally(() => readdirTiming?.end()),
    listAgentIds({ workspace, fs, timings }).finally(() =>
      listAgentIdsTiming?.end()
    ),
  ]);

  const innate = Object.keys(INNATE_INTEGRATIONS);

  const allIntegrations = [...(fromFolder || []), ...agent, ...innate];

  const readIntegrationTiming = timings?.start(
    `read-integration-${allIntegrations.length}`,
  );

  const formated = await Promise.all(
    allIntegrations.map((integration) =>
      // keeping same old behavior of returning null on every error. should maybe change tho...
      readIntegration({ id: integration, workspace, fs, timings }).catch(() =>
        null
      )
    ),
  );

  readIntegrationTiming?.end();

  return formated.map((integration) => integration).filter(
    Boolean,
  ) as Integration[];
};

const readAgentAsIntegration = async ({
  id,
  workspace,
  fs,
  timings,
}: {
  id: string;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  const agent = await readAgent({ id, workspace, fs, timings });

  return agentToIntegration(agent, workspace);
};

const createIntegration = async ({
  integration,
  workspace,
  fs,
  timings: _,
}: {
  integration: Integration;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  try {
    const { success, data, error } = IntegrationSchema.safeParse({
      ...NEW_INTEGRATION_TEMPLATE,
      ...integration,
    });

    if (!success) {
      throw error;
    }

    const integrationPath =
      Path.resolveHome(Path.folders.Integrations(), workspace).path;
    await fs.mkdir(integrationPath, { recursive: true });

    await fs.writeFile(
      Path.resolveHome(Path.files.mcp.server(data.id), workspace).path,
      JSON.stringify(data, null, 2),
      "utf-8",
    );

    return data;
  } catch (error) {
    throw error;
  }
};

const updateIntegration = async ({
  id,
  integration,
  workspace,
  fs,
  timings: _,
}: {
  id: string;
  integration: Integration;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  try {
    const { success, data, error } = IntegrationSchema.safeParse(integration);

    if (!success) {
      throw error;
    }

    await fs.writeFile(
      Path.resolveHome(Path.files.mcp.server(id), workspace).path,
      JSON.stringify(data, null, 2),
      "utf-8",
    );

    return data;
  } catch (error) {
    throw error;
  }
};

const deleteIntegration = async ({
  id,
  workspace,
  fs,
  timings: _,
}: {
  id: string;
  workspace: Workspace;
  fs: FS;
  timings?: ServerTimingsBuilder;
}) => {
  try {
    await fs.rm(
      Path.resolveHome(Path.files.mcp.server(id), workspace).path,
      { recursive: true },
    );

    return;
  } catch (error) {
    throw error;
  }
};

const listTriggers = async ({
  workspace,
  agentId,
  fs,
  timings: _,
}: {
  workspace: Workspace;
  agentId?: string;
  fs: FS;
  timings?: ServerTimingsBuilder;
}): Promise<TriggerData[]> => {
  if (!agentId) {
    return [];
  }

  const agentPath = join(
    Path.resolveHome(Path.folders.Agents(), workspace).path,
    agentId,
  );

  const triggerDirs = await fs.readdir(join(agentPath, Path.folders.triggers()))
    .catch(() => []);

  const triggers = await Promise.all(
    triggerDirs.map(async (triggerId) => {
      const triggerPath = join(
        agentPath,
        Path.folders.trigger(triggerId),
      );

      const dataPath = join(triggerPath, Path.files.triggerData());

      try {
        const data: TriggerData = await fs.readFile(dataPath, "utf-8")
          .then(JSON.parse);

        return {
          id: triggerId,
          data,
        };
      } catch {
        return null;
      }
    }),
  );

  const validTriggers = triggers.filter((t): t is NonNullable<typeof t> =>
    t !== null
  );

  return validTriggers.map((trigger) => ({
    ...trigger.data,
    id: trigger.id,
  }));
};

export const createFsStorage = (
  _fs?: FS,
  timings?: ServerTimingsBuilder,
): DecoChatStorage => {
  const fs = _fs || defaultFs;

  const agents: AgentStorage = {
    for: (workspace) => ({
      list: () => listAgents({ workspace, fs, timings }),
      get: (id: string) => readAgent({ id, workspace, fs, timings }),
      create: (agent: Agent) => createAgent({ agent, workspace, fs, timings }),
      update: (id: string, agent: Agent) =>
        updateAgent({ id, agent, workspace, fs, timings }),
      delete: (id: string) => deleteAgent({ id, workspace, fs, timings }),
    }),
  };

  const integrations: IntegrationsStorage = {
    for: (workspace) => ({
      list: () => listIntegrations({ workspace, fs, timings }),
      get: (id: string) => readIntegration({ id, workspace, fs, timings }),
      create: (integration: Integration) =>
        createIntegration({ integration, workspace, fs, timings }),
      update: (id: string, integration: Integration) =>
        updateIntegration({ id, integration, workspace, fs, timings }),
      delete: (id: string) => deleteIntegration({ id, workspace, fs, timings }),
    }),
  };

  const triggers = {
    for: (workspace: Workspace) => ({
      list: (agentId?: string) =>
        listTriggers({ workspace, fs, timings, agentId }),
    }),
  } as unknown as TriggersStorage;

  return { agents, integrations, triggers };
};
