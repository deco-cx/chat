import { createOpenAI } from "@ai-sdk/openai";
import { embed } from "ai";
import { z } from "zod";
import { InternalServerError } from "../../errors.ts";
import { WorkspaceMemory } from "../../memory/memory.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import { type AppContext, createTool, createToolFactory } from "../context.ts";
import { FileProcessor } from "../file-processor.ts";
import { KNOWLEDGE_BASE_DIMENSION } from "../../constants.ts";

export interface KnowledgeBaseContext extends AppContext {
  name: string;
}
export const KNOWLEDGE_BASE_GROUP = "knowledge_base";
export const DEFAULT_KNOWLEDGE_BASE_NAME = "standard";
const createKnowledgeBaseTool = createToolFactory<
  WithTool<KnowledgeBaseContext>
>((c) =>
  ({
    ...c,
    name: c.params.name ?? DEFAULT_KNOWLEDGE_BASE_NAME,
  }) as unknown as WithTool<KnowledgeBaseContext>, KNOWLEDGE_BASE_GROUP);

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

export const listKnowledgeBases = createTool({
  name: "KNOWLEDGE_BASE_LIST",
  description: "List all knowledge bases",
  inputSchema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

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
  handler: async ({ name }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

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
  handler: async ({ name, dimension }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const vector = await getVector(c);
    await vector.createIndex({
      indexName: name,
      dimension: dimension ?? KNOWLEDGE_BASE_DIMENSION,
    });
    return { name, dimension };
  },
});

export const forget = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_FORGET",
  description: "Forget something",
  inputSchema: z.object({
    docIds: z.array(z.string()).describe(
      "The id of the content to forget",
    ),
  }),
  handler: async ({ docIds }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const vector = await getVector(c);
    await Promise.all(docIds.map(
      (docId) => vector.deleteVector({ indexName: c.name, id: docId }),
    ));
    return {
      docIds,
    };
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
  handler: async ({ content, metadata, docId: _id }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);
    if (!c.envVars.OPENAI_API_KEY) {
      throw new InternalServerError("Missing OPENAI_API_KEY");
    }

    const vector = await getVector(c);
    const docId = _id ?? crypto.randomUUID();
    const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);

    try {
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

      return {
        docId,
      };
    } catch (e) {
      console.log(e);
      throw e;
    }
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
  handler: async ({ query, topK }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const mem = await WorkspaceMemory.create({
      workspace: c.workspace.value,
      tursoAdminToken: c.envVars.TURSO_ADMIN_TOKEN,
      tursoOrganization: c.envVars.TURSO_ORGANIZATION,
      tokenStorage: c.envVars.TURSO_GROUP_DATABASE_TOKEN,
      discriminator: KNOWLEDGE_BASE_GROUP, // used to create a unique database for the knowledge base
    });
    const vector = mem.vector;

    if (!c.envVars.OPENAI_API_KEY) {
      throw new InternalServerError("Missing OPENAI_API_KEY");
    }

    const indexName = c.name;
    const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);
    const { embedding } = await embed({
      model: embedder,
      value: query,
    });

    return await vector?.query({
      indexName,
      queryVector: embedding,
      topK: topK ?? 1,
    }) ?? { results: [] };
  },
});

export const addFileToKnowledgeBase = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_ADD_FILE",
  description: "Add a file content into knowledge base",
  inputSchema: z.object({
    fileUrl: z.string(),
    path: z.string(),
    metadata: z.record(z.string(), z.union([z.string(), z.boolean()]))
      .optional(),
  }),
  handler: async (
    { fileUrl, metadata, path },
    c,
  ): Promise<{ docIds: string[] }> => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    const fileProcessor = new FileProcessor({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const proccessedFile = await fileProcessor.processFile(fileUrl);

    const fileMetadata = {
      ...metadata, // metadata has path that is used to get full file path
      ...proccessedFile.metadata,
      fileSize: proccessedFile.metadata.fileSize.toString(),
      chunkCount: proccessedFile.metadata.chunkCount.toString(),
    };

    const chunks = await Promise.all(
      proccessedFile.chunks.map((
        chunk: { text: string; metadata: Record<string, string> },
      ) =>
        remember.handler({
          content: chunk.text,
          metadata: {
            ...fileMetadata,
            ...chunk.metadata,
          },
        })
      ),
    );

    const docIds = chunks.map((chunk: { docId: string }) => chunk.docId);

    assertHasWorkspace(c);
    if (path) {
      await c.db.from("deco_chat_assets").update({
        metadata: {
          ...metadata,
          docIds,
        },
      }).eq("workspace", c.workspace.value).eq("file_url", path);
    }

    return { docIds };
  },
});
