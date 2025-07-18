import { redeemWalletVoucher, useSDK } from "@deco/sdk";
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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export function VoucherDialog() {
  const [voucher, setVoucher] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const { workspace } = useSDK();
  const queryClient = useQueryClient();

  const { mutate: redeemVoucher, isPending } = useMutation({
    mutationFn: () => redeemWalletVoucher({ workspace, voucher }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      setIsOpen(false);
      setVoucher("");
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <Icon name="redeem" size={16} className="mr-2" />
          Redeem voucher
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Redeem voucher</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="code" className="text-sm font-medium">
              Voucher Code
            </label>
            <Input
              id="voucher"
              value={voucher}
              onChange={(e) => setVoucher(e.target.value)}
              placeholder="Enter your voucher code"
              className="w-full"
            />
          </div>
          <Button
            onClick={() => redeemVoucher()}
            disabled={!voucher || isPending}
            className="w-full"
          >
            {isPending ? "Redeeming..." : "Redeem"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
