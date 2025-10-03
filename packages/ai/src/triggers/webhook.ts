import { AIAgent } from "../agent.ts";
import type { Message, MessageMetadata, StreamOptions } from "../types.ts";

import type { TriggerData } from "./services.ts";

import { UIMessage } from "ai";
import type { TriggerHooks } from "./trigger.ts";

export interface WebhookArgs {
  threadId?: string;
  resourceId?: string;
  messages: Message[];
}

const isAIMessage = (m: unknown | Message): m is Message => {
  return (
    typeof m === "object" &&
    m !== null &&
    "role" in m &&
    ("content" in m || "audioBase64" in m) &&
    "id" in m &&
    typeof m.id === "string" &&
    typeof m.role === "string"
  );
};

const isAIMessages = (m: unknown | Message[]): m is Message[] => {
  return Array.isArray(m) && m.every(isAIMessage);
};

const threadOf = (
  data: TriggerData,
  params: Record<string, string>,
): { threadId: string | undefined; resourceId: string | undefined } => {
  const resourceId = params.resourceId ?? data.id;
  const threadId = params.threadId ?? crypto.randomUUID(); // generate a random threadId if resourceId exists.
  return { threadId, resourceId };
};

const parseOptions: {
  [key in keyof StreamOptions]?: (
    val: string | null | undefined,
  ) => StreamOptions[key];
} = {
  bypassOpenRouter: (val) => val === "true",
  sendReasoning: (val) => val === "true",
  enableSemanticRecall: (val) => val === "true",
};

export const hooks: TriggerHooks<TriggerData & { type: "webhook" }> = {
  type: "webhook",
  onCreated: (data, trigger) => {
    const metadata = trigger.metadata ?? {};
    trigger.metadata = metadata;
    metadata.params ??= {};
    if (data.passphrase) {
      metadata.params.passphrase = data.passphrase;
    }
    return Promise.resolve();
  },
  run: async (data, trigger, args) => {
    if (
      data.passphrase &&
      data.passphrase !== trigger.metadata?.params?.passphrase
    ) {
      return {
        error: "Invalid passphrase",
      };
    }

    if ("callTool" in data) {
      return await trigger._callTool(
        data.callTool,
        typeof args === "object"
          ? ((args as Record<string, unknown>) ?? {})
          : {},
      );
    }

    const useStream = trigger.metadata?.params?.stream === "true";
    const options: StreamOptions = {};

    for (const _key in parseOptions) {
      const key = _key as keyof typeof parseOptions;
      const val = trigger.metadata?.params?.[key];
      const parser = parseOptions[key];
      if (val && key && parser) {
        // deno-lint-ignore no-explicit-any
        options[key] = parser(val) as any;
      }
    }

    const { threadId, resourceId } = threadOf(
      data,
      trigger.metadata?.params ?? {},
    );

    const agent = trigger.state
      .stub(AIAgent)
      .new(trigger.agentId)
      .withMetadata({ threadId, resourceId });

    const messagesFromArgs =
      args &&
      typeof args === "object" &&
      "messages" in args &&
      isAIMessages(args.messages)
        ? args.messages.map(
            (message) =>
              ({
                ...message,
                id: crypto.randomUUID(),
                parts:
                  "parts" in message
                    ? message.parts
                    : [
                        {
                          type: "text" as const,
                          text: "content" in message ? message.content : "",
                        },
                      ],
              }) as UIMessage<MessageMetadata>,
          )
        : undefined;

    const messages = messagesFromArgs ?? [
      {
        id: crypto.randomUUID(),
        role: "user" as const,
        parts: [
          {
            type: "text" as const,
            text: `the webhook is triggered with the following messages:`,
          },
        ],
      },
      ...(args
        ? [
            {
              id: crypto.randomUUID(),
              role: "user" as const,
              parts: [
                {
                  type: "text" as const,
                  text: `\`\`\`json\n${JSON.stringify(args)}\`\`\``,
                },
              ],
            },
          ]
        : []),
    ];

    const schema =
      "schema" in data && data.schema
        ? data.schema
        : typeof args === "object" &&
            args !== null &&
            "schema" in args &&
            typeof args.schema === "object"
          ? args.schema
          : undefined;
    if (schema) {
      return await agent.generateObject(messages, schema).then((r) => r.object);
    }

    return useStream
      ? await agent.stream(messages, trigger.metadata?.params)
      : await agent.generate(messages, trigger.metadata?.params);
  },
};
