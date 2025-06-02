import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { z } from "zod";
import { InternalServerError } from "../../errors.ts";
import { WorkspaceMemory } from "../../memory/memory.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { AppContext, createTool, createToolFactory } from "../context.ts";

export interface KnowledgeBaseContext extends AppContext {
  name: string;
}
export const KNOWLEDGE_BASE_GROUP = "knowledge_base";
export const DEFAULT_KNOWLEDGE_BASE_NAME = "standard";
const createKnowledgeBaseTool = createToolFactory<
  KnowledgeBaseContext
>((c) => ({
  ...c,
  name: c.params.name ?? DEFAULT_KNOWLEDGE_BASE_NAME,
}), KNOWLEDGE_BASE_GROUP);

const openAIEmbedder = (apiKey: string) => {
  const openai = createOpenAI({
    apiKey,
  });
  return openai.embedding("text-embedding-3-small");
};

async function getVector(c: AppContext) {
  assertHasWorkspace(c);
  const mem = await WorkspaceMemory.create({
    workspace: c.workspace.value,
    tursoAdminToken: c.envVars.TURSO_ADMIN_TOKEN,
    tursoOrganization: c.envVars.TURSO_ORGANIZATION,
    tokenStorage: c.envVars.TURSO_GROUP_DATABASE_TOKEN,
    openAPIKey: c.envVars.OPENAI_API_KEY,
    discriminator: KNOWLEDGE_BASE_GROUP,
    options: { semanticRecall: true },
  });
  const vector = mem.vector;
  if (!vector) {
    throw new InternalServerError("Missing vector");
  }
  return vector;
}

const DEFAULT_DIMENSION = 1536;

export const listKnowledgeBases = createTool({
  name: "KNOWLEDGE_BASE_LIST",
  description: "List all knowledge bases",
  inputSchema: z.object({}),
  canAccess: canAccessWorkspaceResource,
  handler: async (_, c) => {
    const vector = await getVector(c);
    const names = await vector.listIndexes();
    // lazily create the default knowledge base
    if (!names.includes(DEFAULT_KNOWLEDGE_BASE_NAME)) {
      // create default knowledge base
      await createBase.handler({
        name: DEFAULT_KNOWLEDGE_BASE_NAME,
      });
      names.push(DEFAULT_KNOWLEDGE_BASE_NAME);
    }
    return { names };
  },
});

export const deleteBase = createTool({
  name: "KNOWLEDGE_BASE_DELETE",
  description: "Delete a knowledge base",
  inputSchema: z.object({
    name: z.string().describe("The name of the knowledge base"),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ name }, c) => {
    const vector = await getVector(c);
    await vector.deleteIndex({ indexName: name });
    return {
      name,
    };
  },
});
export const createBase = createTool({
  name: "KNOWLEDGE_BASE_CREATE",
  description: "Create a knowledge base",
  inputSchema: z.object({
    name: z.string()
      .regex(
        /^[a-z0-9-_]+$/,
        "Name can only contain lowercase letters, numbers, hyphens, and underscores",
      )
      .describe("The name of the knowledge base"),
    dimension: z.number().describe("The dimension of the knowledge base")
      .optional(),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ name, dimension }, c) => {
    const vector = await getVector(c);
    await vector.createIndex({
      indexName: name,
      dimension: dimension ?? DEFAULT_DIMENSION,
    });
    return { name, dimension };
  },
});

export const forget = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_FORGET",
  description: "Forget something",
  inputSchema: z.object({
    docId: z.string().describe("The id of the content to forget"),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ docId }, c) => {
    const vector = await getVector(c);
    await vector.deleteVector({ indexName: c.name, id: docId });
    return { docId };
  },
});

export const remember = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_REMEMBER",
  description: "Remember something",
  inputSchema: z.object({
    docId: z.string().optional().describe(
      "The id of the content being remembered",
    ),
    content: z.string().describe("The content to remember"),
    metadata: z.record(z.string(), z.string()).describe(
      "The metadata to remember",
    ).optional(),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ content, metadata, docId: _id }, c) => {
    if (!c.envVars.OPENAI_API_KEY) {
      throw new InternalServerError("Missing OPENAI_API_KEY");
    }

    const vector = await getVector(c);
    const docId = _id ?? crypto.randomUUID();
    const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);
    // Create embeddings using OpenAI
    const { embedding } = await embed({
      model: embedder,
      value: content,
    });
    await vector.upsert({
      indexName: c.name,
      vectors: [embedding],
      metadata: [{
        id: docId,
        metadata: { ...metadata ?? {}, content },
      }],
    });

    return { docId };
  },
});

export const search = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_SEARCH",
  description: "Search the knowledge base",
  inputSchema: z.object({
    query: z.string().describe("The query to search the knowledge base"),
    topK: z.number().describe("The number of results to return").optional(),
    content: z.boolean().describe("Whether to return the content").optional(),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ query, topK }, c) => {
    assertHasWorkspace(c);
    if (!c.envVars.OPENAI_API_KEY) {
      throw new InternalServerError("Missing OPENAI_API_KEY");
    }

    const vector = await getVector(c);

    const indexName = c.name;
    const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);
    const { embedding } = await embed({
      model: embedder,
      value: query,
    });

    return await vector.query({
      indexName,
      queryVector: embedding,
      topK: topK ?? 1,
    });
  },
});
