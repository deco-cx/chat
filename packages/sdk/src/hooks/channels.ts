import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type Channel,
  createChannel,
  deleteChannel,
  getChannel,
  joinChannel,
  leaveChannel,
  listAvailableChannelsForConnection,
  listChannels,
} from "../crud/channels.ts";
import { InternalServerError } from "../errors.ts";
import type { Integration } from "../index.ts";
import { KEYS } from "./api.ts";
import { useSDK } from "./store.tsx";

export const useCreateChannel = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const create = useMutation({
    mutationFn: (channel: {
      discriminator: string;
      integrationId: string;
      agentId?: string;
      name?: string;
    }) => createChannel(workspace, channel),
    onSuccess: (result) => {
      const itemKey = KEYS.CHANNELS(workspace, result.id);
      client.cancelQueries({ queryKey: itemKey });
      client.setQueryData<Channel>(itemKey, result);

      const listKey = KEYS.CHANNELS(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<{ channels: Channel[] }>(listKey, (old) =>
        !old
          ? { channels: [result] }
          : {
              channels: [result, ...old.channels],
            },
      );
    },
  });

  return create;
};

export const useUpdateChannelCache = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const update = (channel: Channel) => {
    const itemKey = KEYS.CHANNELS(workspace, channel.id);
    client.cancelQueries({ queryKey: itemKey });
    client.setQueryData<Channel>(itemKey, channel ?? ({} as Channel));

    const listKey = KEYS.CHANNELS(workspace);
    client.cancelQueries({ queryKey: listKey });
    client.setQueryData<{ channels: Channel[] }>(listKey, (old) =>
      !old
        ? { channels: [channel] }
        : {
            channels: old.channels.map((c) =>
              c.id === channel.id ? channel : c,
            ),
          },
    );
  };

  return update;
};

export const useJoinChannel = () => {
  const { workspace } = useSDK();
  const updateChannelCache = useUpdateChannelCache();

  const res = useMutation({
    mutationFn: ({
      channelId,
      agentId,
    }: {
      channelId: string;
      agentId: string;
    }) => joinChannel(workspace, channelId, agentId),
    onSuccess: (result) => updateChannelCache(result),
  });

  return res;
};

export const useLeaveChannel = () => {
  const { workspace } = useSDK();
  const updateChannelCache = useUpdateChannelCache();

  const res = useMutation({
    mutationFn: ({
      channelId,
      agentId,
    }: {
      channelId: string;
      agentId: string;
    }) => leaveChannel(workspace, channelId, agentId),
    onSuccess: (result) => updateChannelCache(result),
  });

  return res;
};

export const useRemoveChannel = () => {
  const client = useQueryClient();
  const { workspace } = useSDK();

  const remove = useMutation({
    mutationFn: (id: string) => deleteChannel(workspace, id),
    onSuccess: (_, id) => {
      const itemKey = KEYS.CHANNELS(workspace, id);
      client.cancelQueries({ queryKey: itemKey });
      client.removeQueries({ queryKey: itemKey });

      const listKey = KEYS.CHANNELS(workspace);
      client.cancelQueries({ queryKey: listKey });
      client.setQueryData<{ channels: Channel[] }>(listKey, (old) =>
        !old
          ? { channels: [] }
          : {
              channels: old.channels.filter((channel) => channel.id !== id),
            },
      );
    },
  });

  return remove;
};

export const useChannel = (id: string) => {
  const { workspace } = useSDK();

  const data = useQuery({
    queryKey: KEYS.CHANNELS(workspace, id),
    queryFn: ({ signal }) => getChannel(workspace, id, signal),
    retry: (failureCount, error) =>
      error instanceof InternalServerError && failureCount < 2,
  });

  return data;
};

export const useChannels = () => {
  const { workspace } = useSDK();
  const client = useQueryClient();

  const data = useQuery({
    queryKey: KEYS.CHANNELS(workspace),
    queryFn: async ({ signal }) => {
      const result = await listChannels(workspace, signal);

      for (const item of result.channels) {
        const itemKey = KEYS.CHANNELS(workspace, item.id);
        client.cancelQueries({ queryKey: itemKey });
        client.setQueryData<Channel>(itemKey, item);
      }

      return result;
    },
  });

  return data;
};

export const useConnectionChannels = (binding: Integration) => {
  const { workspace } = useSDK();

  const data = useQuery({
    queryKey: KEYS.CHANNELS(workspace, binding.id),
    queryFn: async () => {
      const result = await listAvailableChannelsForConnection(
        workspace,
        binding.connection,
      ).catch((error) => {
        console.error(error);
        return { channels: [] };
      });

      return result;
    },
  });

  return data;
};
