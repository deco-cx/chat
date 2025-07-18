import { z } from "zod";

/**
 * Schema for prompt validation
 */
export const PromptValidationSchema = z.object({
  id: z.string().describe("The prompt ID"),
  name: z.string().describe("The prompt name"),
  description: z.string().nullable().describe("The prompt description"),
  content: z.string().describe("The prompt content"),
  created_at: z.string().describe("The prompt creation date"),
  updated_at: z.string().nullable().describe("The prompt update date"),
  readonly: z.boolean().describe("Whether the prompt is readonly").optional(),
});

export type Prompt = z.infer<typeof PromptValidationSchema>;

export const PromptVersionValidationSchema = z.object({
  id: z.string().describe("The prompt version ID"),
  prompt_id: z.string().describe("The prompt ID"),
  content: z.string().describe("The prompt content"),
  created_at: z.string().describe("The prompt version creation date"),
  created_by: z
    .string()
    .nullable()
    .describe("The user ID who created the prompt version"),
  name: z.string().nullable().describe("The prompt version name"),
  version_name: z.string().nullable().describe("The prompt version name"),
});

export type PromptVersion = z.infer<typeof PromptVersionValidationSchema>;
