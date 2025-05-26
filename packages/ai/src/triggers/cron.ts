import { Cron } from "croner";
import { AIAgent } from "../agent.ts";
import type { TriggerHooks } from "./trigger.ts";
import type { TriggerData } from "./services.ts";

export const hooks: TriggerHooks<TriggerData & { type: "cron" }> = {
  type: "cron",
  onCreated: async (data, trigger) => {
    const cron = new Cron(data.cronExp);
    const dt = cron.nextRun();
    if (dt) {
      await trigger.state.storage.setAlarm(dt.getTime());
    }
  },
  onDeleted: async (_data, trigger) => {
    await trigger.state.storage.deleteAlarm();
  },
  run: async (data, trigger) => {
    console.log("[CRON] run data", JSON.stringify(data, null, 2));
    if (trigger.metadata?.internalCall === false) {
      return {
        success: false,
        message: "Trigger is not allowed to be run from external sources",
      };
    }
    if (!("prompt" in data)) {
      return {
        success: false,
        message: "Prompt is required",
      };
    }
    const defaultThreadId = data.prompt.resourceId
      ? crypto.randomUUID()
      : undefined;
    const threadId = data.prompt.threadId ?? defaultThreadId;
    console.log("[CRON] threadId", threadId);
    const agent = trigger.state.stub(AIAgent).new(trigger.agentId)
      .withMetadata({
        threadId,
        resourceId: data.id,
      });
    console.log("[CRON] agent", JSON.stringify(agent, null, 2));
    const response = await agent.generate(
      data.prompt.messages.map((message) => ({
        ...message,
        id: crypto.randomUUID(),
      })),
    ).catch((error) => {
      console.log("[CRON] error", JSON.stringify(error, null, 2));
      return {
        success: false,
        message: "Error generating response",
      };
    });
    console.log("[CRON] response", JSON.stringify(response, null, 2));
    const cron = new Cron(data.cronExp);
    console.log("[CRON] cron", JSON.stringify(cron, null, 2));
    const dt = cron.nextRun();
    console.log("[CRON] dt", JSON.stringify(dt, null, 2));
    if (dt) {
      console.log("[CRON] setAlarm", dt.getTime());
      await trigger.state.storage.setAlarm(dt.getTime());
    }
    return response;
  },
};
