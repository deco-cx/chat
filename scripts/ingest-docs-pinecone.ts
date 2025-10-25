// ingest-docs-pinecone.ts
// Reindex EVERYTHING from the DOCS_DIR directory into a Pinecone index with integrated embedding.
// - Chunking: LangChain RecursiveCharacterTextSplitter
// - Embedding: Pinecone automatically generates via integrated embedding
// - Upsert: uses upsertRecords() sending text + metadata
//
// ENV obrigatórios:
//   PINECONE_API_KEY
//   PINECONE_INDEX_NAME 
// Optional ENV:
//   NAMESPACE=docs
//   DOCS_DIR=docs
//   EXTENSIONS=.md,.mdx,.txt
//   MAX_FILE_MB=2
//   CHUNK_SIZE=2800
//   CHUNK_OVERLAP=300
//   BATCH_SIZE=500
//   DELETE_ALL=false    
//
// Execution:
//   npx tsx scripts/ingest-docs-pinecone.ts

import { Pinecone } from "@pinecone-database/pinecone";
import fg from "fast-glob";
import fs from "node:fs/promises";
import path from "node:path";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

// Tipo para upsertRecords com integrated embedding
type TextRecord = {
  _id: string;
  text: string;
  path: string;
  [key: string]: unknown;
};

const PINECONE_API_KEY = process.env.PINECONE_API_KEY!;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME!;

if (!PINECONE_API_KEY) throw new Error("Define PINECONE_API_KEY");
if (!PINECONE_INDEX_NAME) throw new Error("Define PINECONE_INDEX_NAME (index name)");

const NAMESPACE = process.env.NAMESPACE || "docs";
const DOCS_DIR = process.env.DOCS_DIR || "docs";
const EXTENSIONS = (process.env.EXTENSIONS || ".md,.mdx,.txt")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

const MAX_FILE_MB = Number(process.env.MAX_FILE_MB || "2");
const CHUNK_SIZE = Number(process.env.CHUNK_SIZE || "2800");
const CHUNK_OVERLAP = Number(process.env.CHUNK_OVERLAP || "300");
const BATCH_SIZE = Number(process.env.BATCH_SIZE || "500");
const DELETE_ALL = String(process.env.DELETE_ALL || "true").toLowerCase() === "true";

const bytesLimit = MAX_FILE_MB * 1024 * 1024;

function shouldKeep(file: string): boolean {
  const ext = path.extname(file).toLowerCase();
  return EXTENSIONS.includes(ext);
}

async function readIfSmall(file: string): Promise<string | null> {
  try {
    const stat = await fs.stat(file);
    if (stat.size > bytesLimit) {
      console.warn(`Skip por tamanho (${(stat.size / 1024 / 1024).toFixed(2)}MB): ${file}`);
      return null;
    }
    const raw = await fs.readFile(file, "utf8");
    if (!raw.trim()) return null;
    return raw;
  } catch {
    return null;
  }
}

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: CHUNK_SIZE,
  chunkOverlap: CHUNK_OVERLAP,
});

async function main() {
  const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
  const index = pc.Index(PINECONE_INDEX_NAME);

  if (DELETE_ALL) {
    console.log(`Cleaning namespace "${NAMESPACE}"...`);
    await index.namespace(NAMESPACE).deleteAll();
  }

  const pattern = [`${DOCS_DIR.replaceAll(path.sep, "/")}/**/*`];
  const files = await fg(pattern, { onlyFiles: true, dot: false });

  const picked = files.filter(shouldKeep);
  console.log(`Files candidates: ${picked.length} (exts: ${EXTENSIONS.join(", ")})`);

  const records: TextRecord[] = [];

  for (const file of picked) {
    const text = await readIfSmall(file);
    if (!text) continue;

    const normalizedPath = file.replaceAll(path.sep, "/");
    const docs = await splitter.createDocuments([text], [{ path: normalizedPath }]);

    docs.forEach((d, i) => {
      records.push({
        _id: `${normalizedPath}#chunk=${i}`,
        text: d.pageContent,
        path: normalizedPath,
      });
    });
  }

  console.log(`Total chunks: ${records.length}`);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    await index.namespace(NAMESPACE).upsertRecords(batch);
    console.log(`Upserted ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
  }

  console.log(`Completed. Namespace: ${NAMESPACE}. Files: ${picked.length}. Chunks: ${records.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});