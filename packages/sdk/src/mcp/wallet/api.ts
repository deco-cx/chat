import { z } from "zod";
import { createApiHandler, getEnv } from "../context.ts";
import {
  createWalletClient,
  MicroDollar,
  WalletAPI,
  WellKnownWallets,
} from "@deco/sdk/wallet";
import { ClientOf } from "@deco/sdk/http";
import { assertHasWorkspace } from "../assertions.ts";

const Account = {
  fetch: async (wallet: ClientOf<WalletAPI>, id: string) => {
    const accountResponse = await wallet["GET /accounts/:id"]({
      id: encodeURIComponent(id),
    });

    if (accountResponse.status === 404) {
      return null;
    }

    if (!accountResponse.ok) {
      throw new Error("Failed to fetch account");
    }

    return accountResponse.json();
  },
  format: (account: WalletAPI["GET /accounts/:id"]["response"]) => {
    return {
      balance: MicroDollar.fromMicrodollarString(account.balance).display(),
      balanceExact: MicroDollar.fromMicrodollarString(account.balance).display({
        showAllDecimals: true,
      }),
    };
  },
};

export const getWalletAccount = createApiHandler({
  name: "GET_WALLET_ACCOUNT",
  description: "Get the wallet account for the current tenant",
  schema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);

    const envVars = getEnv(c);
    const wallet = createWalletClient(envVars.WALLET_API_KEY, c.walletBinding);

    const workspaceWalletId = WellKnownWallets.build(
      ...WellKnownWallets.workspace(c.workspace.value),
    );
    const data = await Account.fetch(wallet, workspaceWalletId);

    if (!data) {
      return {
        balance: MicroDollar.ZERO.display(),
        balanceExact: MicroDollar.ZERO.display({
          showAllDecimals: true,
        }),
      };
    }

    return Account.format(data);
  },
});

export const createCheckoutSession = createApiHandler({
  name: "CREATE_CHECKOUT_SESSION",
  description: "Create a checkout session for the current tenant's wallet",
  schema: z.object({}),
  handler: async (_, c) => {
    assertHasWorkspace(c);
    const workspace = c.workspace.value;

    const envVars = getEnv(c);
    
    
  },
});
