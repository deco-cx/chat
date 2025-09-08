import {
  type BillingHistoryItem,
  useBillingHistory,
  usePlan,
  useWorkspaceWalletBalance,
} from "@deco/sdk";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Progress } from "@deco/ui/components/progress.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { DepositDialog } from "../wallet/deposit-dialog.tsx";
import { VoucherDialog } from "../wallet/voucher-dialog.tsx";

interface PlanFeature {
  name: string;
  included: boolean;
  limit?: string | number;
}

interface PlanInfo {
  id: string;
  name: string;
  price: number;
  period: string;
  credits: number;
  seats: number;
  markup: number;
  popular?: boolean;
  current?: boolean;
  features: PlanFeature[];
  support: string;
}

function WalletBalanceCard() {
  const { balance, refetch, isRefetching } = useWorkspaceWalletBalance();

  return (
    <div className="rounded-xl bg-secondary border overflow-hidden h-full flex flex-col">
      <Card className="p-6 border-none flex-1">
        <CardContent className="p-0 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon
                name="account_balance_wallet"
                size={16}
                className="text-muted-foreground"
              />
              <span className="text-sm font-medium text-muted-foreground">
                Remaining Balance
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refetch}
              disabled={isRefetching}
              className="p-2 h-8 w-8"
            >
              <Icon name="refresh" size={16} />
            </Button>
          </div>

          <div className="text-5xl font-semibold text-foreground mb-6">
            {balance}
          </div>

          <div className="flex gap-2 mt-auto">
            <div className="w-fit">
              <DepositDialog />
            </div>
            <div className="w-fit">
              <VoucherDialog />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlanInfoCard() {
  const plan = usePlan();

  const usedSeats = plan.user_seats - plan.remainingSeats;
  const seatLimit = plan.user_seats;

  return (
    <Card className="p-6 rounded-xl border h-full">
      <CardContent className="p-0 h-full flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon
              name="workspace_premium"
              size={20}
              className="text-muted-foreground"
            />
            <span className="text-sm font-medium text-muted-foreground">
              Current Plan
            </span>
          </div>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="opacity-50 cursor-not-allowed"
                  onClick={(e) => e.preventDefault()}
                >
                  See all plans
                  <Icon name="open_in_new" size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Coming Soon</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="mb-6">
          <h2 className="text-3xl font-medium text-foreground">{plan.title}</h2>
        </div>

        <div className="space-y-4 text-sm flex-1">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seats used</span>
              <span className="font-medium">
                {usedSeats}/{seatLimit}
              </span>
            </div>
            <Progress value={(usedSeats / seatLimit) * 100} className="h-3" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Monthly cost</span>
            <span className="font-medium">
              ${plan.monthly_credit_in_dollars}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Deposit fee</span>
            <span className="font-medium">{plan.markup}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const isFreeReward = (item: BillingHistoryItem) => {
  return (
    item.type === "WorkspaceGenCreditReward" &&
    item.id.includes("free-two-dollars-")
  );
};

function TransactionsTable() {
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const history = useBillingHistory({ range: "year" });

  const getTypeIcon = (item: BillingHistoryItem) => {
    const type = item.type;

    if (isFreeReward(item)) {
      return <Icon name="redeem" size={16} className="text-muted-foreground" />;
    }

    const icons = {
      WorkspaceRedeemVoucher: "redeem",
      WorkspaceGenCreditReward: "workspace_premium",
      WorkspaceCashIn: "add_circle",
    };

    const colors = {
      WorkspaceRedeemVoucher: "text-muted-foreground",
      WorkspaceGenCreditReward: "text-muted-foreground",
      WorkspaceCashIn: "text-muted-foreground",
    };

    return (
      <Icon
        name={icons[type as keyof typeof icons]}
        size={16}
        className={colors[type as keyof typeof colors]}
      />
    );
  };

  const getTypeDescription = (item: BillingHistoryItem) => {
    const type = item.type;

    if (isFreeReward(item)) {
      return {
        title: "Free credit",
        description: "Free credit received for signing up",
      };
    }

    const titles = {
      WorkspaceRedeemVoucher: "Voucher redeemed",
      WorkspaceGenCreditReward: "Monthly credit",
      WorkspaceCashIn: "Wallet top-up",
    };

    const descriptions = {
      WorkspaceRedeemVoucher: "Redeemed a voucher",
      WorkspaceGenCreditReward: "Plan subscription payment",
      WorkspaceCashIn: "Added funds to your wallet",
    };

    return {
      title: titles[type as keyof typeof titles],
      description: descriptions[type as keyof typeof descriptions],
    };
  };

  const columns: TableColumn<BillingHistoryItem>[] = [
    {
      id: "date",
      header: "Date",
      render: (transaction) =>
        new Date(transaction.timestamp).toLocaleDateString(),
      sortable: true,
    },
    {
      id: "description",
      header: "Description",
      render: (transaction) => (
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 mt-0.5">{getTypeIcon(transaction)}</div>
          <div className="flex flex-col min-w-0">
            <span className="font-medium">
              {getTypeDescription(transaction).title}
            </span>
            <span className="text-xs text-muted-foreground">
              {getTypeDescription(transaction).description}
            </span>
          </div>
        </div>
      ),
      sortable: false,
    },
    {
      id: "amount",
      header: "Amount",
      render: (transaction) => (
        <span className={`font-medium text-foreground`}>
          {transaction.amount}
        </span>
      ),
      sortable: false,
    },
  ];

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedTransactions = useMemo(() => {
    const getSortValue = (
      transaction: (typeof history.items)[number],
      key: string,
    ): string | number => {
      switch (key) {
        case "date":
          return new Date(transaction.timestamp).getTime();
        case "type":
          return transaction.type;
        default:
          return "";
      }
    };

    return [...history.items].sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);

      if (aStr < bStr) return sortDirection === "asc" ? -1 : 1;
      if (aStr > bStr) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortKey, sortDirection]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Billing history</h3>
        <p className="text-sm text-muted-foreground">
          Your subscription payments and wallet top-ups
        </p>
      </div>
      <Table
        columns={columns}
        data={sortedTransactions}
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
      />
    </div>
  );
}

function BillingErrorFallback() {
  return (
    <Alert variant="destructive" className="my-8">
      <Icon name="error" size={16} />
      <AlertDescription>
        Something went wrong while loading the billing data. Please try again
        later.
      </AlertDescription>
    </Alert>
  );
}

export default function BillingSettings() {
  return (
    <div className="h-full text-foreground px-6 py-6 overflow-x-auto w-full">
      <ErrorBoundary fallback={<BillingErrorFallback />}>
        <div className="flex flex-col gap-6 overflow-x-auto w-full">
          {/* Top Row - Wallet Balance and Plan Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="min-h-0">
              <Suspense fallback={<Skeleton className="h-[300px]" />}>
                <WalletBalanceCard />
              </Suspense>
            </div>
            <div className="min-h-0">
              <Suspense fallback={<Skeleton className="h-[300px]" />}>
                <PlanInfoCard />
              </Suspense>
            </div>
          </div>

          {/* Billing History */}
          <Suspense fallback={<Skeleton className="h-[400px]" />}>
            <TransactionsTable />
          </Suspense>
        </div>
      </ErrorBoundary>
    </div>
  );
}
