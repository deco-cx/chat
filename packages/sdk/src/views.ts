import { z } from "zod";

export const DEFAULT_VIEWS: View[] = [
  {
    id: "connections",
    title: "MCPs",
    icon: "linked_services",
    type: "default",
    metadata: {
      path: "/connections",
    },
  },
  {
    id: "agents",
    title: "Agents",
    icon: "robot_2",
    type: "default",
    metadata: {
      path: "/agents",
    },
  },
  {
    id: "workflows",
    title: "Workflows",
    icon: "flowchart",
    type: "default",
    metadata: {
      path: "/workflows",
    },
  },
  {
    id: "triggers",
    title: "Triggers",
    icon: "cable",
    type: "default",
    metadata: {
      path: "/triggers",
    },
  },
  {
    id: "prompts",
    title: "Prompts",
    icon: "local_library",
    type: "default",
    metadata: {
      path: "/prompts",
    },
  },
  {
    id: "monitor",
    title: "Monitor",
    icon: "monitoring",
    type: "default",
    metadata: {
      path: "/monitor",
    },
  },
];

export const viewMetadataSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("custom"),
    url: z.string(),
  }),
  z.object({
    type: z.literal("default"),
    path: z.string(),
  }),
]);

export interface View {
  id: string;
  title: string;
  icon: string;
  type: "custom" | "default";
  metadata: Record<string, unknown>;
}

export type ViewMetadata = z.infer<typeof viewMetadataSchema>;

/**
 * Add default views to the list of views.
 * Using only on the client side for now, but i believe we
 * will eventually move all the views to the server side.
 */
export const withDefaultViews = (views: View[]): View[] => {
  return [...DEFAULT_VIEWS, ...views];
};

export const parseViewMetadata = (view: View): ViewMetadata | null => {
  const result = viewMetadataSchema.safeParse({
    type: view.type,
    ...view.metadata,
  });

  if (!result.success) {
    return null;
  }

  return result.data;
};
