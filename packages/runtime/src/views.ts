import { z } from "zod/v3";

// New, richer schema with backward-compat fields kept optional
export const ViewsListOutputSchema = z.object({
  views: z.array(
    z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      icon: z.string(),
      url: z.string().optional(),
      // New acceptance rules
      mimeTypePattern: z.string().optional(),
      resourceName: z.string().optional(),
      // Legacy/compat fields
      tools: z.array(z.string()).optional().default([]),
      rules: z.array(z.string()).optional().default([]),
    }),
  ),
});

export type ViewsListOutput = z.infer<typeof ViewsListOutputSchema>;
