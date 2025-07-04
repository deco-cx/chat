import { createOpenAI } from "@ai-sdk/openai";
import { embed, embedMany } from "ai";
import { z } from "zod";
import { basename } from "@std/path";
import { KNOWLEDGE_BASE_DIMENSION } from "../../constants.ts";
import { InternalServerError } from "../../errors.ts";
import { WorkspaceMemory } from "../../memory/memory.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  type WithTool,
} from "../assertions.ts";
import {
  type AppContext,
  createToolFactory,
  createToolGroup,
} from "../context.ts";
import { FileMetadataSchema, FileProcessor } from "../file-processor.ts";
import type { Json } from "../../storage/index.ts";

export interface KnowledgeBaseContext extends AppContext {
  name: string;
}
export const KNOWLEDGE_BASE_GROUP = "knowledge_base";
export const DEFAULT_KNOWLEDGE_BASE_NAME = "standard";

// Legacy schema for backward compatibility during migration
export const KnowledgeFileMetadataSchema = z.object({
  agentId: z.string().optional(),
}).merge(FileMetadataSchema);

const addFileDefaults = (file: {
  fileUrl: string;
  metadata: Json;
  path: string | null;
  docIds: string[] | null;
  filename: string | null;
}) => ({
  ...file,
  metadata: (file.metadata || {}) as z.infer<
    typeof KnowledgeFileMetadataSchema
  >,
  docIds: file.docIds || [],
  filename: file.filename ?? "",
  path: file.path ?? "",
});

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

async function batchUpsertVectorContent(
  items: Array<{
    content: string;
    metadata?: Record<string, unknown>;
    docId?: string;
  }>,
  c: WithTool<KnowledgeBaseContext>,
): Promise<string[]> {
  assertHasWorkspace(c);

  if (!c.envVars.OPENAI_API_KEY) {
    throw new InternalServerError("Missing OPENAI_API_KEY");
  }

  const vector = await getVector(c);
  const embedder = openAIEmbedder(c.envVars.OPENAI_API_KEY);

  try {
    // Generate docIds for items that don't have one
    const itemsWithIds = items.map((item) => ({
      ...item,
      docId: item.docId ?? crypto.randomUUID(),
    }));

    // Create embeddings for all items
    const { embeddings } = await embedMany({
      model: embedder,
      values: itemsWithIds.map((item) => item.content),
    });

    // Upsert all vectors at once
    return await vector.upsert({
      indexName: c.name,
      vectors: embeddings,
      metadata: itemsWithIds.map((item) => ({
        id: item.docId,
        metadata: { ...item.metadata ?? {}, content: item.content },
      })),
    });
  } catch (e) {
    console.error("Error embedding content", e);
    throw e;
  }
}

const createTool = createToolGroup("KnowledgeBaseManagement", {
  name: "Knowledge Base Management",
  description: "Delete, create and list knowledge bases.",
  icon:
    "https://assets.decocache.com/mcp/1b6e79a9-7830-459c-a1a6-ba83e7e58cbe/Knowledge-Base.png",
});

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
  handler: async ({ content, metadata, docId }, c) => {
    assertHasWorkspace(c);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const [resultDocId] = await batchUpsertVectorContent([{
      content,
      metadata,
      docId,
    }], c);

    return {
      docId: resultDocId,
    };
  },
});

export const search = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_SEARCH",
  description: "Search the knowledge base",
  inputSchema: z.object({
    query: z.string().describe("The query to search the knowledge base"),
    topK: z.number().describe("The number of results to return").optional(),
    content: z.boolean().describe("Whether to return the content").optional(),
    filter: z.record(z.string(), z.any()).describe(
      `Filters to match against document metadata and narrow search results. Supports MongoDB-style query operators:
        comparison ($eq, $ne, $gt, $gte, $lt, $lte), array ($in, $nin), logical ($and, $or), and existence ($exists).
        Only returns documents whose metadata matches the specified filter conditions.
        Examples:
        { "metadata": {{"category": "documents"}},
        { "metadata": {{"priority": {"$gte": 3}}},
        { "metadata": {{"status": {"$in": ["active", "pending"]}}},
        { "metadata": {{"$and": [{"type": "pdf"}, {"size": {"$lt": 1000}}]}}}`,
    ).optional(),
  }),
  handler: async ({ query, topK, filter }, c) => {
    assertHasWorkspace(c);
    if (!c.envVars.OPENAI_API_KEY) {
      throw new InternalServerError("Missing OPENAI_API_KEY");
    }

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const vector = await getVector(c);

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
      filter,
    }) ?? { results: [] };
  },
});

export const addFile = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_ADD_FILE",
  description: "Add a file content into knowledge base",
  inputSchema: z.object({
    fileUrl: z.string(),
    path: z.string().describe(
      "File path from file added using workspace fs_write tool",
    ).optional(),
    filename: z.string().describe("The name of the file").optional(),
    metadata: z.record(z.string(), z.union([z.string(), z.boolean()]))
      .optional(),
  }),
  handler: async (
    { fileUrl, metadata: _metadata, path, filename },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    const fileProcessor = new FileProcessor({
      chunkSize: 500,
      chunkOverlap: 50,
    });

    const proccessedFile = await fileProcessor.processFile(fileUrl);

    const fileMetadata = {
      ..._metadata,
      ...proccessedFile.metadata,
      fileSize: proccessedFile.metadata.fileSize,
      chunkCount: proccessedFile.metadata.chunkCount,
    };

    const contentItems = proccessedFile.chunks.map((
      chunk: { text: string; metadata: Record<string, string> },
      idx,
    ) => ({
      content: chunk.text,
      metadata: {
        ...fileMetadata,
        ...chunk.metadata,
        chunkIndex: idx,
        fileUrl: fileUrl,
        path: path,
      },
    }));

    const docIds = await batchUpsertVectorContent(contentItems, c);

    assertHasWorkspace(c);

    // Add fallback logic for filename
    const finalFilename = filename ??
      (path ? basename(path) : undefined) ??
      fileUrl;

    const { data: newFile, error } = await c.db.from("deco_chat_assets").upsert(
      {
        file_url: fileUrl,
        workspace: c.workspace.value,
        index_name: c.name,
        path,
        doc_ids: docIds,
        filename: finalFilename,
        metadata: fileMetadata,
      },
    ).select("fileUrl:file_url, metadata, path, docIds:doc_ids, filename")
      .single();

    if (!newFile || error) {
      throw new InternalServerError("Failed to update file metadata");
    }

    return addFileDefaults(newFile);
  },
});

export const listFiles = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_LIST_FILES",
  description: "List all files in the knowledge base",
  inputSchema: z.object({}),
  handler: async (
    _,
    c,
  ) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    assertHasWorkspace(c);

    const { data: files } = await c.db.from("deco_chat_assets")
      .select(
        "fileUrl:file_url, metadata, path, docIds:doc_ids, filename",
      ).eq("workspace", c.workspace.value)
      .eq("index_name", c.name);

    return files?.map(addFileDefaults) ?? [];
  },
});

export const deleteFile = createKnowledgeBaseTool({
  name: "KNOWLEDGE_BASE_DELETE_FILE",
  description: "Delete a file from the knowledge base",
  inputSchema: z.object({
    fileUrl: z.string(),
  }),
  handler: async (
    { fileUrl },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c.tool.name, c);
    assertHasWorkspace(c);

    const { data: file } = await c.db.from("deco_chat_assets")
      .select(
        "file_url, metadata, doc_ids",
      ).eq("workspace", c.workspace.value)
      .eq("file_url", fileUrl)
      .single();

    const docIds = file?.doc_ids;

    if (!docIds) {
      return {};
    }

    await forget.handler({ docIds });
    const { error } = await c.db.from("deco_chat_assets").delete().eq(
      "file_url",
      fileUrl,
    );

    if (error) {
      throw new InternalServerError(
        "Failed to delete file from knowledge base",
      );
    }

    return { file, docIds };
  },
});
