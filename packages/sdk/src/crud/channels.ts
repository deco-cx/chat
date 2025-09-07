import { MCPClient } from "../fetcher.ts";
import type { WellKnownBindings } from "../mcp/index.ts";
import type { Channel } from "../models/channels.ts";
import type { MCPConnection } from "../models/mcp.ts";
export type { Channel };

/**
 * List all channels in a workspace
 * @param workspace - The workspace to list channels from
 * @param signal - Optional AbortSignal for cancellation
 * @returns Array of channels
 */
export const listChannels = (
  workspace: string,
  signal?: AbortSignal,
): Promise<{ channels: Channel[] }> =>
  MCPClient.forWorkspace(workspace).CHANNELS_LIST({}, { signal });

/**
 * Create a new channel
 * @param workspace - The workspace to create the channel in
 * @param channel - The channel data to create
 * @returns The created channel
 */
export const createChannel = (
  workspace: string,
  channel: {
    discriminator: string;
    integrationId: string;
    agentId?: string;
    name?: string;
  },
): Promise<Channel> =>
  MCPClient.forWorkspace(workspace).CHANNELS_CREATE(channel);

/**
 * Get a channel by ID
 * @param workspace - The workspace of the channel
 * @param id - The ID of the channel to get
 * @param signal - Optional AbortSignal for cancellation
 * @returns The channel
 */
export const getChannel = (
  workspace: string,
  id: string,
  signal?: AbortSignal,
): Promise<Channel> =>
  MCPClient.forWorkspace(workspace).CHANNELS_GET({ id }, { signal });

/**
 * Make a agent join the channel
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to join
 * @param agentId - The ID of the agent to join the channel
 * @returns The updated channel
 */
export const joinChannel = (
  workspace: string,
  channelId: string,
  agentId: string,
): Promise<Channel> =>
  MCPClient.forWorkspace(workspace).CHANNELS_JOIN({
    id: channelId,
    agentId,
  });

/**
 * List available channels for a given connection
 */
export const listAvailableChannelsForConnection = (
  workspace: string,
  connection: MCPConnection,
) =>
  MCPClient.forConnection<(typeof WellKnownBindings)["Channel"]>(
    connection,
  ).DECO_CHAT_CHANNELS_LIST({
    workspace,
  });

/**
 * Remove an agent from a channel
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to leave
 * @returns The updated channel
 */
export const leaveChannel = (
  workspace: string,
  channelId: string,
  agentId: string,
): Promise<Channel> =>
  MCPClient.forWorkspace(workspace).CHANNELS_LEAVE({
    id: channelId,
    agentId: agentId,
  });

/**
 * Delete a channel
 * @param workspace - The workspace of the channel
 * @param channelId - The ID of the channel to delete
 * @returns Delete response with id and agentId
 */
export const deleteChannel = (workspace: string, channelId: string) =>
  MCPClient.forWorkspace(workspace).CHANNELS_DELETE({
    id: channelId,
  });
