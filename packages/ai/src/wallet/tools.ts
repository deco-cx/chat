import { MicroDollar } from "@webdraw/common/wallet";
import { z } from "zod";
import { createInnateTool } from "../utils/createTool.ts";

const PreAuthorizeTransactionInputSchema = z.object({
  amount: z.number().describe("The amount of the transaction, in USD cents."),
});

const PreAuthorizeTransactionOutputSchema = z.object({
  hash: z.string().describe("The hash of the transaction."),
});

export const DECO_WALLET_PRE_AUTHORIZE_TRANSACTION = createInnateTool({
  id: "DECO_WALLET_PRE_AUTHORIZE_TRANSACTION",
  description:
    "Pre-authorize a transaction. When another MCP server requests a Proof Of Payment, " +
    "this tool needs to be called to pre-authorize the transaction, and return a hash " +
    "that can be used to verify the transaction.",
  inputSchema: PreAuthorizeTransactionInputSchema,
  outputSchema: PreAuthorizeTransactionOutputSchema,
  execute: (agent) => async ({ context }) => {
    const wallet = await agent.walletClient?.();

    if (!wallet) {
      throw new Error("Internal server error");
    }

    const identifier = crypto.randomUUID();
    const userId = agent.metadata?.principal?.id;

    if (!userId) {
      throw new Error("User ID not found");
    }

    const operation = {
      type: "PreAuthorization" as const,
      amount: MicroDollar.fromCents(context.amount).toMicrodollarString(),
      userId,
      identifier,
      timestamp: new Date(),
      metadata: {
        threadId: agent.metadata?.threadId,
        resourceId: agent.metadata?.resourceId,
      },
    };

    const response = await wallet["POST /transactions"]({}, {
      body: operation,
    });
    const data = await response.json();

    return {
      hash: data.id,
    };
  },
});

export const tools = {
  DECO_WALLET_PRE_AUTHORIZE_TRANSACTION,
};
