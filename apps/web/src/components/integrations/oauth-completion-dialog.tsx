import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface OAuthCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  authorizeOauthUrl: string;
  integrationName?: string;
}

export function OAuthCompletionDialog({
  open,
  onOpenChange,
  authorizeOauthUrl,
  integrationName = "the service",
}: OAuthCompletionDialogProps) {
  const handleContinueOAuth = () => {
    globalThis.open(authorizeOauthUrl, "_blank");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Icon name="security" size={20} className="text-primary" />
            </div>
            <div>
              <DialogTitle>Finish Authentication</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left">
            Complete the authentication flow with {integrationName} by clicking
            the link below. This will open in a new tab.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="p-4 bg-accent/50 rounded-lg border border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Icon name="info" size={16} />
              <span>Authentication Required</span>
            </div>
            <p className="text-sm">
              Your browser blocked the popup window. Click the button below to
              continue the authentication process.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleContinueOAuth} className="gap-2">
              <Icon name="open_in_new" size={16} />
              Continue Authentication
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
