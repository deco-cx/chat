import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { honoCtxToAppCtx } from "../api.ts";
import type { AppEnv } from "../utils/context.ts";
import { mockOAuthStore } from "./mock-store.ts";

export const handleToolAuthCodeCreate = async (c: Context<AppEnv>) => {
  try {
    const appCtx = honoCtxToAppCtx(c);
    const { toolId, workspace } = await c.req.json();

    if (!toolId || !workspace) {
      throw new HTTPException(400, { message: "toolId and workspace are required" });
    }

    // Generate a unique OAuth code for tool authorization
    const code = `tool_${crypto.randomUUID()}`;
    
    // Create claims for tool authorization scoped token
    const claims = {
      aud: ["tool_execution"],
      iss: "deco.chat",
      sub: appCtx.user?.id || "anonymous",
      workspace: workspace,
      toolId: toolId,
      authType: "tool_execution",
      scope: "tool:execute",
      exp: Math.floor(Date.now() / 1000) + (5 * 60), // 5 minutes expiry
    };

    // Store the OAuth code in mock storage
    const { error } = await mockOAuthStore.insert({
      code,
      claims,
      workspace,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 minutes
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to create tool auth code:", error);
      throw new HTTPException(500, { message: "Failed to create authorization code" });
    }

    return c.json({ code });
  } catch (error) {
    console.error("Tool auth code creation error:", error);
    if (error instanceof HTTPException) {
      throw error;
    }
    throw new HTTPException(500, { message: "Failed to create tool authorization code" });
  }
};