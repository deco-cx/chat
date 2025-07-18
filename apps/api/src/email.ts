import { EmailMessage } from "cloudflare:email";
import { processDataStream } from "@ai-sdk/ui-utils";
import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import type { ActorConstructor, StubFactory } from "@deco/actors";
import { ActorCfRuntime } from "@deco/actors/cf";
import { actors } from "@deco/actors/proxy";
import { AIAgent } from "@deco/ai/actors";
import { DECO_BOTS_DOMAIN } from "@deco/sdk/constants";
import { contextStorage } from "@deco/sdk/fetch";
import { getServerClient } from "@deco/sdk/storage";
// @ts-ignore: this is an import from cf
import { createMimeMessage } from "mimetext";
// Add postal-mime import at the top
import PostalMime from "postal-mime";
import { runtime } from "./middlewares/actors.ts";
import type { Bindings } from "./utils/context.ts";

const readContent = async (message: ForwardableEmailMessage) => {
  // Parse the MIME message to extract structured content
  // biome-ignore lint/suspicious/noExplicitAny: fixing in the future.
  const email = await PostalMime.parse(message.raw as any);

  // Return the text content, fallback to HTML if text is not available
  return email.text || email.html || "";
};
export function email(
  message: ForwardableEmailMessage,
  env: Bindings,
  ctx: ExecutionContext,
) {
  return contextStorage.run({ env, ctx }, async () => {
    const db = getServerClient(env.SUPABASE_URL, env.SUPABASE_SERVER_TOKEN);
    const stub: <Constructor extends ActorConstructor<AIAgent>>(
      c: Constructor,
    ) => StubFactory<InstanceType<Constructor>> = (c) => {
      return runtime instanceof ActorCfRuntime
        ? // biome-ignore lint/suspicious/noExplicitAny: fixing in the future.
          runtime.stub(c, env as any)
        : actors.stub(c.name);
    };
    const originalMessageId = message.headers.get("Message-ID");

    if (!originalMessageId) {
      throw new Error("Original message has no Message-ID");
    }

    const msg = createMimeMessage();

    // Required headers for threading
    const newMessageId = `<${crypto.randomUUID()}@${DECO_BOTS_DOMAIN}>`;
    msg.setHeader("Message-ID", newMessageId);
    msg.setHeader("In-Reply-To", originalMessageId);

    // Build References header with the complete thread chain
    const existingReferences = message.headers.get("References");
    let referencesHeader = "";

    if (existingReferences) {
      // If there are existing references, append the current message ID
      referencesHeader = `${existingReferences.trim()} ${originalMessageId}`;
    } else {
      // If no existing references, just use the original message ID
      referencesHeader = originalMessageId;
    }

    msg.setHeader("References", referencesHeader);

    // From and To
    // ... existing code ...
    const originalSubject = message.headers.get("Subject") || "";

    // Create proper threaded subject
    let replySubject = originalSubject;
    if (!originalSubject.toLowerCase().startsWith("re:")) {
      replySubject = `Re: ${originalSubject}`;
    }

    // From and To
    msg.setSender(message.to);
    msg.setRecipient(message.from);
    const cc = message.headers.get("Cc");
    // @ts-expect-error - this exists
    cc && msg.setCc(message.cc);
    msg.setSubject(replySubject); // Use the threaded subject instead of generic text

    const targetEmail = message.to;
    const { data, error } = await db
      .from("deco_chat_channels")
      .select("*, deco_chat_agents(id)")
      .eq("discriminator", targetEmail)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const firstAgent = data.deco_chat_agents[0];
    if (!firstAgent) {
      throw new Error("No agent found");
    }

    const agent = stub(AIAgent).new(
      `${data.workspace}/Agents/${firstAgent.id}`,
    );

    const stream = await agent.stream(
      [
        {
          id: crypto.randomUUID(),
          role: "user",
          content: await readContent(message),
        },
      ],
      {
        threadId: originalMessageId,
        resourceId: originalMessageId,
      },
    );

    if (!stream.body) {
      throw new Error("No stream body");
    }

    let text = "";
    await processDataStream({
      stream: stream.body,
      onTextPart: (part) => {
        text += part;
      },
      onFinishMessagePart: async () => {
        msg.addMessage({
          contentType: "text/plain",
          data: text,
        });
        const replyMessage = new EmailMessage(
          message.to,
          message.from,
          msg.asRaw(),
        );
        await message.reply(replyMessage);
      },
    });
  });
}
