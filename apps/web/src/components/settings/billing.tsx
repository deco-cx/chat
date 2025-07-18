import { Suspense, useMemo, useState } from "react";
import { 
  usePlan, 
  useWorkspaceWalletBalance,
  WELL_KNOWN_PLANS,
  type PlanWithTeamMetadata 
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Table, type TableColumn } from "../common/table/index.tsx";
import { DepositDialog } from "../wallet/deposit-dialog.tsx";
import { VoucherDialog } from "../wallet/voucher-dialog.tsx";
import { ErrorBoundary } from "../../error-boundary.tsx";

// Mock billing data - replace with actual data hooks when available
const mockTransactions = [
  {
    id: "tx_1",
    date: "2025-01-15",
    description: "Monthly Subscription - Growth Plan",
    type: "subscription" as const,
    amount: -2500,
    status: "completed" as const,
  },
  {
    id: "tx_2", 
    date: "2025-01-14",
    description: "Wallet Top-up",
    type: "topup" as const,
    amount: 100.00,
    status: "completed" as const,
  },
  {
    id: "tx_3",
    date: "2025-01-10", 
    description: "Monthly Subscription - Growth Plan",
    type: "subscription" as const,
    amount: -2500,
    status: "completed" as const,
  },
  {
    id: "tx_4",
    date: "2025-01-08",
    description: "Wallet Top-up",
    type: "topup" as const,
    amount: 50.00,
    status: "completed" as const,
  },
];

type Transaction = typeof mockTransactions[0];

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

const availablePlans: PlanInfo[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "month",
    credits: 2,
    seats: 2,
    markup: 20,
    features: [
      { name: "AI Credits", included: true, limit: "$2" },
      { name: "Top-up credits", included: true },
      { name: "Basic support", included: true },
    ],
    support: "Community support",
  },
  {
    id: "starter", 
    name: "Starter",
    price: 500,
    period: "month",
    credits: 425,
    seats: 10,
    markup: 15,
    features: [
      { name: "AI Credits", included: true, limit: "$425" },
      { name: "Optimized AI Usage Rate", included: true, limit: "15% markup" },
      { name: "Support via ticket", included: true },
      { name: "Weekly Office Hours", included: true },
      { name: "Premium support upgrade", included: true, limit: "$1k" },
    ],
    support: "Ticket support",
  },
  {
    id: "growth",
    name: "Growth", 
    price: 2500,
    period: "month",
    credits: 2250,
    seats: 50,
    markup: 10,
    popular: true,
    current: true,
    features: [
      { name: "AI Credits", included: true, limit: "$2,250" },
      { name: "Better AI Usage Rate", included: true, limit: "10% markup" },
      { name: "Workspace management", included: true },
      { name: "Support with SLA", included: true },
      { name: "Success Team support", included: true },
      { name: "Technical support", included: true, limit: "1h/week" },
    ],
    support: "Priority support with SLA",
  },
  {
    id: "scale",
    name: "Scale",
    price: 5000,
    period: "month", 
    credits: 4750,
    seats: 100,
    markup: 5,
    features: [
      { name: "AI Credits", included: true, limit: "$4,750" },
      { name: "Best AI Usage Rate", included: true, limit: "5% markup" },
      { name: "Workspace management", included: true },
      { name: "Priority support with SLA", included: true },
      { name: "Dedicated Success Team", included: true },
      { name: "Technical support", included: true, limit: "3h/week" },
    ],
    support: "Dedicated Success Team",
  },
];

function WalletBalanceCard() {
  const { balance, refetch, isRefetching } = useWorkspaceWalletBalance();

  return (
    <Card className="p-6 rounded-xl border">
      <CardContent className="p-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Icon name="account_balance_wallet" size={20} />
            <span className="text-sm font-medium text-muted-foreground">Remaining Balance</span>
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
        
        <div className="text-4xl font-semibold text-foreground mb-4">
          {balance}
        </div>
        
        <div className="flex gap-2">
          <div className="w-fit">
            <DepositDialog />
          </div>
          <div className="w-fit">
            <VoucherDialog />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BillingInfoCard() {
  return (
    <Card className="p-6 rounded-xl border">
      <CardContent className="p-0">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="receipt" size={20} />
          <span className="text-sm font-medium text-muted-foreground">Billing Information</span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Billing Cycle</div>
            <div className="font-medium">Monthly</div>
          </div>
          <div>
            <div className="text-muted-foreground">Next Payment</div>
            <div className="font-medium">August 1, 2025</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PlanInfoCard() {
  const [showPlansModal, setShowPlansModal] = useState(false);
  const currentPlan = availablePlans.find(p => p.current) || availablePlans[2];

  return (
    <>
      <Card className="p-6 rounded-xl border h-full">
        <CardContent className="p-0 h-full flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="workspace_premium" size={20} className="text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Current Plan</span>
            </div>
            <Badge variant="secondary" className="text-xs">
              {currentPlan.name}
            </Badge>
          </div>
          
          <div className="space-y-3 text-sm flex-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Seats used</span>
              <span className="font-medium">21/50</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Monthly cost</span>
              <span className="font-medium">${currentPlan.price/100}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tech support</span>
              <span className="font-medium">1h/week</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">AI usage rate</span>
              <span className="font-medium text-primary">{currentPlan.markup}% markup</span>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            className="w-full mt-4"
            onClick={() => setShowPlansModal(true)}
          >
            <Icon name="upgrade" size={16} />
            View All Plans
          </Button>
        </CardContent>
      </Card>

      <PlansModal 
        isOpen={showPlansModal} 
        onClose={() => setShowPlansModal(false)} 
      />
    </>
  );
}

function PlansModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const handlePlanSelect = (planId: string) => {
    console.log(`Selected plan: ${planId}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose Your Plan</DialogTitle>
        </DialogHeader>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {availablePlans.map((plan) => (
              <PlanCard 
                key={plan.id} 
                plan={plan} 
                onSelect={handlePlanSelect}
              />
            ))}
          </div>
        </div>
        
        {/* Custom Plan Card */}
        <Card className="p-6 border-dashed mx-6 mb-6">
          <CardContent className="p-0 text-center space-y-4">
            <div className="space-y-2">
              <h4 className="text-lg font-semibold">Custom Plan</h4>
              <p className="text-sm text-muted-foreground">For organizations with specific needs</p>
            </div>
            <div className="text-sm space-y-1">
              <div className="flex items-center justify-center gap-2">
                <Icon name="check" size={14} className="text-green-600" />
                <span>500+ Builder Seats</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Icon name="check" size={14} className="text-green-600" />
                <span>Self-hosting options</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Icon name="check" size={14} className="text-green-600" />
                <span>Custom integrations</span>
              </div>
              <div className="flex items-center justify-center gap-2">
                <Icon name="check" size={14} className="text-green-600" />
                <span>BYOK (Bring Your Own Keys)</span>
              </div>
            </div>
            <Button variant="outline" className="w-full">
              <Icon name="forum" size={16} className="mr-2" />
              Contact Us
            </Button>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

function PlanCard({ plan, onSelect }: { plan: PlanInfo; onSelect: (planId: string) => void }) {
  const isPopular = plan.popular;
  const isCurrent = plan.current;
  
  return (
    <Card className={`relative overflow-hidden transition-all hover:shadow-lg min-h-[500px] flex flex-col ${
      isCurrent ? "ring-2 ring-primary shadow-md" : ""
    } ${isPopular ? "border-primary shadow-md scale-105" : ""}`}>
      
      {/* Header with gradient background */}
      <div className={`relative px-6 py-6 text-center ${
        isPopular ? "bg-gradient-to-br from-primary/10 to-primary/5" : 
        isCurrent ? "bg-gradient-to-br from-muted/50 to-muted/20" : 
        "bg-gradient-to-br from-muted/30 to-muted/10"
      }`}>
        
        {/* Badges */}
        {isPopular && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-primary text-primary-foreground text-xs font-medium">
              Most Popular
            </Badge>
          </div>
        )}
        {isCurrent && (
          <div className="absolute top-2 right-2">
            <Badge variant="secondary" className="text-xs font-medium">
              Current
            </Badge>
          </div>
        )}
        
        {/* Plan icon */}
        <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
          isPopular ? "bg-primary text-primary-foreground" : 
          isCurrent ? "bg-muted text-muted-foreground" : 
          "bg-muted/60 text-muted-foreground"
        }`}>
          <Icon name={plan.id === 'free' ? 'star_border' : 
                       plan.id === 'starter' ? 'rocket_launch' : 
                       plan.id === 'growth' ? 'trending_up' : 'enterprise'} 
                size={20} />
        </div>
        
        {/* Plan name */}
        <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
        
        {/* Pricing */}
        <div className="flex items-baseline justify-center gap-1 mb-2">
          <span className="text-4xl font-bold">${plan.price/100}</span>
          <span className="text-muted-foreground text-sm">/{plan.period}</span>
        </div>
        
        {/* Tagline */}
        <p className="text-sm text-muted-foreground">
          {plan.id === 'free' ? 'Get started for free' :
           plan.id === 'starter' ? 'Perfect for small teams' :
           plan.id === 'growth' ? 'For growing businesses' :
           'For large organizations'}
        </p>
      </div>
      
      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted/20 rounded-lg">
            <div className="text-2xl font-bold text-primary">{plan.seats}</div>
            <div className="text-xs text-muted-foreground">Seats</div>
          </div>
          <div className="text-center p-3 bg-muted/20 rounded-lg">
            <div className="text-2xl font-bold text-primary">${plan.credits/100}</div>
            <div className="text-xs text-muted-foreground">AI Credits</div>
          </div>
        </div>
        
        {/* Usage rate highlight */}
        <div className="text-center p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border">
          <div className="text-lg font-semibold text-green-700">{plan.markup}% markup</div>
          <div className="text-xs text-muted-foreground">AI Usage Rate</div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          {plan.features.slice(0, 3).map((feature, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center mt-0.5">
                <Icon name="check" size={12} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">{feature.name}</div>
                {feature.limit && (
                  <div className="text-xs text-muted-foreground">{feature.limit}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="p-6 pt-0">
        <Button 
          variant={isCurrent ? "secondary" : isPopular ? "default" : "outline"}
          className={`w-full ${isPopular ? "bg-primary hover:bg-primary/90" : ""}`}
          disabled={isCurrent}
          onClick={() => onSelect(plan.id)}
        >
          {isCurrent ? "Current Plan" : plan.price === 0 ? "Downgrade" : "Upgrade"}
        </Button>
        
        {/* Support info */}
        <div className="text-center mt-2">
          <span className="text-xs text-muted-foreground">{plan.support}</span>
        </div>
      </div>
    </Card>
  );
}

function TransactionsTable() {
  const [sortKey, setSortKey] = useState<string>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const getStatusBadge = (status: Transaction["status"]) => {
    const variants = {
      completed: "default",
      pending: "secondary", 
      failed: "destructive",
    } as const;
    
    const labels = {
      completed: "Completed",
      pending: "Pending",
      failed: "Failed", 
    };

    return (
      <Badge variant={variants[status]} className="text-xs">
        {labels[status]}
      </Badge>
    );
  };

  const getTypeIcon = (type: Transaction["type"]) => {
    const icons = {
      subscription: "workspace_premium",
      topup: "add_circle",
    };
    
    const colors = {
      subscription: "text-blue-600",
      topup: "text-green-600", 
    };

    return (
      <Icon 
        name={icons[type]} 
        size={16} 
        className={colors[type]} 
      />
    );
  };

  const columns: TableColumn<Transaction>[] = [
    {
      id: "type",
      header: "",
      render: (transaction) => getTypeIcon(transaction.type),
    },
    {
      id: "date",
      header: "Date",
      render: (transaction) => new Date(transaction.date).toLocaleDateString(),
      sortable: true,
    },
    {
      id: "description", 
      header: "Description",
      render: (transaction) => (
        <div className="flex flex-col">
          <span className="font-medium">{transaction.description}</span>
          <span className="text-xs text-muted-foreground capitalize">{transaction.type}</span>
        </div>
      ),
      sortable: true,
    },
    {
      id: "status",
      header: "Status", 
      render: (transaction) => getStatusBadge(transaction.status),
      sortable: true,
    },
    {
      id: "amount",
      header: "Amount",
      render: (transaction) => (
        <span className={`font-medium ${
          transaction.amount > 0 ? "text-green-600" : "text-foreground"
        }`}>
          {transaction.amount > 0 ? "+" : ""}${Math.abs(transaction.amount/100).toFixed(2)}
        </span>
      ),
      sortable: true,
    },
  ];

  const getSortValue = (transaction: Transaction, key: string): string | number => {
    switch (key) {
      case "date":
        return new Date(transaction.date).getTime();
      case "description":
        return transaction.description.toLowerCase();
      case "status":
        return transaction.status;
      case "amount":
        return transaction.amount;
      default:
        return "";
    }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sortedTransactions = useMemo(() => {
    return [...mockTransactions].sort((a, b) => {
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
        <h3 className="text-lg font-semibold">Billing History</h3>
        <p className="text-sm text-muted-foreground">Your subscription payments and wallet top-ups</p>
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
        Something went wrong while loading the billing data. Please try again later.
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              <Suspense fallback={<Skeleton className="h-[200px]" />}>
                <WalletBalanceCard />
              </Suspense>
              <Suspense fallback={<Skeleton className="h-[180px]" />}>
                <BillingInfoCard />
              </Suspense>
            </div>
            <div>
              <Suspense fallback={<Skeleton className="h-[260px]" />}>
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