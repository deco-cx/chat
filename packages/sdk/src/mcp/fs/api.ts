import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { getWorkspaceBucketName } from "../../storage/s3/utils.ts";
import {
  assertHasWorkspace,
  canAccessWorkspaceResource,
} from "../assertions.ts";
import { createTool } from "../context.ts";
import { ensureBucketExists } from "../utils.ts";

export const listFiles = createTool({
  name: "FS_LIST",
  description: "List files from a given bucket given a prefix",
  inputSchema: z.object({
    prefix: z.string().describe("The root directory to list files from"),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ prefix: root }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await ensureBucketExists(c, bucketName);

    const listCommand = new ListObjectsCommand({
      Bucket: bucketName,
      Prefix: root,
    });

    return c.s3.send(listCommand);
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
  canAccess: canAccessWorkspaceResource,
  handler: async ({ path, expiresIn = 60 }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await ensureBucketExists(c, bucketName);

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: path,
    });

    const url = await getSignedUrl(c.s3, getCommand, { expiresIn });

    return { url };
  },
});

export const readFileMetadata = createTool({
  name: "FS_READ_METADATA",
  description: "Get metadata about a file",
  inputSchema: z.object({
    path: z.string(),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ path }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await ensureBucketExists(c, bucketName);

    const getCommand = new GetObjectCommand({
      Bucket: bucketName,
      Key: path,
    });

    const response = await c.s3.send(getCommand);

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
  canAccess: canAccessWorkspaceResource,
  handler: async ({ path, expiresIn = 60, contentType, metadata }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await ensureBucketExists(c, bucketName);

    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: path,
      ContentType: contentType,
      Metadata: metadata,
    });

    const url = await getSignedUrl(c.s3, putCommand, {
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
  canAccess: canAccessWorkspaceResource,
  handler: async ({ path }, c) => {
    assertHasWorkspace(c);
    const bucketName = getWorkspaceBucketName(c.workspace.value);

    await ensureBucketExists(c, bucketName);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: path,
    });
    return c.s3.send(deleteCommand);
  },
});
