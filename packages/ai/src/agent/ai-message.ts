import type { Agent as MastraAgent } from "@mastra/core/agent";
import {
  type ModelMessage,
  UIMessage,
  convertToModelMessages as convertToModelMessagesAISDK,
} from "ai";
import { isAudioMessage, transcribeBase64Audio } from "./audio.ts";

export const convertToModelMessages =
  (agent?: MastraAgent) => async (message: UIMessage) => {
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
      } as ModelMessage;
    }

    return convertToModelMessagesAISDK([message])[0];
  };
