import { useState, useEffect } from "react";
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
import { toast } from "@deco/ui/components/sonner.tsx";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUser } from "../../hooks/use-user.ts";
import {
  createWalletCheckoutSession,
  Markup,
  usePlan,
  useSDK,
} from "@deco/sdk";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { useSearchParams } from "react-router";

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

function useDepositDialog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isOpen, setIsOpen] = useState(searchParams.has("add_credits"));

  useEffect(() => {
    // Handle deposit success/failure toasts
    const depositSuccess = searchParams.get("deposit_success");
    if (depositSuccess !== null) {
      if (depositSuccess === "true") {
        toast.success(
          "Deposit successful! Your credits have been added to your wallet.",
        );
      } else {
        toast.error("Deposit was cancelled or failed. Please try again.");
      }

      // Clean up the URL parameter
      searchParams.delete("deposit_success");
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  return {
    isOpen,
    setIsOpen,
  };
}

export function DepositDialog() {
  const { workspace } = useSDK();
  const workspaceLink = useWorkspaceLink();
  const plan = usePlan();
  const { isOpen, setIsOpen } = useDepositDialog();

  const createCheckoutSession = useMutation({
    mutationFn: (amountInCents: number) =>
      createWalletCheckoutSession({
        workspace,
        amountUSDCents: amountInCents,
        successUrl: `${location.origin}${workspaceLink("/monitor/billing?deposit_success=true")}`,
        cancelUrl: `${location.origin}${workspaceLink("/monitor/billing?deposit_success=false")}`,
      }),
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
        `Minimum deposit amount is ${formatCurrency(
          MINIMUM_AMOUNT.toString(),
        )}`,
      );
      return false;
    }
    return true;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="special"
          className="w-full"
          onClick={() =>
            trackEvent("wallet_add_credits_click", { userId: user?.id })
          }
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
              <p className="text-sm text-destructive">{amountError}</p>
            )}
          </div>
          {creditAmount &&
            !amountError &&
            parseInt(creditAmount) >= MINIMUM_AMOUNT && (
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Credit amount:</span>
                  <span>{formatCurrency(creditAmount)}</span>
                </div>
                {plan.markup > 0 && (
                  <>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">
                        Your plan deposit fee ({plan.markup}%):
                      </span>
                      <span>
                        {formatCurrency(
                          (
                            Markup.add({
                              usdCents: parseInt(creditAmount),
                              markupPercentage: plan.markup,
                            }) - parseInt(creditAmount)
                          ).toString(),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-medium pt-2 border-t border-border mt-2">
                      <span>Total charge:</span>
                      <span>
                        {formatCurrency(
                          Markup.add({
                            usdCents: parseInt(creditAmount),
                            markupPercentage: plan.markup,
                          }).toString(),
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          {createCheckoutSession.error ? (
            <p className="text-destructive text-sm">
              We could not create a checkout session for you now.
              <br />
              Please try again later.
            </p>
          ) : null}
          <Button
            disabled={createCheckoutSession.isPending}
            variant="special"
            onClick={async () => {
              if (!validateAmount()) return;
              const amount = parseInt(creditAmount);
              trackEvent("wallet_add_credits_submit", {
                userId: user?.id,
                amount: amount,
                amountInDollars: formatCurrency(amount.toString()),
              });
              const result = await createCheckoutSession.mutateAsync(amount);
              if (result.url) {
                globalThis.location.href = result.url;
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
