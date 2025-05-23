import { MCPClient } from "../fetcher.ts";

export const getWalletAccount = (workspace: string) =>
  MCPClient.forWorkspace(workspace)
    .GET_WALLET_ACCOUNT({});

export const getThreadsUsage = (
  workspace: string,
  range: "day" | "week" | "month",
) => 
  MCPClient.forWorkspace(workspace)
    .GET_THREADS_USAGE({
      range,
    });

export const getAgentsUsage = (
  workspace: string,
  range: "day" | "week" | "month",
) => 
  MCPClient.forWorkspace(workspace)
    .GET_AGENTS_USAGE({
      range,
    });

export const createWalletCheckoutSession = ({
  workspace,
  amountUSDCents,
  successUrl,
  cancelUrl,
}: {
  workspace: string;
  amountUSDCents: number;
  successUrl: string;
  cancelUrl: string;
}) => 
  MCPClient.forWorkspace(workspace)
    .CREATE_CHECKOUT_SESSION({
      amountUSDCents,
      successUrl,
      cancelUrl,
    });


export const redeemWalletVoucher = ({
  workspace,
  voucher,
}: {
  workspace: string;
  voucher: string;
}) => 
  MCPClient.forWorkspace(workspace)
    .REDEEM_VOUCHER({
      voucher,
    });

export const createWalletVoucher = ({
  workspace,
  amount,
}: {
  workspace: string;
  amount: number;
}) => 
  MCPClient.forWorkspace(workspace)
    .CREATE_VOUCHER({
      amount,
    });


