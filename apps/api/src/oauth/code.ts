import { JwtIssuer, type JWTPayload } from "@deco/sdk/auth";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { honoCtxToAppCtx } from "../api.ts";
import type { AppEnv } from "../utils/context.ts";
import { mockOAuthStore } from "./mock-store.ts";

const tryParseUser = (user: unknown) => {
  if (typeof user === "string") {
    const { id, email, user_metadata } = JSON.parse(user);
    return { id, email, user_metadata };
  }
  return user;
};

export const handleCodeExchange = async (c: Context<AppEnv>) => {
  try {
    const appCtx = honoCtxToAppCtx(c);

    const { code } = await c.req.json();

    // Try mock store first (for tool authorization codes)
    const { data, error } = await mockOAuthStore.findByCode(code);

    if (error || !data) {
      // Fallback to regular database for integration codes
      const dbResult = await appCtx.db
        .from("deco_chat_oauth_codes")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      
      if (dbResult.error || !dbResult.data) {
        throw new HTTPException(500, { message: "Failed to exchange code" });
      }
      
      // This is a regular integration code - handle normally
      const { claims } = dbResult.data as unknown as { claims: JWTPayload };
      
      const keyPair =
        appCtx.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY &&
        appCtx.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY
          ? {
              public: appCtx.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY,
              private: appCtx.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY,
            }
          : undefined;
      const issuer = await JwtIssuer.forKeyPair(keyPair);
      
      const token = await issuer.issue({
        ...claims,
        user: "user" in claims ? tryParseUser(claims.user) : undefined,
      });

      await appCtx.db.from("deco_chat_oauth_codes").delete().eq("code", code);
      
      return c.json({ access_token: token });
    }

    // This is a tool authorization code from mock store
    const { claims } = data;

    const keyPair =
      appCtx.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY &&
      appCtx.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY
        ? {
            public: appCtx.envVars.DECO_CHAT_API_JWT_PUBLIC_KEY,
            private: appCtx.envVars.DECO_CHAT_API_JWT_PRIVATE_KEY,
          }
        : undefined;
    const issuer = await JwtIssuer.forKeyPair(keyPair);
    
    // Tool authorization code - create scoped token
    const executionId = crypto.randomUUID(); // Generate execution ID for this token
    const token = await issuer.issue({
      aud: ["tool_execution"],
      iss: "deco.chat",
      sub: claims.sub,
      workspace: claims.workspace,
      workspaceId: claims.workspace, // Also set workspaceId for compatibility
      toolId: claims.toolId,
      executionId: executionId, // Add executionId for pricing callbacks
      scope: "tool:execute",
      authType: "tool_execution",
      exp: Math.floor(Date.now() / 1000) + (10 * 60), // 10 minutes for tool execution
    });

    // Delete the code from mock store
    await mockOAuthStore.deleteByCode(code);

    // Return scoped token with metadata
    return c.json({
      access_token: token,
      token_type: "scoped",
      scope: "tool:execute",
      toolId: claims.toolId,
      workspace: claims.workspace,
    });
  } catch (error) {
    console.error("Code exchange error:", error);
    throw new HTTPException(500, { message: "Failed to exchange code" });
  }
};
