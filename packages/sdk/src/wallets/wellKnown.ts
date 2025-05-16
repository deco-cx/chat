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
  workspace: (
    workspaceId: string,
  ) =>
    [
      "workspace" as const,
      `gen-credits-${workspaceId}`,
      "liability" as const,
    ] as const,
} as const;

export const WellKnownTransactions = {
  freeTwoDollars: (
    workspaceId: string,
  ) => `free-two-dollars-${workspaceId}`,
} as const;
