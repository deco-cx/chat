import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import {
  AgentSchema,
  NEW_AGENT_TEMPLATE,
  WELL_KNOWN_AGENTS,
} from "../../index.ts";
import {
  assertHasLocator,
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
import { PgSelect } from "drizzle-orm/pg-core";

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
 * Adds ownership checking to an agent query.
 * Curently filters by workspace or project locator.
 * also adds a join to projects and organizations.
 * expected to be used in a query that selects the agents table.
 */
export function withOwnershipChecking<T extends PgSelect>({
  query,
  ctx,
}: {
  query: T;
  ctx: AppContext;
}) {
  assertHasWorkspace(ctx);
  assertHasLocator(ctx);
  const { workspace, locator } = ctx;

  return query
    .innerJoin(projects, eq(agents.project_id, projects.id))
    .innerJoin(organizations, eq(projects.org_id, organizations.id))
    .where(
      or(
        eq(agents.workspace, workspace.value),
        and(
          eq(projects.slug, locator.project),
          eq(organizations.slug, locator.org),
        ),
      ),
    );
}

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

const ListAgentsInputSchema = z.object({});

const ListAgentsOutputSchema = z.object({
  items: z.array(
    AgentSchema.extend({
      lastAccess: z.string().nullable().optional(),
      lastAccessor: z.string().nullable().optional(),
    }),
  ),
});

export const listAgents = createTool({
  name: "AGENTS_LIST",
  description: "List all agents",
  inputSchema: ListAgentsInputSchema,
  outputSchema: ListAgentsOutputSchema,
  handler: async (_, c: WithTool<AppContext>) => {
    assertHasWorkspace(c);
    assertHasLocator(c);

    await assertWorkspaceResourceAccess(c);

    const query = c.drizzle
      .select(AGENT_FIELDS_SELECT)
      .from(agents)
      .orderBy(desc(agents.created_at))
      .$dynamic();

    const data = await withOwnershipChecking({
      query,
      ctx: c,
    });

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

const GetAgentInputSchema = z.object({ id: z.string() });

export const getAgent = createTool({
  name: "AGENTS_GET",
  description: "Get an agent by id",
  inputSchema: GetAgentInputSchema,
  outputSchema: AgentSchema,
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    assertHasLocator(c);

    const [canAccess, data] = await Promise.all([
      assertWorkspaceResourceAccess(c)
        .then(() => true)
        .catch(() => false),
      id in WELL_KNOWN_AGENTS
        ? Promise.resolve(
            WELL_KNOWN_AGENTS[id as keyof typeof WELL_KNOWN_AGENTS],
          )
        : withOwnershipChecking({
            query: c.drizzle
              .select(AGENT_FIELDS_SELECT)
              .from(agents)
              .where(eq(agents.id, id))
              .limit(1)
              .$dynamic(),
            ctx: c,
          }).then((r) => r[0]),
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

const CreateAgentInputSchema = AgentSchema.partial();

export const createAgent = createTool({
  name: "AGENTS_CREATE",
  description: "Create a new agent",
  inputSchema: CreateAgentInputSchema,
  outputSchema: AgentSchema,
  handler: async (agent, c) => {
    await assertWorkspaceResourceAccess(c);

    const projectId = await getProjectIdFromContext(c);

    const [data] = await c.drizzle
      .insert(agents)
      .values({
        ...NEW_AGENT_TEMPLATE,
        ...agent,
        workspace: null,
        project_id: projectId,
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

const UpdateAgentInputSchema = z.object({
  id: z.string(),
  agent: AgentSchema.partial(),
});

export const updateAgent = createAgentSetupTool({
  name: "AGENTS_UPDATE",
  description: "Update an existing agent",
  inputSchema: UpdateAgentInputSchema,
  outputSchema: AgentSchema,
  handler: async ({ id, agent }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c);

    const existing = await withOwnershipChecking({
      query: c.drizzle
        .select({
          id: agents.id,
          workspace: agents.workspace,
          projectId: agents.project_id,
        })
        .from(agents)
        .where(eq(agents.id, id))
        .limit(1)
        .$dynamic(),
      ctx: c,
    }).then((r) => r[0]);

    const updateData = {
      ...agent,
      // If agent have workspace set as null, keep it as null
      // Soon this column will be removed
      workspace: existing?.workspace ?? null,
      // enforce project_id to be set
      project_id: existing?.projectId ?? (await getProjectIdFromContext(c)),
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

const DeleteAgentInputSchema = z.object({ id: z.string() });

const DeleteAgentOutputSchema = z.object({ deleted: z.boolean() });

export const deleteAgent = createTool({
  name: "AGENTS_DELETE",
  description: "Delete an agent by id",
  inputSchema: DeleteAgentInputSchema,
  outputSchema: DeleteAgentOutputSchema,
  handler: async ({ id }, c) => {
    await assertWorkspaceResourceAccess(c);

    const agentExists = await withOwnershipChecking({
      query: c.drizzle
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.id, id))
        .limit(1)
        .$dynamic(),
      ctx: c,
    });

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
