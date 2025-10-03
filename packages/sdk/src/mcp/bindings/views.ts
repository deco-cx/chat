import { ViewsListOutputSchema } from "@deco/workers-runtime/views";
import { z } from "zod/v3";
import type { Binder } from "../index.ts";

export const VIEW_BINDING_SCHEMA = [
  {
    name: "DECO_CHAT_VIEWS_LIST" as const,
    inputSchema: z.any(),
    outputSchema: ViewsListOutputSchema,
  },
] as const satisfies Binder;

// Re-export for existing imports expecting listViewsSchema
export const listViewsSchema = ViewsListOutputSchema;
