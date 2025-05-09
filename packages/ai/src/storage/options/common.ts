import type { Workspace } from "@deco/sdk/path";
import type { Agent, Integration } from "../../schemas.ts";

export const agentToIntegration = (
  agent: Agent,
  workspace: Workspace,
): Integration => ({
  id: agent.id,
  name: agent.name,
  description: agent.description,
  icon: agent.avatar,
  connection: { type: "INNATE", name: agent.id, workspace },
});
