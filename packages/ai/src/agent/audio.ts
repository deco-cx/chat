import type { AudioMessage, Message } from "../types.ts";
import { Buffer } from "node:buffer";
import type { Agent as MastraAgent } from "@mastra/core/agent";
import { OpenAIVoice } from "@mastra/voice-openai";

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB

export function isAudioMessage(message: Message): message is AudioMessage {
  return "audioBase64" in message && typeof message.audioBase64 === "string";
}

/**
 * Get the audio transcription of the given audio base64
 * @param audio - The audio stream to get the transcription of
 * @param agent - The agent to use to get the transcription
 * @returns The transcription of the audio stream
 */
export async function transcribeBase64Audio({
  audio,
  agent,
}: {
  audio: string;
  agent: MastraAgent;
}): Promise<string> {
  const buffer = Buffer.from(audio, "base64");
  if (buffer.length > MAX_AUDIO_SIZE) {
    throw new Error("Audio size exceeds the maximum allowed size");
  }

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(buffer));
      controller.close();
    },
  });

  // deno-lint-ignore no-explicit-any
  const transcription = await agent.voice.listen(stream as any);
  return transcription as string;
}

const DEFAULT_TEXT_TO_SPEECH_MODEL = "tts-1";
const DEFAULT_SPEECH_TO_TEXT_MODEL = "whisper-1";

export function createAgentOpenAIVoice({ apiKey }: { apiKey: string }) {
  return new OpenAIVoice({
    listeningModel: {
      apiKey,
      name: DEFAULT_SPEECH_TO_TEXT_MODEL,
    },
    speechModel: {
      apiKey,
      name: DEFAULT_TEXT_TO_SPEECH_MODEL,
    },
  });
}
