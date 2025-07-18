import type { Agent as MastraAgent } from "@mastra/core/agent";
import type { Message } from "ai";
import type { Message as AIMessage } from "../types.ts";
import { isAudioMessage, transcribeBase64Audio } from "./audio.ts";

export async function convertToAIMessage({
  message,
  agent,
}: {
  message: AIMessage;
  agent?: MastraAgent;
}): Promise<Message> {
  if (isAudioMessage(message)) {
    if (!agent) {
      throw new Error("Agent is required for audio messages");
    }
    const transcription = await transcribeBase64Audio({
      audio: message.audioBase64,
      agent,
    });

    return {
      role: "user",
      id: crypto.randomUUID(),
      content: transcription,
    };
  }
  return message;
}
