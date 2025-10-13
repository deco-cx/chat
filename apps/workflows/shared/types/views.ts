/**
 * Custom Views System
 *
 * JSON-to-JSX declarative views for tool inputs and outputs
 */

import { z } from "zod";

// View Style options
export const ViewStyleSchema = z.object({
  variant: z
    .enum(["primary", "secondary", "success", "warning", "error", "info"])
    .optional(),
  size: z.enum(["sm", "md", "lg"]).optional(),
  layout: z.enum(["vertical", "horizontal", "grid"]).optional(),
  gap: z.number().min(0).max(8).optional(),
  padding: z.number().min(0).max(8).optional(),
  border: z.boolean().optional(),
  rounded: z.boolean().optional(),
});

export type ViewStyle = z.infer<typeof ViewStyleSchema>;

// View Definition (recursive)
export const ViewDefinitionSchema: z.ZodType<ViewDefinition> = z.lazy(() =>
  z.object({
    type: z.enum([
      "container",
      "text",
      "heading",
      "card",
      "table",
      "list",
      "badge",
      "button",
      "input",
      "select",
      "file-upload",
      "code",
      "divider",
    ]),
    props: z.record(z.unknown()).optional(),
    children: z.array(z.union([ViewDefinitionSchema, z.string()])).optional(),
    data: z.string().optional(), // path to data (supports @refs)
    style: ViewStyleSchema.optional(),
  }),
);

export type ViewDefinition = {
  type:
    | "container"
    | "text"
    | "heading"
    | "card"
    | "table"
    | "list"
    | "badge"
    | "button"
    | "input"
    | "select"
    | "file-upload"
    | "code"
    | "divider";
  props?: Record<string, unknown>;
  children?: (ViewDefinition | string)[];
  data?: string; // path para dados (ex: "result.title", "@step1.output.name")
  style?: ViewStyle;
};

// Example view definitions for documentation
export const EXAMPLE_OUTPUT_VIEW: ViewDefinition = {
  type: "container",
  style: { layout: "vertical", gap: 4 },
  children: [
    {
      type: "heading",
      props: { level: 2 },
      data: "title",
    },
    {
      type: "card",
      style: { variant: "primary" },
      children: [
        {
          type: "text",
          data: "description",
        },
        {
          type: "badge",
          style: { variant: "success" },
          data: "status",
        },
      ],
    },
  ],
};

export const EXAMPLE_INPUT_VIEW: ViewDefinition = {
  type: "container",
  style: { layout: "vertical", gap: 4 },
  children: [
    {
      type: "heading",
      props: { level: 3 },
      children: ["Enter Information"],
    },
    {
      type: "input",
      props: {
        name: "title",
        label: "Title",
        placeholder: "Enter title",
        type: "text",
      },
    },
    {
      type: "select",
      props: {
        name: "status",
        label: "Status",
        options: [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ],
      },
    },
    {
      type: "button",
      props: {
        label: "Submit",
        action: "submit",
      },
      style: { variant: "primary" },
    },
  ],
};
