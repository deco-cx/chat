import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "../utils/context.ts";
import { mockOAuthStore } from "./mock-store.ts";

// Debug endpoint to list all OAuth codes
export const handleListOAuthCodes = async (c: Context<AppEnv>) => {
  try {
    const codes = mockOAuthStore._debug_listAll();
    return c.json({ 
      success: true, 
      count: codes.length,
      codes: codes.map(code => ({
        code: code.code,
        toolId: code.claims.toolId,
        workspace: code.workspace,
        expires_at: code.expires_at,
        created_at: code.created_at
      }))
    });
  } catch (error) {
    console.error("Debug list OAuth codes error:", error);
    throw new HTTPException(500, { message: "Failed to list OAuth codes" });
  }
};

// Debug endpoint to clear all OAuth codes
export const handleClearOAuthCodes = async (c: Context<AppEnv>) => {
  try {
    const result = mockOAuthStore._debug_clearAll();
    return c.json({ 
      success: true, 
      message: `Cleared ${result.cleared} OAuth codes`,
      ...result
    });
  } catch (error) {
    console.error("Debug clear OAuth codes error:", error);
    throw new HTTPException(500, { message: "Failed to clear OAuth codes" });
  }
};