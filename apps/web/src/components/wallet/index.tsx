import {
  createWalletCheckoutSession,
  getWalletAccount,
  getWalletStatements,
} from "@deco/sdk";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@deco/ui/components/alert.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import {
  useIncomingUrlAlert,
  WalletUrlAlert,
} from "../../hooks/useIncomingUrlAlert.ts";
import { Avatar } from "../common/Avatar.tsx";

const MINIMUM_AMOUNT = 200; // $2.00 in cents

function formatCurrency(value: string) {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");

  // Convert to number and format with 2 decimal places
  const amount = parseFloat(digits) / 100;

  // Format as currency
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function parseCurrency(value: string) {
  // Remove all non-digit characters
  return value.replace(/\D/g, "");
}

function Activity() {
  const [cursor, setCursor] = useState("");
  const { data: statements, isLoading, error, isFetching } = useQuery({
    queryKey: ["wallet-statements", cursor],
    queryFn: () => getWalletStatements(cursor),
    placeholderData: keepPreviousData,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <p className="text-gray-500">Error loading statements</p>;
  if (!statements?.items.length) {
    return <p className="text-gray-500">No activity yet</p>;
  }

  return (
    <div className="min-w-[450px] max-w-2xl">
      <h3 className="text-gray-600 mb-4">Activity</h3>
      <div className="space-y-3">
        {statements.items.map((statement) => (
          <Dialog key={statement.id}>
            <DialogTrigger asChild>
              <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      statement.type === "credit"
                        ? "bg-green-50 text-green-600"
                        : "bg-gray-50 text-gray-600"
                    }`}
                  >
                    {statement.icon
                      ? <Icon name={statement.icon} size={16} />
                      : (
                        <Icon
                          name={statement.type === "credit"
                            ? "paid"
                            : "data_usage"}
                          size={16}
                        />
                      )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {statement.title}
                    </p>
                    {statement.description && (
                      <p className="text-sm text-gray-500 overflow-hidden text-ellipsis whitespace-nowrap max-w-[280px]">
                        {statement.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {new Date(statement.timestamp).toLocaleDateString(
                        undefined,
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                </div>
                <p
                  className={`font-medium ${
                    statement.type === "credit"
                      ? "text-green-600"
                      : "text-gray-900"
                  }`}
                >
                  {statement.amountExact}
                </p>
              </div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[525px]">
              <DialogHeader>
                <DialogTitle>Transaction Details</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        statement.type === "credit"
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {statement.icon
                        ? <Icon name={statement.icon} size={20} />
                        : (
                          <Icon
                            name={statement.type === "credit"
                              ? "paid"
                              : "data_usage"}
                            size={20}
                          />
                        )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {statement.title}
                      </p>
                      <p
                        className={`text-lg font-medium ${
                          statement.type === "credit"
                            ? "text-green-600"
                            : "text-gray-900"
                        }`}
                      >
                        {statement.amountExact}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">
                      {new Date(statement.timestamp).toLocaleDateString(
                        undefined,
                        {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                    {statement.description && (
                      <p className="text-sm text-gray-600">
                        {statement.description}
                      </p>
                    )}
                  </div>

                  {statement.metadata && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900">
                        Details
                      </p>
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-gray-100">
                          {Object.entries(statement.metadata).map((
                            [key, value],
                          ) => (
                            <tr key={key}>
                              <td className="py-2 text-gray-500">{key}</td>
                              <td className="py-2 text-gray-900 text-right overflow-hidden text-ellipsis whitespace-nowrap max-w-[100px]">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="block overflow-hidden text-ellipsis whitespace-nowrap">
                                      <span>{value as string}</span>
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {value as string}
                                  </TooltipContent>
                                </Tooltip>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ))}
        {isFetching ? <div>Loading more...</div> : null}
        {statements?.nextCursor && (
          <Button
            className="w-full"
            variant="outline"
            onClick={() => setCursor(statements.nextCursor)}
          >
            Load more
          </Button>
        )}
      </div>
    </div>
  );
}

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function WalletAlert({
  alert,
  remove,
}: {
  alert: WalletUrlAlert;
  remove: () => void;
}) {
  if (alert.type === "success") {
    trackEvent("wallet_credit_success", {
      message: alert.message,
    });
  }

  return (
    <Alert
      variant={alert.type === "success" ? "default" : "destructive"}
      className="relative"
    >
      <AlertTitle>{capitalize(alert.type)}</AlertTitle>
      <AlertDescription>{alert.message}</AlertDescription>
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-2 right-2"
        onClick={remove}
      >
        <Icon name="close" size={16} />
      </Button>
    </Alert>
  );
}

function Wallet() {
  const queryStringAlert = useIncomingUrlAlert();
  const createCheckoutSession = useMutation({
    mutationFn: (amountInCents: number) =>
      createWalletCheckoutSession(amountInCents),
  });
  const user = useUser();
  const [creditAmount, setCreditAmount] = useState("");
  const [amountError, setAmountError] = useState("");

  useEffect(() => {
    if (queryStringAlert.alert?.type === "success") {
      trackEvent("wallet_credit_success", {
        message: queryStringAlert.alert.message,
      });
    }
  }, [queryStringAlert.alert]);

  const userAvatarURL = user?.metadata?.avatar_url ?? undefined;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = parseCurrency(value);
    setCreditAmount(digits);
    setAmountError("");
  };

  const validateAmount = () => {
    const amount = parseInt(creditAmount);
    if (isNaN(amount) || amount < MINIMUM_AMOUNT) {
      setAmountError(
        `Minimum deposit amount is ${
          formatCurrency(MINIMUM_AMOUNT.toString())
        }`,
      );
      return false;
    }
    return true;
  };

  return (
    <div className="flex flex-col gap-4 items-center p-24">
      {queryStringAlert.alert
        ? (
          <WalletAlert
            alert={queryStringAlert.alert}
            remove={queryStringAlert.remove}
          />
        )
        : null}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon name="wallet" size={32} className="text-gray-700" />
          <div className="flex items-center gap-2">
            <Select defaultValue="personal">
              <SelectTrigger className="h-8!">
                <SelectValue placeholder="Select wallet type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="personal">
                  <div className="flex items-center gap-2">
                    <Avatar
                      url={userAvatarURL}
                      fallback={user?.email}
                      className="rounded-full h-5 w-5"
                    />
                    <span>{user?.email}'s wallet</span>
                  </div>
                </SelectItem>
                <SelectItem value="team" disabled>
                  Team Wallet (Coming Soon)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 pt-12 pb-8 items-center">
        <AccountValue />
        <span className="text-gray-700">Balance</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              onClick={() =>
                trackEvent("wallet_add_credits_click", {
                  userId: user?.id,
                })}
            >
              <Icon name="add" />
              Add credits
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add credits to your wallet</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="$0.00"
                  value={creditAmount ? formatCurrency(creditAmount) : ""}
                  onChange={handleAmountChange}
                />
                {amountError && (
                  <p className="text-sm text-red-500">{amountError}</p>
                )}
              </div>
              {createCheckoutSession.error
                ? (
                  <p className="text-red-500">
                    We could not create a checkout session for you now.
                    <br />
                    Please try again later.
                  </p>
                )
                : (
                  <Button
                    disabled={createCheckoutSession.isPending}
                    onClick={async () => {
                      if (!validateAmount()) return;

                      const amount = parseInt(creditAmount);
                      trackEvent("wallet_add_credits_submit", {
                        userId: user?.id,
                        amount: amount,
                        amountInDollars: formatCurrency(amount.toString()),
                      });
                      const result = await createCheckoutSession.mutateAsync(
                        amount,
                      );

                      if (result.checkoutUrl) {
                        globalThis.location.href = result.checkoutUrl;
                      }
                    }}
                  >
                    Add credits
                  </Button>
                )}
            </div>
          </DialogContent>
        </Dialog>
        <div className="pt-12">
          <Activity />
        </div>
      </div>
    </div>
  );
}

export default Wallet;
