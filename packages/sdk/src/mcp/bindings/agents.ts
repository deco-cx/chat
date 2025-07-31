import { z } from "zod";
import type { Binder } from "../index.ts";
import { AgentSchema } from "../../models/agent.ts";

const listAgentsSchema = z.object({
  agents: z.array(AgentSchema),
});

export const AGENT_BINDING_SCHEMA = [{
  name: "DECO_CHAT_AGENTS_LIST" as const,
  inputSchema: z.any(),
  outputSchema: listAgentsSchema,
}] as const satisfies Binder;
