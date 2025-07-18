import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { useState } from "react";
import { type Country, PhoneInput } from "../settings/profile.tsx";

interface WhatsAppInviteDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (phoneNumber: string) => void;
  isLoading?: boolean;
}

export function WhatsAppInviteDialog({
  isOpen,
  onOpenChange,
  onSubmit,
  isLoading = false,
}: WhatsAppInviteDialogProps) {
  const [dialCode, setDialCode] = useState("+1");
  const [localValue, setLocalValue] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [fullPhone, setFullPhone] = useState("");
  const [_error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSubmit(fullPhone);
    setFullPhone("");
    onOpenChange(false);
  };

  const handleCancel = () => {
    setFullPhone("");
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to WhatsApp</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <PhoneInput
            dialCode={dialCode}
            country={country}
            localValue={localValue}
            fullPhone={fullPhone}
            isDisabled={isLoading}
            setDialCode={setDialCode}
            setCountry={setCountry}
            setLocalValue={setLocalValue}
            setFullPhone={setFullPhone}
            setError={setError}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancel}
              type="button"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
