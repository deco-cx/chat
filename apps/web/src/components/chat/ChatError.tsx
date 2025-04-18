import { Icon } from "@deco/ui/components/icon.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Link } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";

const WELL_KNOWN_ERROR_MESSAGES = {
  InsufficientFunds: "Insufficient funds",
};

interface ChatErrorProps {
  error: Error;
  onRetry?: (context?: string[]) => void;
}

export function ChatError({ error, onRetry }: ChatErrorProps) {
  if (error.message.includes(WELL_KNOWN_ERROR_MESSAGES.InsufficientFunds)) {
    trackEvent("chat_error_insufficient_funds", {
      error,
    });
    return (
      <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 ml-3">
        <div className="flex w-full justify-between p-4 bg-destructive/5 text-destructive rounded-xl text-sm">
          <div className="flex items-center gap-4">
            <Icon name="info" />
            <p>Insufficient funds</p>
          </div>
          <div className="flex items-center justify-end">
            <Button
              size="sm"
              variant="secondary"
              className="bg-background hover:bg-background/80 shadow-none border border-input py-3 px-4 h-10"
              asChild
            >
              <Link to="/wallet">
                <Icon name="wallet" className="mr-2" />
                Add funds to your wallet
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 ml-3">
      <div className="flex items-center gap-4 p-4 bg-destructive/5 text-destructive rounded-xl text-sm">
        <Icon name="info" />
        <p>An error occurred while generating the response.</p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="bg-background hover:bg-background/80 shadow-none border border-input py-3 px-4 h-10"
            onClick={() => {
              onRetry?.([
                JSON.stringify({
                  type: "error",
                  message: error.message,
                  name: error.name,
                  stack: error.stack,
                }),
                "The previous attempt resulted in an error. I'll try to address the error and provide a better response.",
              ]);
            }}
          >
            <Icon name="refresh" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
