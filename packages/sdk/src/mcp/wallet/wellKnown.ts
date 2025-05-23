export const WellKnownWallets = {
  build: (
    type: string,
    discriminator: string,
    category: string,
  ) => `${type}::${discriminator}@${category}`,
  unwind: (
    wallet: string,
  ) => {
    const [category, discriminatorAndCategory] = wallet.split("::");
    const [discriminator, type] = discriminatorAndCategory.split("@");
    return { type, discriminator, category };
  },
  workspace: {
    genCredits: (
      workspace: string,
    ) =>
      [
        "user" as const,
        `workspace-gen-credits-${workspace}`,
        "liability" as const,
      ] as const,
    voucher: (
      id: string,
      amount: string,
    ) =>
      [
        "user" as const,
        `deco-chat-voucher-${id}-${amount}`,
        "liability" as const,
      ] as const,
  },
} as const;

export const WellKnownTransactions = {
  freeTwoDollars: (
    workspaceId: string,
  ) => `free-two-dollars-${workspaceId}`,
} as const;
