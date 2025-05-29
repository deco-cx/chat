import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import {
  ensureBucketExists,
  getAssetUrl as getAssetUrlByKey,
} from "../utils.ts";
import { PUBLIC_ASSETS_BUCKET } from "../../constants.ts";
import { createTool } from "../context.ts";
import { canAccessWorkspaceResource } from "../assertions.ts";

export const getAssetUrl = createTool({
  name: "ASSET_GET_URL",
  description: "Get a URL for a public asset",
  inputSchema: z.object({
    key: z.string().describe("The key of the asset"),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: ({ key }, _c) => {
    const url = getAssetUrlByKey(key);
    return { url };
  },
});

export const uploadAsset = createTool({
  name: "ASSET_UPLOAD",
  description: "Upload a public asset",
  inputSchema: z.object({
    content: z.instanceof(Uint8Array).describe(
      "The content of the asset. This is required.",
    ),
    contentType: z.string().describe(
      "Content-Type for the asset. This is required.",
    ),
    metadata: z.record(z.string(), z.string()).optional().describe(
      "Metadata to be added to the asset",
    ),
  }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ contentType, metadata, content }, c) => {
    await ensureBucketExists(c, PUBLIC_ASSETS_BUCKET);

    const key = crypto.randomUUID();

    const putCommand = new PutObjectCommand({
      Bucket: PUBLIC_ASSETS_BUCKET,
      Key: `/${key}`,
      ContentType: contentType,
      Metadata: metadata,
      Body: content,
    });

    await c.s3.send(putCommand);

    const url = getAssetUrlByKey(key);

    return { url, key };
  },
});

export const deleteAsset = createTool({
  name: "ASSET_DELETE",
  description: "Delete a public asset",
  inputSchema: z.object({ key: z.string() }),
  canAccess: canAccessWorkspaceResource,
  handler: async ({ key }, c) => {
    await ensureBucketExists(c, PUBLIC_ASSETS_BUCKET);

    const deleteCommand = new DeleteObjectCommand({
      Bucket: PUBLIC_ASSETS_BUCKET,
      Key: `/${key}`,
    });

    return c.s3.send(deleteCommand);
  },
});
