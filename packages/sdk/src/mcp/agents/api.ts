import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod/v3";
import {
  AgentSchema,
  NEW_AGENT_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../../index.ts";
import { LocatorStructured } from "../../locator.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import {
  ForbiddenError,
  NotFoundError,
  InternalServerError,
} from "../index.ts";
import { getProjectIdFromContext } from "../projects/util.ts";
import { agents, organizations, projects, userActivity } from "../schema.ts";
import { deleteTrigger, listTriggers } from "../triggers/api.ts";

const createTool = createToolGroup("Agent", {
  name: "Agent Management",
  description: "Manage your agents",
  icon: "https://assets.decocache.com/mcp/6f6bb7ac-e2bd-49fc-a67c-96d09ef84993/Agent-Management.png",
});

export const getAgentsByIds = async (ids: string[], c: AppContext) => {
  assertHasWorkspace(c);

  if (ids.length === 0) return [];

  const dbIds = ids.filter((id) => !(id in WELL_KNOWN_AGENTS));

  let dbAgents: Omit<
    z.infer<typeof AgentSchema>,
    "instructions" | "memory" | "views" | "visibility" | "access"
  >[] = [];
  if (dbIds.length > 0) {
    const data = await c.drizzle
      .select({
        id: agents.id,
        name: agents.name,
        description: agents.description,
        tools_set: agents.tools_set,
        avatar: agents.avatar,
      })
      .from(agents)
      .where(inArray(agents.id, dbIds));

    dbAgents = data.map((item) =>
      AgentSchema.omit({
        instructions: true,
        memory: true,
        views: true,
        visibility: true,
        access: true,
      }).parse(item),
    );
  }

  return ids
    .map((id) => {
      if (id in WELL_KNOWN_AGENTS) {
        return AgentSchema.parse(
          WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
        );
      }
      return dbAgents.find((agent) => agent.id === id);
    })
    .filter((a): a is z.infer<typeof AgentSchema> => !!a);
};

export const IMPORTANT_ROLES = ["owner", "admin"];

/**
 * Returns a Drizzle OR condition that filters agents by workspace or project locator.
 * Used temporarily for the migration to the new schema. Soon will be removed in favor of
 * always using the project locator.
 */
export const matchByWorkspaceOrProjectLocatorForAgents = (
  workspace: string,
  locator?: LocatorStructured,
) => {
  return or(
    eq(agents.workspace, workspace),
    locator
      ? and(
          eq(projects.slug, locator.project),
          eq(organizations.slug, locator.org),
        )
      : undefined,
  );
};

const AGENT_FIELDS_SELECT = {
  id: agents.id,
  name: agents.name,
  avatar: agents.avatar,
  instructions: agents.instructions,
  description: agents.description,
  tools_set: agents.tools_set,
  max_steps: agents.max_steps,
  max_tokens: agents.max_tokens,
  model: agents.model,
  memory: agents.memory,
  views: agents.views,
  visibility: agents.visibility,
  access: agents.access,
  temperature: agents.temperature,
  workspace: agents.workspace,
  created_at: agents.created_at,
  access_id: agents.access_id,
  project_id: projects.id,
  org_id: organizations.id,
};

export const listAgents = createTool({
  name: "AGENTS_LIST",
  description: "List all agents",
  inputSchema: z.lazy(() => z.object({})),
  outputSchema: z.lazy(() =>
    z.object({
      items: z.array(
        AgentSchema.extend({
          lastAccess: z.string().nullable().optional(),
          lastAccessor: z.string().nullable().optional(),
        }),
      ),
    }),
  ),
  handler: async (_, c: WithTool<AppContext>) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const data = await c.drizzle
      .select(AGENT_FIELDS_SELECT)
      .from(agents)
      .leftJoin(projects, eq(agents.project_id, projects.id))
      .leftJoin(organizations, eq(projects.org_id, organizations.id))
      .where(
        matchByWorkspaceOrProjectLocatorForAgents(c.workspace.value, c.locator),
      )
      .orderBy(desc(agents.created_at));

    const roles =
      c.workspace.root === "users"
        ? []
        : await c.policy.getUserRoles(c.user.id as string, c.workspace.slug);
    const userRoles: string[] = roles?.map((role) => role.name);

    const filteredAgents = data.filter(
      (agent) =>
        !agent.access ||
        userRoles?.includes(agent.access) ||
        userRoles?.some((role) => IMPORTANT_ROLES.includes(role)),
    );

    const agentIds = filteredAgents
      .map((a) => a.id)
      .filter((id) => !(id in WELL_KNOWN_AGENTS));

    let latestByAgent: Record<
      string,
      { created_at: string; user_id: string } | undefined
    > = {};
    if (agentIds.length > 0) {
      try {
        const rows = await c.drizzle
          .select({
            createdAt: userActivity.created_at,
            userId: userActivity.user_id,
            value: userActivity.value,
          })
          .from(userActivity)
          .where(
            and(
              eq(userActivity.resource, "agent"),
              eq(userActivity.key, "id"),
              inArray(userActivity.value, agentIds),
            ),
          )
          .orderBy(desc(userActivity.created_at));

        latestByAgent = rows.reduce(
          (acc, row) => {
            const value = row.value ?? undefined;
            if (!value) return acc;
            if (acc[value]) return acc;

            const createdAt =
              row.createdAt instanceof Date
                ? row.createdAt.toISOString()
                : (row.createdAt ?? undefined);

            if (!createdAt) return acc;

            acc[value] = {
              created_at: createdAt,
              user_id: row.userId,
            };

            return acc;
          },
          {} as Record<
            string,
            { created_at: string; user_id: string } | undefined
          >,
        );
      } catch (error) {
        throw new InternalServerError(
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return {
      items: filteredAgents
        .map((raw) => {
          const base = AgentSchema.parse(raw);
          const latest = latestByAgent[base.id];
          return {
            ...base,
            lastAccess: latest?.created_at ?? null,
            lastAccessor: latest?.user_id ?? null,
          };
        })
        .filter((a) => !!a),
    };
  },
});

export const getAgent = createTool({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  outputSchema: z.lazy(() => AgentSchema),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    const [canAccess, data] = await Promise.all([
      assertWorkspaceResourceAccess(c)
        .then(() => true)
        .catch(() => false),
      id in WELL_KNOWN_AGENTS
        ? Promise.resolve(
            WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
          )
        : c.drizzle
            .select(AGENT_FIELDS_SELECT)
            .from(agents)
            .leftJoin(projects, eq(agents.project_id, projects.id))
            .leftJoin(organizations, eq(projects.org_id, organizations.id))
            .where(
              and(
                matchByWorkspaceOrProjectLocatorForAgents(
                  c.workspace.value,
                  c.locator,
                ),
                eq(agents.id, id),
              ),
            )
            .limit(1)
            .then((r) => r[0]),
    ]);

    if (!data) {
      throw new NotFoundError(id);
    }

    if (data.visibility !== "PUBLIC" && !canAccess) {
      throw new ForbiddenError(`You are not allowed to access this agent`);
    }

    c.resourceAccess.grant();

    return AgentSchema.parse(data);
  },
});

export const createAgent = createTool({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  inputSchema: z.lazy(() => AgentSchema.partial()),
  outputSchema: z.lazy(() => AgentSchema),
  handler: async (agent, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const [data] = await c.drizzle
      .insert(agents)
      .values({
        ...NEW_AGENT_TEMPLATE,
        ...agent,
        workspace: c.workspace.value,
        project_id: await getProjectIdFromContext(c),
      })
      .returning(AGENT_FIELDS_SELECT);

    return AgentSchema.parse(data);
  },
});

export const createAgentSetupTool = createToolGroup("AgentSetup", {
  name: "Agent Setup",
  description:
    "Configure agent identity, update settings, and list available integrations.",
  icon: "https://assets.decocache.com/mcp/42dcf0d2-5a2f-4d50-87a6-0e9ebaeae9b5/Agent-Setup.png",
});

export const updateAgent = createAgentSetupTool({
  name: "AGENTS_UPDATE",
  description: "Update an existing agent",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string(),
      agent: AgentSchema.partial(),
    }),
  ),
  outputSchema: z.lazy(() => AgentSchema),
  handler: async ({ id, agent }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const updateData = {
      ...agent,
      // enforce workspace and remove
      // project_id from the update data
      workspace: c.workspace.value,
      project_id: undefined,
    };

    const [data] = await c.drizzle
      .update(agents)
      .set(updateData)
      .where(eq(agents.id, id))
      .returning(AGENT_FIELDS_SELECT);

    if (!data) {
      throw new NotFoundError("Agent not found");
    }

    return AgentSchema.parse(data);
  },
});

export const deleteAgent = createTool({
  name: "AGENTS_DELETE",
  description: "Delete an agent by id",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  outputSchema: z.lazy(() => z.object({ deleted: z.boolean() })),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    // this could be a cte
    const agentExists = await c.drizzle
      .select({ id: agents.id })
      .from(agents)
      .leftJoin(projects, eq(agents.project_id, projects.id))
      .leftJoin(organizations, eq(projects.org_id, organizations.id))
      .where(
        and(
          eq(agents.id, id),
          matchByWorkspaceOrProjectLocatorForAgents(
            c.workspace.value,
            c.locator,
          ),
        ),
      )
      .limit(1);

    if (!agentExists.length) {
      throw new NotFoundError("Agent not found");
    }

    await c.drizzle.delete(agents).where(eq(agents.id, id));

    const triggers = await listTriggers.handler({ agentId: id });

    for (const trigger of triggers.triggers) {
      await deleteTrigger.handler({ id: trigger.id });
    }

    // TODO: implement an way to remove knowledge base and it's files from asset and kb

    return { deleted: true };
  },
});
