import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { WELL_KNOWN_ORIGINS } from "../../hosts.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
} from "../assertions.ts";
import { AppContext, createTool, getEnv } from "../context.ts";

// Regex generated by Cursor on 2025-05-21
// Replace any character that is not a letter, number, or hyphen with a hyphen to not break the bucket name
const getWorkspaceBucketName = (workspace: string) =>
  `deco-chat-${
    workspace
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }`;

const ensureBucketExists = async (c: AppContext, bucketName: string) => {
  const { cf } = c;
  const env = getEnv(c);

  try {
    await cf.r2.buckets.get(bucketName, {
      account_id: env.CF_ACCOUNT_ID,
    });
  } catch (error) {
    if ((error as unknown as { status: number })?.status !== 404) {
      throw error;
    }

    // Create bucket
    await cf.r2.buckets.create({
      name: bucketName,
      account_id: env.CF_ACCOUNT_ID,
    });

    // Set cors
    await cf.r2.buckets.cors.update(bucketName, {
      account_id: env.CF_ACCOUNT_ID,
      rules: [{
        maxAgeSeconds: 3600,
        exposeHeaders: ["etag"],
        allowed: {
          methods: ["GET", "PUT"],
          origins: [...WELL_KNOWN_ORIGINS],
          headers: ["origin", "content-type"],
        },
      }],
    });
  }
};

const getS3Client = (c: AppContext) => {
  const env = getEnv(c);

  return new S3Client({
    region: "auto",
    endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CF_R2_ACCESS_KEY_ID!,
      secretAccessKey: env.CF_R2_SECRET_ACCESS_KEY!,
    },
  });
};

export const listFiles = createTool({
  name: "FS_LIST",
  description: "List files from a given bucket given a prefix",
  inputSchema: z.object({
    prefix: z.string().describe("The root directory to list files from"),
  }),
  handler: async ({ prefix: root }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await Promise.all([
      ensureBucketExists(c, bucketName),
      assertWorkspaceResourceAccess(c.tool.name, c),
    ]);

    const s3Client = getS3Client(c);
    const listCommand = new ListObjectsCommand({
      Bucket: bucketName,
      Prefix: root,
    });

    return s3Client.send(listCommand);
  },
});

export const readFile = createTool({
  name: "FS_READ",
  description: "Get a secure temporary link to read a file",
  inputSchema: z.object({
    path: z.string(),
    expiresIn: z.number().optional().describe(
      "Seconds until URL expires (default: 60)",
    ),
  }),
  handler: async ({ path, expiresIn = 60 }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await Promise.all([
      ensureBucketExists(c, bucketName),
      assertWorkspaceResourceAccess(c.tool.name, c),
    ]);

    const s3Client = getS3Client(c);
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: path,
    });

    const url = await getSignedUrl(s3Client, getCommand, { expiresIn });

    return { url };
  },
});

export const readFileMetadata = createTool({
  name: "FS_READ_METADATA",
  description: "Get metadata about a file",
  inputSchema: z.object({
    path: z.string(),
  }),
  handler: async ({ path }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await Promise.all([
      ensureBucketExists(c, bucketName),
      assertWorkspaceResourceAccess(c.tool.name, c),
    ]);

    const s3Client = getS3Client(c);
    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: path,
    });

    const response = await s3Client.send(getCommand);

    return {
      metadata: response.Metadata,
    };
  },
});

export const writeFile = createTool({
  name: "FS_WRITE",
  description: "Get a secure temporary link to upload a file",
  inputSchema: z.object({
    path: z.string(),
    expiresIn: z.number().optional().describe(
      "Seconds until URL expires (default: 60)",
    ),
    contentType: z.string().describe(
      "Content-Type for the file. This is required.",
    ),
    metadata: z.record(z.string(), z.string()).optional().describe(
      "Metadata to be added to the file",
    ),
  }),
  handler: async ({ path, expiresIn = 60, contentType, metadata }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await Promise.all([
      ensureBucketExists(c, bucketName),
      assertWorkspaceResourceAccess(c.tool.name, c),
    ]);

    const s3Client = getS3Client(c);
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      ContentType: contentType,
      Metadata: metadata,
    });

    const url = await getSignedUrl(s3Client, putCommand, {
      expiresIn,
      signableHeaders: new Set(["content-type"]),
    });

    return { url };
  },
});

export const deleteFile = createTool({
  name: "FS_DELETE",
  description: "Delete a file",
  inputSchema: z.object({ path: z.string() }),
  handler: async ({ path }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await ensureBucketExists(c, bucketName);

    await assertWorkspaceResourceAccess(c.tool.name, c);

    const s3Client = getS3Client(c);
    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: path,
    });

    return s3Client.send(deleteCommand);
  },
});
