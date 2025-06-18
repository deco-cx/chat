import { z } from "zod";
import { resolveMentions as resolveMentionsFn } from "../../utils/prompt-mentions.ts";
import { assertHasWorkspace } from "../assertions.ts";
import { createTool } from "../context.ts";

export const createPrompt = createTool({
  name: "PROMPTS_CREATE",
  description: "Create a new prompt",
  inputSchema: z.object({
    name: z.string(),
    description: z.string().optional(),
    content: z.string(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    c.resourceAccess.grant();

    // await assertWorkspaceResourceAccess(c.tool.name, c);

    const { name, description, content } = props;

    const { data, error } = await c
      .db
      .from("deco_chat_prompts")
      .insert({
        workspace,
        name,
        content,
        description,
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  },
});

export const updatePrompt = createTool({
  name: "PROMPTS_UPDATE",
  description: "Update an existing prompt",
  inputSchema: z.object({
    id: z.string(),
    data: z.object({
      name: z.string().optional(),
      description: z.string().optional().nullable(),
      content: z.string().optional(),
    }),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    c.resourceAccess.grant();

    // await assertWorkspaceResourceAccess(c.tool.name, c);

    const { id, data } = props;

    const { data: prompt, error } = await c.db
      .from("deco_chat_prompts")
      .update(data)
      .eq("id", id)
      .eq("workspace", workspace)
      .select("*")
      .single();

    if (error) throw error;

    return prompt;
  },
});

export const deletePrompt = createTool({
  name: "PROMPTS_DELETE",
  description: "Delete a prompt by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

    c.resourceAccess.grant();

    // await assertWorkspaceResourceAccess(c.tool.name, c);

    const { error } = await c.db
      .from("deco_chat_prompts")
      .delete()
      .eq("id", id)
      .eq("workspace", workspace);

    if (error) throw error;

    return { success: true };
  },
});

export const listPrompts = createTool({
  name: "PROMPTS_LIST",
  description: "List prompts for the current workspace",
  inputSchema: z.object({
    ids: z.array(z.string()).optional().describe("Filter prompts by ids"),
    resolveMentions: z.boolean().optional().describe(
      "Resolve mentions in the prompts",
    ),
    excludeIds: z.array(z.string()).optional().describe(
      "Exclude prompts by ids",
    ),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    c.resourceAccess.grant();

    // await assertWorkspaceResourceAccess(c.tool.name, c);

    const { ids = [], resolveMentions = false, excludeIds = [] } = props;

    let query = c.db
      .from("deco_chat_prompts")
      .select("*")
      .eq("workspace", workspace);

    if (ids.length > 0) {
      query = query.in("id", ids);
    }

    console.log("excludeIds", excludeIds);

    if (excludeIds.length > 0) {
      query = query.not("id", "in", `(${excludeIds.join(",")})`);
    }

    const { data, error } = await query;

    if (error) throw error;

    if (resolveMentions) {
      const resolvedPrompts = await Promise.allSettled(
        data.map((prompt) => resolveMentionsFn(prompt.content, workspace)),
      );

      return data.map((prompt, index) => ({
        ...prompt,
        content: resolvedPrompts[index].status === "fulfilled"
          ? resolvedPrompts[index].value
          : prompt.content,
      }));
    }

    return data;
  },
});

export const getPrompt = createTool({
  name: "PROMPTS_GET",
  description: "Get a prompt by id",
  inputSchema: z.object({
    id: z.string(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;
    const { id } = props;

    c.resourceAccess.grant();

    // await assertWorkspaceResourceAccess(c.tool.name, c);

    const { data, error } = await c.db
      .from("deco_chat_prompts")
      .select("*")
      .eq("id", id)
      .eq("workspace", workspace)
      .single();

    if (error) throw error;

    return data;
  },
});

export const searchPrompts = createTool({
  name: "PROMPTS_SEARCH",
  description: "Search for prompts",
  inputSchema: z.object({
    query: z.string(),
    limit: z.number().optional(),
    offset: z.number().optional(),
  }),
  handler: async (props, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    c.resourceAccess.grant();

    // await assertWorkspaceResourceAccess(c.tool.name, c);

    const { query, limit = 10, offset = 0 } = props;

    const { data, error } = await c.db
      .from("deco_chat_prompts")
      .select("*")
      .eq("workspace", workspace)
      .textSearch("name", query)
      .range(offset * limit, (offset + 1) * limit);

    if (error) throw error;

    return data;
  },
});
