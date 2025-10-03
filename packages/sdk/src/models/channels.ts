import { z } from "zod/v3";
import { IntegrationSchema } from "./mcp.ts";

export const ChannelSchema = z.object({
  id: z.string().describe("The ID of the channel"),
  discriminator: z.string().describe("The discriminator of the channel"),
  agentIds: z
    .array(z.string())
    .describe("The IDs of the agents the channel is linked to"),
  name: z.string().optional().describe("The name of the channel"),
  createdAt: z.string().describe("The date and time the channel was created"),
  updatedAt: z
    .string()
    .describe("The date and time the channel was last updated"),
  workspace: z.string().describe("The workspace the channel belongs to"),
  active: z.boolean().describe("Whether the channel is active"),
  integration: IntegrationSchema.optional()
    .describe("The integration the channel belongs to")
    .nullable(),
});

export type Channel = z.infer<typeof ChannelSchema>;
