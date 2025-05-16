import { MCPClient } from "../fetcher.ts";

export const getWalletAccount = async (workspace: string) => {
  const { status, data, error } = await MCPClient.forWorkspace(workspace).GET_WALLET_ACCOUNT({});
  if (status !== 200 || error) {
    throw new Error(error?.message);
  }
  return data;
};

interface WalletStatement {
  id: string;
  timestamp: string;
  title: string;
  amount: string;
  amountExact: string;
  description?: string;
  type: "credit" | "debit";
  icon?: string;
  metadata?: Record<string, string>;
}

// export const getWalletStatements = async (cursor?: string) => {
//   const response = await fetchAPI({
//     path: `/wallet/statements${cursor ? `?cursor=${cursor}` : ""}`,
//   });
//   return response.json() as Promise<{
//     items: WalletStatement[];
//     nextCursor: string;
//   }>;
// };

export const createWalletCheckoutSession = async (amountInCents: number) => {
  // const response = await fetchAPI({
  //   segments: ["wallet", "checkout"],
  //   method: "POST",
  //   body: JSON.stringify({ amountInCents }),
  // });
  // return response.json() as Promise<{ checkoutUrl: string }>;
  return { checkoutUrl: "https://checkout.stripe.com/c/pay/test" };
};
