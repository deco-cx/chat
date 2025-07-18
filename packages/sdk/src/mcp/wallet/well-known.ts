export const WellKnownWallets = {
  build: (type: string, discriminator: string, category: string) =>
    `${type}::${discriminator}@${category}`,
  unwind: (wallet: string) => {
    const [category, discriminatorAndCategory] = wallet.split("::");
    const [discriminator, type] = discriminatorAndCategory.split("@");
    return { type, discriminator, category };
  },
  workspace: {
    genCredits: (workspace: string) =>
      [
        "user" as const,
        `workspace-gen-credits-${workspace}`,
        "liability" as const,
      ] as const,
    voucher: (id: string, amount: string) =>
      [
        "user" as const,
        `deco-chat-voucher-${id}-${amount}`,
        "liability" as const,
      ] as const,
  },
} as const;

const validMonth = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;
// bump this 15 years from now (lol)
const validYear = [
  "2025",
  "2026",
  "2027",
  "2028",
  "2029",
  "2030",
  "2031",
  "2032",
  "2033",
  "2034",
  "2035",
  "2036",
  "2037",
  "2038",
  "2039",
  "2040",
] as const;

type ValidYear = (typeof validYear)[number];
type ValidMonth = (typeof validMonth)[number];

export const isValidMonth = (month: string): month is ValidMonth => {
  return validMonth.includes(month as ValidMonth);
};

export const isValidYear = (year: string): year is ValidYear => {
  return validYear.includes(year as ValidYear);
};

export const WellKnownTransactions = {
  freeTwoDollars: (workspaceId: string) => `free-two-dollars-${workspaceId}`,
  monthlyPlanCreditsReward: (
    workspaceId: string,
    month: ValidMonth,
    year: ValidYear,
  ) => `monthly-plan-credits-reward-${workspaceId}-${month}-${year}`,
} as const;
