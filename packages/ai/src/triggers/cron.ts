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
    const sendPromptToAgent = async (prompt: {
      messages: {
        content: string;
        role: "user" | "assistant" | "system";
      }[];
      threadId?: string | undefined;
      resourceId?: string | undefined;
    }) => {
      const defaultThreadId = prompt.resourceId
        ? crypto.randomUUID()
        : undefined;
      const threadId = prompt.threadId ?? defaultThreadId;

      const messages = prompt.messages.map((message) => ({
        ...message,
        id: crypto.randomUUID(),
      }));

      const agent = trigger.state
        .stub(AIAgent)
        .new(trigger.agentId)
        .withMetadata({
          threadId,
          resourceId: data.id,
        });
      return await agent.generate(messages);
    };
    let response: unknown;
    if ("prompt" in data) {
      response = await sendPromptToAgent(data.prompt);
    }

    if ("callTool" in data) {
      response = await trigger._callTool(data.callTool);
    }

    const cron = new Cron(data.cronExp);
    const dt = cron.nextRun();
    if (dt) {
      await trigger.state.storage.setAlarm(dt.getTime());
    }
    return response;
  },
};
