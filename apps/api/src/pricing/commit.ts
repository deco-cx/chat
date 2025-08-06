import { HTTPException } from "hono/http-exception";
import { type Context } from "hono";
import { jwtVerify } from "jose";
import { DECO_CHAT_KEY_ID, getKeyPair } from "@deco/sdk/auth";
import { getWalletClient, type CommitPreAuthorized } from "@deco/sdk/mcp/wallet";
import { honoCtxToAppCtx } from "../api.ts";

interface CallbackTokenPayload {
  executionId: string;
  workspaceId: string;
}

interface PricingCommitRequest {
  executionId: string;
  amount: number | string;
}

/**
 * Validates a callback token and extracts the payload
 */
const validateCallbackToken = async (token: string): Promise<CallbackTokenPayload> => {
  try {
    // For now, handle both JWT and simple base64 tokens
    // First try JWT validation
    try {
      const [, publicKey] = await getKeyPair();
      const { payload } = await jwtVerify(token, publicKey, {
        issuer: undefined,
        audience: "pricing:callback",
      });

      if (!payload.executionId || !payload.workspaceId) {
        throw new Error("Invalid JWT payload");
      }

      return {
        executionId: payload.executionId as string,
        workspaceId: payload.workspaceId as string,
      };
    } catch (jwtError) {
      // Fallback to simple base64 token (for runtime-generated tokens)
      const decodedPayload = JSON.parse(atob(token));
      
      if (!decodedPayload.executionId || !decodedPayload.workspaceId) {
        throw new Error("Invalid token payload");
      }

      // Check expiration
      if (decodedPayload.exp && Date.now() / 1000 > decodedPayload.exp) {
        throw new Error("Token expired");
      }

      // Check audience
      if (decodedPayload.aud !== "pricing:callback") {
        throw new Error("Invalid audience");
      }

      return {
        executionId: decodedPayload.executionId,
        workspaceId: decodedPayload.workspaceId,
      };
    }
  } catch (error) {
    console.error("Token validation failed:", error);
    throw new HTTPException(403, { message: "Invalid callback token" });
  }
};

/**
 * Handler for pricing commit endpoint
 * Validates callback token and commits pre-authorized transaction
 */
export const pricingCommitHandler = async (c: Context) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid Authorization header" });
  }

  const token = authHeader.replace("Bearer ", "");
  const tokenPayload = await validateCallbackToken(token);

  const body = await c.req.json() as PricingCommitRequest;
  
  if (!body.executionId || body.amount === undefined) {
    throw new HTTPException(400, { message: "Missing executionId or amount" });
  }

  if (body.executionId !== tokenPayload.executionId) {
    throw new HTTPException(403, { message: "Token execution ID does not match request" });
  }

  // Get wallet client
  const appContext = honoCtxToAppCtx(c);
  const wallet = getWalletClient(appContext);
  console.log({wallet})

  try {
    // First try to commit the pre-authorization if it exists
    try {
      const commitResponse = await wallet["POST /transactions/:id/commit"](
        { id: body.executionId },
        {
          body: {
            mcpId: "api", // This could be dynamic based on the MCP server
            vendor: {
              type: "vendor",
              id: "deco-chat", // Platform vendor ID - this could be configurable
            },
            amount: body.amount.toString(),
            metadata: {
              committedAt: new Date().toISOString(),
              tokenWorkspace: tokenPayload.workspaceId,
            },
          },
        }
      );

      console.log({commitResponse})

      if (commitResponse.ok) {
        const result = await commitResponse.json();
        console.log({result})
        return c.json({ 
          success: true,
          transactionId: result.id,
          executionId: body.executionId,
          amount: body.amount,
        });

      }
    } catch (commitError) {
      console.log("Pre-authorization commit failed, trying direct transaction:", commitError);
    }

    // Fallback: For testing/development, create a direct transaction instead
    // This allows pricing contracts to work without full pre-authorization flow
    console.log(`Creating direct transaction for ${body.amount} from execution ${body.executionId}`);
    
    // For now, just log the transaction and return success
    // In production, you'd want to create an actual wallet transaction here
    console.log(`[MOCK TRANSACTION] ${tokenPayload.workspaceId} charged ${body.amount} for execution ${body.executionId}`);
    
    return c.json({ 
      success: true,
      transactionId: `mock-${body.executionId}`,
      executionId: body.executionId,
      amount: body.amount,
      note: "Mock transaction for development - no actual charge made"
    });

  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    
    console.error("Pricing commit error:", error);
    throw new HTTPException(500, { message: "Internal server error during pricing commit" });
  }
};