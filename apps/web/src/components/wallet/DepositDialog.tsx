import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/data/useUser.ts";
import { createWalletCheckoutSession } from "@deco/sdk";

const MINIMUM_AMOUNT = 200; // $2.00 in cents

function formatCurrency(value: string) {
  const digits = value.replace(/\D/g, "");
  const amount = parseFloat(digits) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function parseCurrency(value: string) {
  return value.replace(/\D/g, "");
}

export function DepositDialog() {
  const createCheckoutSession = useMutation({
    mutationFn: (amountInCents: number) =>
      createWalletCheckoutSession(amountInCents),
  });
  const user = useUser();
  const [creditAmount, setCreditAmount] = useState("");
  const [amountError, setAmountError] = useState("");

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const digits = parseCurrency(value);
    setCreditAmount(digits);
    setAmountError("");
  };

  function validateAmount() {
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
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          className="py-4 px-10"
          size="lg"
          onClick={() =>
            trackEvent("wallet_add_credits_click", { userId: user?.id })}
        >
          <Icon name="add" size={16} className="mr-2" />
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
              <p className="text-red-500 text-sm">
                We could not create a checkout session for you now.<br />Please
                try again later.
              </p>
            )
            : null}
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
              const result = await createCheckoutSession.mutateAsync(amount);
              if (result.checkoutUrl) {
                globalThis.location.href = result.checkoutUrl;
              }
            }}
          >
            {createCheckoutSession.error ? "Try again" : "Add credits"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
