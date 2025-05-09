import { AIAgent } from "../agent.ts";
import type { Message } from "../types.ts";
import { threadOf } from "./tools.ts";
import type { TriggerHooks } from "./trigger.ts";
import type { TriggerData } from "./services.ts";

const debug = <T>(message: string, data?: T) => {
  console.log(`[Webhook Debug] ${message}`, data ? data : "");
};

export interface WebhookArgs {
  threadId?: string;
  resourceId?: string;
  messages: Message[];
}

export const hooks: TriggerHooks<TriggerData & { type: "webhook" }> = {
  type: "webhook",
  run: async (data, trigger, args) => {
    debug("Webhook trigger received", {
      triggerMeta: trigger.metadata,
      dataId: data.id,
    });
    debug("Args received", args);
    if (data.passphrase && data.passphrase !== trigger.metadata?.passphrase) {
      debug("Invalid passphrase detected");
      return {
        error: "Invalid passphrase",
      };
    }
    debug("Passphrase validation passed or not required");
    const url = trigger.metadata?.reqUrl
      ? new URL(trigger.metadata.reqUrl)
      : undefined;
    debug("Request URL", trigger.metadata?.reqUrl);

    const { threadId, resourceId } = threadOf(data, url);
    debug("Thread information resolved", { threadId, resourceId });

    debug("Initializing AI agent", { agentId: trigger.agentId });
    const agent = trigger.state.stub(AIAgent).new(trigger.agentId)
      .withMetadata({
        threadId: threadId ?? undefined,
        resourceId: resourceId ?? data.id ?? undefined,
      });
    debug("Agent metadata set", {
      threadId: threadId ?? undefined,
      resourceId: resourceId ?? data.id ?? undefined,
    });

    debug("Agent tools", {
      tools: await agent.getTools(),
      threadTools: await agent.getThreadTools(),
    });

    debug("Agent instructions", {
      instructions: await agent.configuration(),
    });

    debug("Constructing messages for agent");
    const messages = [
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        content: `the webhook is triggered with the following messages:`,
      },
      ...(args
        ? [{
          id: crypto.randomUUID(),
          role: "user" as const,
          content: `\`\`\`json\n${JSON.stringify(args)}\`\`\``,
        }]
        : []),
    ];
    debug("Messages constructed", { messageCount: messages.length });
    if (
      data.schema ||
      (typeof args === "object" && args !== null && "schema" in args &&
        typeof args.schema === "object")
    ) {
      // deno-lint-ignore no-explicit-any
      const schema = data.schema || (args as { schema: any }).schema;
      debug("Schema found, generating object with schema", {
        schemaSource: data.schema ? "data" : "args",
      });
      try {
        const result = await agent.generateObject(messages, schema).then((r) =>
          r.object
        );
        debug("Object generated successfully", { resultType: typeof result });
        return result;
      } catch (error) {
        debug("Error generating object with schema", { error: (error as { message?: string }).message });
        throw error;
      }
    }
    debug("No schema found, generating standard response");
    try {
      const result = await agent.generate(messages);
      debug("Response generated successfully");
      return result;
    } catch (error) {
      debug("Error generating response", { error: (error as { message?: string }).message });
      throw error;
    }
  },
};
