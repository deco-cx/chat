import { z } from "zod";

// Simplified Workflow Input Schema
export const WorkflowInputSchema = z.object({
  fileUrl: z.string(),
  path: z.string().describe(
    "File path from file added using workspace fs_write tool",
  ).optional(),
  filename: z.string().describe("The name of the file").optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.boolean()]))
    .optional(),
  workspace: z.string(),
  knowledgeBaseName: z.string(),
});

// Workflow Output Schema
export const WorkflowOutputSchema = z.object({
  hasMore: z.boolean(),
  batchPage: z.number(),
  totalPages: z.number(),
});

export type WorkflowInput = z.infer<typeof WorkflowInputSchema>;
export type WorkflowOutput = z.infer<typeof WorkflowOutputSchema>;