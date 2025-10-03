import { z } from "zod/v3";

export const DEFAULT_VIEWS: View[] = [
  {
    id: "apps",
    title: "Apps",
    icon: "linked_services",
    type: "default",
    metadata: {
      path: "/apps",
    },
  },
  {
    id: "tools",
    title: "Tools",
    icon: "build",
    type: "default",
    badge: "New",
    metadata: {
      path: "/tools",
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
    id: "views",
    title: "Views",
    icon: "dashboard",
    type: "default",
    metadata: {
      path: "/views",
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
    id: "workflow-runs",
    title: "Workflow Runs",
    icon: "play_arrow",
    type: "default",
    metadata: {
      path: "/workflow-runs",
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
    id: "activity",
    title: "Activity",
    icon: "forum",
    type: "default",
    metadata: {
      path: "/activity",
    },
  },
];

export const viewMetadataSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("custom"),
    // Custom views can either directly provide a URL or reference an integration view by name
    url: z.string().optional(),
    tools: z.array(z.string()).default([]),
    rules: z.array(z.string()).default([]),
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
  // For custom views pinned in teams
  integrationId?: string;
  name?: string;
  // Optional badge to display in menu
  badge?: string;
  // For default views only
  metadata?: {
    path: string;
    url?: string;
  };
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
