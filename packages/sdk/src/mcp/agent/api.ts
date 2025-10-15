import { Agent } from "@deco/ai";
import { z } from "zod";
import { doRetryable } from "../../do-commons.ts";
import { baseMessageSchema } from "../ai/api.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createToolFactory } from "../context.ts";

export interface AgentContext extends AppContext {
  agent: string;
}

const createAgentTool = createToolFactory<WithTool<AgentContext>>(
  (c) =>
    ({
      ...c,
      agent: c.params.agentId ?? "teamAgent",
    }) as unknown as WithTool<AgentContext>,
  undefined,
  undefined,
  doRetryable,
);

// Zod schema for agent generation options (used for runtime validation in API)
const AgentGenerateOptionsSchema = z.object({
  instructions: z.string().optional(),
  model: z.string().optional(),
  tools: z.record(z.string(), z.array(z.string())).optional(),
  bypassOpenRouter: z.boolean().optional(),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  enableSemanticRecall: z.boolean().optional(),
  maxSteps: z.number().optional(),
});

const AgentGenerateTextInputSchema = z.object({
  message: z
    .union([z.string(), baseMessageSchema])
    .describe("The message to send to the agent"),
  options: AgentGenerateOptionsSchema.optional().nullable(),
});

const AgentGenerateTextOutputSchema = z.object({
  text: z.string().optional().describe("The text output from the agent"),
});

export const agentGenerateText = createAgentTool({
  name: "AGENT_GENERATE_TEXT",
  description: "Generate text output using an agent",
  inputSchema: AgentGenerateTextInputSchema,
  outputSchema: AgentGenerateTextOutputSchema,
  handler: async ({ message }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const agentStub = c
      .stub(Agent)
      .new(`${c.workspace.value}/Agents/${c.agent}`);

    const asMessageArray = Array.isArray(message)
      ? message
      : [{ role: "user" as const, content: message }];

    const asMessage = asMessageArray.map((m) => ({
      ...m,
      parts: [
        {
          type: "text" as const,
          text: m.content,
        },
      ],
      id: m.id ?? crypto.randomUUID(),
    }));

    const response = await agentStub.generate(asMessage);

    const text =
      typeof response.text == "string"
        ? response.text
        : (
            response.steps.find((step) => step.finishReason === "stop")
              ?.content[0] as { text: string }
          )?.text;

    return {
      text,
    };
  },
});

const AgentGenerateObjectInputSchema = z.object({
  message: z
    .union([z.string(), baseMessageSchema])
    .describe("The message to send to the agent"),
  schema: z
    .any()
    .describe(
      "The JSON schema to use for a structured response. If provided, the response will be an object.",
    ),
});

const AgentGenerateObjectOutputSchema = z.object({
  object: z.any().describe("The object output from the agent"),
});

export const agentGenerateObject = createAgentTool({
  name: "AGENT_GENERATE_OBJECT",
  description: "Generate an object using an agent",
  inputSchema: AgentGenerateObjectInputSchema,
  outputSchema: AgentGenerateObjectOutputSchema,
  handler: async ({ message, schema }, c) => {
    assertHasWorkspace(c);
    await assertWorkspaceResourceAccess(c);

    const agentStub = c
      .stub(Agent)
      .new(`${c.workspace.value}/Agents/${c.agent}`);

    const asMessageArray = Array.isArray(message)
      ? message
      : [{ role: "user" as const, content: message }];

    const asMessage = asMessageArray.map((m) => ({
      ...m,
      parts: [
        {
          type: "text" as const,
          text: m.content,
        },
      ],
      id: m.id ?? crypto.randomUUID(),
    }));

    const response = await agentStub.generateObject(asMessage, schema);

    return response;
  },
});

const TranscribeAudioInputSchema = z.object({
  audioUrl: z
    .string()
    .describe(
      "URL to the audio file to transcribe (supports mp3, wav, m4a, etc.)",
    ),
});

const TranscribeAudioOutputSchema = z.object({
  transcription: z.string().describe("The transcribed text from the audio"),
  success: z.boolean().describe("Whether the transcription was successful"),
  message: z.string().describe("Status message about the transcription"),
});

export const agentListen = createAgentTool({
  name: "AGENT_LISTEN",
  description:
    "Transcribe audio content to text using OpenAI's Whisper model. " +
    "This tool accepts a URL to an audio file and returns the transcribed text. " +
    "Supports common audio formats like mp3, wav, m4a, and more. " +
    "Perfect for converting voice messages, audio recordings, or any audio content into readable text. " +
    "Maximum file size is 25MB. Use this when you need to process audio files, transcribe voice messages, " +
    "or convert speech to text for further processing. This tool is only available if the agent has voice transcription capabilities.",
  inputSchema: TranscribeAudioInputSchema,
  outputSchema: TranscribeAudioOutputSchema,
  handler: async ({ audioUrl }, c) => {
    try {
      assertHasWorkspace(c);
      await assertWorkspaceResourceAccess(c);

      if (!audioUrl) {
        return {
          transcription: "",
          success: false,
          message: "Invalid audio data: audioUrl must be a non-empty string",
        };
      }

      const response = await fetch(audioUrl);

      if (response.status === 403) {
        return {
          transcription: "",
          success: false,
          message: "Forbidden: Access to the audio file is denied",
        };
      }

      if (response.status === 404) {
        return {
          transcription: "",
          success: false,
          message: "Not Found: Audio file not found",
        };
      }

      if (response.status === 401) {
        return {
          transcription: "",
          success: false,
          message: "Unauthorized: Access to the audio file is denied",
        };
      }

      if (!response.ok) {
        return {
          transcription: "",
          success: false,
          message: `Failed to fetch audio file: ${response.statusText}`,
        };
      }

      // Check content type to ensure it's not HTML or other non-audio content
      const contentType =
        response.headers.get("content-type")?.toLowerCase() || "";
      if (
        contentType.includes("text/html") ||
        contentType.includes("application/json") ||
        contentType.includes("text/plain")
      ) {
        return {
          transcription: "",
          success: false,
          message:
            "Invalid content: The URL returned a web page instead of an audio file. The file may be private or require authentication.",
        };
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBufferUint8Array = new Uint8Array(audioBuffer);

      const agentStub = c
        .stub(Agent)
        .new(`${c.workspace.value}/Agents/${c.agent}`);

      const transcription = await agentStub.listen(audioBufferUint8Array);

      if (!transcription) {
        return {
          transcription: "",
          success: false,
          message: "Failed to transcribe audio",
        };
      }

      return {
        transcription,
        success: true,
        message: `Successfully transcribed audio (${Math.round(
          (audioBufferUint8Array.length * 0.75) / 1024,
        )}KB)`,
      };
    } catch (error) {
      console.error("💥 Error in TRANSCRIBE_AUDIO tool:", error);

      let errorMessage = "Failed to transcribe audio";
      if (error instanceof Error) {
        if (error.message.includes("exceeds the maximum")) {
          errorMessage = "Audio file too large (maximum 25MB allowed)";
        } else if (error.message.includes("Invalid audio")) {
          errorMessage = "Invalid audio format or corrupted audio data";
        } else if (error.message.includes("Invalid file format")) {
          errorMessage =
            "Invalid file format: The file may be corrupted, protected, or not a supported audio format";
        } else {
          errorMessage = `Transcription failed: ${error.message}`;
        }
      }

      return {
        transcription: "",
        success: false,
        message: errorMessage,
      };
    }
  },
});
