import { Trigger } from "@deco/ai/actors";
import { Hosts } from "@deco/sdk/hosts";

import { z } from "zod/v3";
import { InternalServerError, NotFoundError } from "../../errors.ts";

import type { QueryResult } from "../../storage/index.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { ChannelBinding } from "../bindings/binder.ts";
import { type AppContext, createToolGroup } from "../context.ts";
import { convertFromDatabase } from "../integrations/api.ts";

const SELECT_CHANNEL_QUERY = `
  *,
  integration:deco_chat_integrations!inner(
    *
  ),
  agents:deco_chat_channel_agents(
    agent_id,
    agent:deco_chat_agents(id, name)
  )
` as const;

function mapChannel(
  channel: QueryResult<"deco_chat_channels", typeof SELECT_CHANNEL_QUERY>,
) {
  return {
    id: channel.id,
    discriminator: channel.discriminator,
    agentIds: Array.isArray(channel.agents)
      ? channel.agents.map((a: { agent_id: string }) => a.agent_id)
      : [],
    name: channel.name ?? undefined,
    createdAt: channel.created_at,
    updatedAt: channel.updated_at,
    workspace: channel.workspace,
    active: channel.active,
    integration: channel.integration
      ? convertFromDatabase(channel.integration)
      : null,
  };
}

const createTool = createToolGroup("Channel", {
  name: "Channel Management",
  description: "Create and manage communication channels.",
  icon: "https://assets.decocache.com/mcp/9e5d7fcd-3a3a-469b-9450-f2af05cdcc7e/Channel-Management.png",
});

export const listChannels = createTool({
  name: "CHANNELS_LIST",
  description: "List all channels",
  inputSchema: z.lazy(() => z.object({})),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const query = db
      .from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("workspace", workspace);

    const { data, error } = await query;

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      channels: data.map(mapChannel),
    };
  },
});

export const createChannel = createTool({
  name: "CHANNELS_CREATE",
  description: "Create a channel",
  inputSchema: z.lazy(() =>
    z.object({
      discriminator: z.string().describe("The channel discriminator"),
      integrationId: z.string().describe("The ID of the integration to use"),
      agentId: z
        .string()
        .optional()
        .describe("The ID of the agent to join the channel."),
      name: z.string().optional().describe("The name of the channel"),
    }),
  ),
  handler: async ({ discriminator, integrationId, agentId, name }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);
    const workspace = c.workspace.value;

    const integrationIdWithoutPrefix = integrationId.replace("i:", "");
    const { data: integration, error: integrationError } = await c.db
      .from("deco_chat_integrations")
      .select("*")
      .eq("workspace", workspace) // this ensures the integration is in the same workspace as the channel
      .eq("id", integrationIdWithoutPrefix)
      .maybeSingle();
    if (integrationError) {
      throw new InternalServerError(integrationError.message);
    }

    if (!integration) {
      throw new NotFoundError("Integration not found");
    }

    const db = c.db;

    // Insert the new channel
    const { data: channel, error } = await db
      .from("deco_chat_channels")
      .insert({
        discriminator,
        workspace,
        integration_id: integrationIdWithoutPrefix,
        name,
      })
      .select(SELECT_CHANNEL_QUERY)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Link agents if provided
    if (agentId) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );

      const [trigger, { data, error }] = await Promise.all([
        createWebhookTrigger(discriminator, agentId, c),
        c.db.from("deco_chat_agents").select("name").eq("id", agentId).single(),
      ]);
      if (error) {
        throw new InternalServerError(error.message);
      }
      if (!data) {
        throw new NotFoundError(`agent ${agentId} not found`);
      }
      await binding.DECO_CHAT_CHANNELS_JOIN({
        agentLink: generateAgentLink(c.workspace, agentId),
        discriminator,
        workspace,
        agentName: data.name,
        agentId,
        callbacks: trigger.callbacks,
      });

      await db.from("deco_chat_channel_agents").insert({
        channel_id: channel.id,
        agent_id: agentId,
      });
    }

    // Re-fetch with agents
    const { data: fullChannel, error: fetchError } = await db
      .from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", channel.id)
      .single();
    if (fetchError) throw new InternalServerError(fetchError.message);
    return mapChannel(fullChannel);
  },
});

const generateAgentLink = (
  workspace: { root: string; value: string; slug: string },
  agentId: string,
) => {
  return `https://${Hosts.WEB_APP}${
    workspace.root === "users" ? "/" : `${workspace.slug}/`
  }agent/${agentId}/${crypto.randomUUID()}`;
};

const getAgentName = (
  channel: QueryResult<"deco_chat_channels", typeof SELECT_CHANNEL_QUERY>,
  agentId: string,
) => {
  return (
    channel.agents.find((agent) => agent.agent_id === agentId)?.agent?.name ??
    "Deco Agent"
  );
};

export const channelJoin = createTool({
  name: "CHANNELS_JOIN",
  description: "Invite an agent to a channel",
  inputSchema: z.lazy(() =>
    z.object({
      id: z.string().describe("The ID of the channel to join, use only UUIDs."),
      agentId: z
        .string()
        .describe(
          "The ID of the agent to join the channel to, use only UUIDs.",
        ),
    }),
  ),
  handler: async ({ id, agentId }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    // Fetch channel with agents
    const { data: channel, error } = await db
      .from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }

    // Call JOIN_CHANNEL if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      const trigger = await createWebhookTrigger(
        channel.discriminator,
        agentId,
        c,
      );
      const agentName = getAgentName(channel, agentId);
      await binding.DECO_CHAT_CHANNELS_JOIN({
        agentName,
        agentLink: generateAgentLink(c.workspace, agentId),
        discriminator: channel.discriminator,
        workspace,
        agentId,
        callbacks: trigger.callbacks,
      });
    }

    // Insert into join table (if not exists)
    await db.from("deco_chat_channel_agents").upsert(
      { channel_id: id, agent_id: agentId },
      {
        onConflict: "channel_id,agent_id",
      },
    );

    const result = mapChannel(channel);
    return { ...result, agentIds: [...new Set([...result.agentIds, agentId])] };
  },
});

export const channelLeave = createTool({
  name: "CHANNELS_LEAVE",
  description: "Remove an agent from a channel",
  inputSchema: z.lazy(() =>
    z.object({
      id: z
        .string()
        .describe("The ID of the channel to unlink, use only UUIDs."),
      agentId: z
        .string()
        .describe("The ID of the agent to unlink, use only UUIDs."),
    }),
  ),
  handler: async ({ id, agentId }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    // Fetch channel with agents
    const { data: channel, error } = await db
      .from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) {
      throw new InternalServerError(error.message);
    }
    // Call LEAVE_CHANNEL if integration exists
    if (channel.integration) {
      const binding = ChannelBinding.forConnection(
        convertFromDatabase(channel.integration).connection,
      );
      await binding.DECO_CHAT_CHANNELS_LEAVE({
        discriminator: channel.discriminator,
        workspace,
      });
    }

    // Remove from join table
    await db
      .from("deco_chat_channel_agents")
      .delete()
      .eq("channel_id", id)
      .eq("agent_id", agentId);

    return mapChannel({
      ...channel,
      agents: channel.agents.filter((a) => a.agent_id !== agentId),
    });
  },
});

export const getChannel = createTool({
  name: "CHANNELS_GET",
  description: "Get a channel by ID",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: channel, error } = await db
      .from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .maybeSingle();

    if (error) {
      throw new InternalServerError(error.message);
    }

    if (!channel) {
      throw new NotFoundError("Channel not found");
    }

    return mapChannel(channel);
  },
});

const createWebhookTrigger = async (
  discriminator: string,
  agentId: string,
  c: AppContext,
) => {
  assertHasWorkspace(c);

  // Create new trigger
  const trigger = await c
    .stub(Trigger)
    .new(`${c.workspace.value}/triggers/${discriminator}`)
    .create({
      id: discriminator,
      type: "webhook" as const,
      passphrase: crypto.randomUUID() as string,
      title: "Channel Webhook",
      agentId,
    });

  if (!trigger.ok) {
    throw new InternalServerError("Failed to create trigger");
  }
  return trigger;
};

export const deleteChannel = createTool({
  name: "CHANNELS_DELETE",
  description: "Delete a channel",
  inputSchema: z.lazy(() => z.object({ id: z.string() })),
  handler: async ({ id }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const db = c.db;
    const workspace = c.workspace.value;

    const { data: channel, error: selectError } = await db
      .from("deco_chat_channels")
      .select(SELECT_CHANNEL_QUERY)
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (selectError) {
      throw new InternalServerError(selectError.message);
    }

    const binding = ChannelBinding.forConnection(
      convertFromDatabase(channel.integration).connection,
    );
    await binding.DECO_CHAT_CHANNELS_LEAVE({
      discriminator: channel.discriminator,
      workspace,
    });

    const { error } = await db
      .from("deco_chat_channels")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) {
      throw new InternalServerError(error.message);
    }

    return {
      id,
    };
  },
});
