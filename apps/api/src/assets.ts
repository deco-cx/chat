import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { cache } from "hono/cache";
import { getRuntimeKey } from "hono/adapter";
import { GetObjectCommand, GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { typeByExtension } from "@std/media-types";
import { AppEnv } from "./utils/context.ts";
import { withContextMiddleware } from "./middlewares/context.ts";
import { PUBLIC_ASSETS_BUCKET } from "@deco/sdk";

export const app = new Hono<AppEnv>();

app.use(withContextMiddleware);

app.use(
  "/public/:path{.+}",
  cache({
    cacheName: "assets",
    cacheControl: "public, max-age=31536000", // 1 year cache
    wait: getRuntimeKey() === "deno", // Only required for Deno environment
  }),
);

app.get("/public/:path{.+}", async (c) => {
  try {
    const imagePath = c.req.param("path");

    const getCommand = new GetObjectCommand({
      Bucket: PUBLIC_ASSETS_BUCKET,
      Key: imagePath,
    });

    const response = await c.var.s3.send(getCommand) as GetObjectCommandOutput;

    if (!response.Body) {
      throw new HTTPException(404, { message: "Asset not found" });
    }

    const bodyBytes = await response.Body.transformToByteArray();

    const contentType = response.ContentType ||
      response.Metadata?.["content-type"] ||
      typeByExtension(imagePath?.split(".").pop() || "") ||
      "application/octet-stream";

    const etag = response.ETag || "";
    const contentLength = String(bodyBytes?.length || 0);

    return new Response(bodyBytes, {
      headers: {
        "Content-Type": contentType,
        "ETag": etag,
        "Content-Length": contentLength,
      },
    });
  } catch (error) {
    console.error(error);
    if (error instanceof HTTPException) {
      throw error;
    }

    throw new HTTPException(500, { message: "Internal server error" });
  }
});

export default app;
