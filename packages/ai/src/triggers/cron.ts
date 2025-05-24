import { Cron } from "croner";
import { AIAgent } from "../agent.ts";
import type { TriggerData } from "./services.ts";
import type { TriggerHooks } from "./trigger.ts";

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

    const messages = data.prompt.messages.map((message) => ({
      ...message,
      id: crypto.randomUUID(),
    }));

    let response: unknown;

    if (trigger.outputBinding) {
      const args = [messages, {
        threadId,
        resourceId: data.id,
      }];
      response = await trigger.outputBinding.ON_AGENT_OUTPUT({
        callbacks: trigger.callbacks({ args }),
      });
    } else {
      const agent = trigger.state.stub(AIAgent).new(trigger.agentId)
        .withMetadata({
          threadId,
          resourceId: data.id,
        });
      response = await agent.generate(
        messages,
      );
    }
    const cron = new Cron(data.cronExp);
    const dt = cron.nextRun();
    if (dt) {
      await trigger.state.storage.setAlarm(dt.getTime());
    }
    return response;
  },
};
