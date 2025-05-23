import type { Context } from "hono";
import {
  createTransactionFromStripeEvent,
  serializeError,
  verifyAndParseStripeEvent,
  WebhookEventIgnoredError,
} from "@deco/sdk/mcp";
import { honoCtxToAppCtx } from "../api.ts";
import { createWalletClient } from "@deco/sdk/mcp/wallet";

export const handleStripeWebhook = async (c: Context) => {
  try {
    const signature = c.req.header("stripe-signature");
    if (!signature) {
      throw new Error("Stripe signature header not found");
    }

    const appContext = honoCtxToAppCtx(c);

    const payload = await c.req.text();
    const event = await verifyAndParseStripeEvent(
      payload,
      signature,
      appContext,
    );
    const transaction = await createTransactionFromStripeEvent(
      appContext,
      event,
    );

    if (!appContext.envVars.WALLET_API_KEY) {
      throw new Error("WALLET_API_KEY is not set");
    }

    const wallet = createWalletClient(
      appContext.envVars.WALLET_API_KEY,
      appContext.walletBinding,
    );

    const response = await wallet["POST /transactions"]({}, {
      body: transaction,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create transaction: ${error}`);
    }

    return c.json({
      message: "Transaction created",
    }, 200);
  } catch (error) {
    if (error instanceof WebhookEventIgnoredError) {
      return c.json({
        message: error.message,
      }, 400);
    }

    console.error("[Stripe Webhook] Error", serializeError(error));
    return c.json({
      message: "Internal server error",
    }, 500);
  }
};
