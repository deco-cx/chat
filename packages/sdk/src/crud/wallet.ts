import { MCPClient } from "../fetcher.ts";
import { ProjectLocator } from "../locator.ts";

export const getWalletAccount = (locator: ProjectLocator) =>
  MCPClient.forLocator(locator).GET_WALLET_ACCOUNT({});

export const getThreadsUsage = (
  locator: ProjectLocator,
  range: "day" | "week" | "month",
) =>
  MCPClient.forLocator(locator).GET_THREADS_USAGE({
    range,
  });

export const getAgentsUsage = (
  locator: ProjectLocator,
  range: "day" | "week" | "month",
) =>
  MCPClient.forLocator(locator).GET_AGENTS_USAGE({
    range,
  });

export const getBillingHistory = (
  locator: ProjectLocator,
  range: "day" | "week" | "month" | "year",
) =>
  MCPClient.forLocator(locator).GET_BILLING_HISTORY({
    range,
  });

export const createWalletCheckoutSession = ({
  locator,
  amountUSDCents,
  successUrl,
  cancelUrl,
}: {
  locator: ProjectLocator;
  amountUSDCents: number;
  successUrl: string;
  cancelUrl: string;
}) =>
  MCPClient.forLocator(locator).CREATE_CHECKOUT_SESSION({
    amountUSDCents,
    successUrl,
    cancelUrl,
  });

export const redeemWalletVoucher = ({
  locator,
  voucher,
}: {
  locator: ProjectLocator;
  voucher: string;
}) =>
  MCPClient.forLocator(locator).REDEEM_VOUCHER({
    voucher,
  });

export const createWalletVoucher = ({
  locator,
  amount,
}: {
  locator: ProjectLocator;
  amount: number;
}) =>
  MCPClient.forLocator(locator).CREATE_VOUCHER({
    amount,
  });

export const getWorkspacePlan = async (locator: ProjectLocator) => {
  const plan = await MCPClient.forLocator(locator).GET_WORKSPACE_PLAN({});

  return plan;
};
