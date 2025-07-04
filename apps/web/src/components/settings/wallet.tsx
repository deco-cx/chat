import { useWorkspaceWalletBalance } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { DepositDialog } from "../wallet/deposit-dialog.tsx";
import { VoucherDialog } from "../wallet/voucher-dialog.tsx";
import { EmptyStateCard } from "./usage.tsx";

function AccountBalance() {
  const account = useWorkspaceWalletBalance();
  return <p className="text-5xl font-bold">{account?.balance}</p>;
}

function BalanceCard() {
  const account = useWorkspaceWalletBalance();
  return (
    <Card className="bg-background w-full p-4 flex flex-col items-center border-none mt-8">
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <div className="flex items-center justify-center w-full text-base mb-1 gap-2">
          <span>Team balance</span>
          <Button
            variant="ghost"
            className="w-8 h-8"
            size="icon"
            onClick={account.refetch}
          >
            <Icon
              name="refresh"
              size={16}
              className={account.isRefetching ? "animate-spin" : ""}
            />
          </Button>
        </div>
        <div className="mb-6">
          <Suspense fallback={<Skeleton className="w-32 h-12" />}>
            <ErrorBoundary
              fallback={
                <p className="text-destructive">Error loading balance</p>
              }
            >
              <AccountBalance />
            </ErrorBoundary>
          </Suspense>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1/2">
            <DepositDialog />
          </div>
          <div className="w-full">
            <VoucherDialog />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentTransactions() {
  return (
    <Card className="bg-background w-full p-4 flex flex-col items-center border-none">
      <CardContent className="flex flex-col items-center justify-center gap-2 p-0">
        <div className="flex items-center gap-1 text-base mb-1">
          Recent Transactions
        </div>
        <EmptyStateCard
          title="No transactions yet"
          description="Your transaction history will appear here once you make a deposit or redeem a voucher"
        />
      </CardContent>
    </Card>
  );
}

export default function Wallet() {
  return (
    <div className="h-full text-foreground bg-background">
      <div className="flex flex-col items-center h-full gap-4 w-full mt-12">
        <BalanceCard />
        <RecentTransactions />
      </div>
    </div>
  );
}
