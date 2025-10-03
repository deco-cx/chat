import { z } from "zod/v3";
import type { Binder } from "../index.ts";

const callbacksSchema = z.object({
  stream: z.string(),
  generate: z.string(),
  generateObject: z.string(),
});

const channelIdSchema = z.object({
  workspace: z.string(),
  discriminator: z.string(),
});

const channelBindingSchema = channelIdSchema.extend({
  agentId: z.string(),
  agentName: z.string(),
  agentLink: z.string(),
});

const joinChannelSchema = channelBindingSchema.extend({
  callbacks: callbacksSchema,
});

const listChannelsSchema = z.object({
  channels: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    }),
  ),
});

export type Callbacks = z.infer<typeof callbacksSchema>;
export type JoinedChannelPayload = z.infer<typeof joinChannelSchema>;
export type ListChannelsSchema = z.infer<typeof listChannelsSchema>;
export const CHANNEL_BINDING_SCHEMA = [
  {
    name: "DECO_CHAT_CHANNELS_JOIN" as const,
    inputSchema: joinChannelSchema,
    outputSchema: z.any(),
  },
  {
    name: "DECO_CHAT_CHANNELS_LEAVE" as const,
    inputSchema: channelIdSchema,
    outputSchema: z.any(),
  },
  {
    name: "DECO_CHAT_CHANNELS_LIST" as const,
    inputSchema: z.any(),
    outputSchema: listChannelsSchema,
    opt: true,
  },
] as const satisfies Binder;
