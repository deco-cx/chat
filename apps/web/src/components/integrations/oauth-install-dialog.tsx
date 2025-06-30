import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { MarketplaceIntegration } from "./marketplace.tsx";
import { Integration, useDecoOAuthInstall } from "@deco/sdk";
import { IntegrationIcon } from "./common.tsx";
import { useEffect, useState } from "react";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { subscribeToOAuthInstall } from "../../lib/broadcast-channels.ts";

const DECO_CHAT_ICON =
  "https://assets.decocache.com/mcp/306fcf27-d5dd-4d8c-8ddd-567d763372ee/decochat.png";

interface OAuthSuccessInstallProps {
  mcpUrl: string;
}

interface OAuthInstallDialogProps {
  installingIntegration: MarketplaceIntegration | null;
  onCancel: () => void;
  onOAuthSuccess: (props: OAuthSuccessInstallProps) => void;
  onOAuthError: (error: Error) => void;
}

function getInstallTitle(integration: MarketplaceIntegration | null) {
  if (!integration) {
    return "Could not find integration";
  }

  if (integration.provider === "composio") {
    return `Connect to ${integration.name} via Composio`;
  }

  return `Connect to ${integration.name}`;
}

function getBelowButtonDescription(integration: MarketplaceIntegration | null) {
  if (!integration) {
    return <span>Could not find integration</span>;
  }

  if (integration.provider === "composio") {
    return (
      <span className="text-xs text-muted-foreground text-center">
        Third-party integration provided by{" "}
        <a href="https://composio.dev" target="_blank" className="underline">
          Composio
        </a>.
      </span>
    );
  }

  if (integration.provider === "deco") {
    return (
      <span className="text-xs text-muted-foreground text-center">
        Connect directly to deco.chat.
      </span>
    );
  }

  return (
    <span className="text-xs text-muted-foreground text-center">
      Third-party integration provided by {integration.provider}.
    </span>
  );
}

function IconsState({
  leftIcon,
  rightIcon,
  center,
}: {
  leftIcon: string;
  rightIcon: string;
  center: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center relative gap-4">
      <IntegrationIcon
        icon={leftIcon}
        className="w-14 h-14"
      />
      <div className="absolute z-20 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        {center}
      </div>
      <IntegrationIcon
        icon={rightIcon}
        className="w-14 h-14"
      />
    </div>
  );
}

function IdleConnect({
  integration,
  onStartOAuth,
}: {
  integration: MarketplaceIntegration;
  onStartOAuth: () => void;
}) {
  const title = getInstallTitle(integration);
  const belowButtonDescription = getBelowButtonDescription(
    integration,
  );
  return (
    <DialogContent className="max-w-md flex flex-col gap-6 items-center">
      <IconsState
        leftIcon={integration.icon ?? ""}
        rightIcon={DECO_CHAT_ICON}
        center={
          <div className="w-6 h-6 border border-border rounded-md grid place-items-center bg-background">
            <Icon name="sync_alt" size={16} className="text-muted-foreground" />
          </div>
        }
      />
      <h5 className="text-xl font-semibold">{title}</h5>
      <p className="text-sm text-center">
        {integration.description}
      </p>
      <div className="w-full flex flex-col gap-2">
        <Button onClick={onStartOAuth}>
          Connect
        </Button>
        {belowButtonDescription}
      </div>
    </DialogContent>
  );
}

function WaitingForAuthorization({
  integration,
  onCancel,
}: {
  integration: MarketplaceIntegration;
  onCancel: () => void;
}) {
  return (
    <DialogContent className="max-w-md flex flex-col gap-6 items-center text-center">
      <IconsState
        leftIcon={integration.icon ?? ""}
        rightIcon={DECO_CHAT_ICON}
        center={
          <div className="w-6 h-6 border border-border rounded-md grid place-items-center bg-background">
            <Icon name="sync_alt" size={16} className="text-muted-foreground" />
          </div>
        }
      />
      <h5 className="text-xl font-semibold">Waiting for authorization...</h5>
      <p className="text-sm">
        Almost there! Waiting for you to authorize the connection.
      </p>
      <Button onClick={onCancel} variant="outline" className="w-full">
        Cancel
      </Button>
    </DialogContent>
  );
}

function OAuthSuccessInstall({
  integration,
  onClose,
}: {
  integration: MarketplaceIntegration;
  onClose: () => void;
}) {
  return (
    <DialogContent className="max-w-md flex flex-col gap-6 items-center text-center">
      <IconsState
        leftIcon={integration.icon ?? ""}
        rightIcon={DECO_CHAT_ICON}
        center={
          <div className="w-16 h-16 rounded-full grid place-items-center bg-primary-light/10">
            <div className="w-10 h-10 rounded-full grid place-items-center bg-primary-light/50">
              <Icon
                name="check_circle"
                size={24}
                filled
                className="text-primary-light bg-background rounded-full"
              />
            </div>
          </div>
        }
      />
      <h5 className="text-xl font-semibold">Connected!</h5>
      <p className="text-sm">
        {integration.name}{" "}
        is now connected to your deco.chat workspace. You can start using it
        right away.
      </p>
      <Button onClick={onClose} className="w-full">
        Continue
      </Button>
    </DialogContent>
  );
}

function OAuthErrorInstall({
  integration,
  onClose,
}: {
  integration: MarketplaceIntegration;
  onClose: () => void;
}) {
  return (
    <DialogContent className="max-w-md flex flex-col gap-6 items-center text-center">
      <IconsState
        leftIcon={integration.icon ?? ""}
        rightIcon={DECO_CHAT_ICON}
        center={
          <div className="w-16 h-16 rounded-full grid place-items-center bg-destructive/10">
            <div className="w-10 h-10 rounded-full grid place-items-center bg-destructive/50">
              <Icon
                name="error"
                size={24}
                filled
                className="text-destructive bg-background rounded-full"
              />
            </div>
          </div>
        }
      />
      <h5 className="text-xl font-semibold">Connection failed</h5>
      <p className="text-sm">
        We couldn&apos;t connect to{" "}
        {integration.name}. Please check your credentials and try again.
      </p>
      <Button onClick={onClose} className="w-full">
        Close
      </Button>
    </DialogContent>
  );
}

export function OAuthInstallDialog({
  installingIntegration,
  onCancel,
  onOAuthSuccess,
  onOAuthError,
}: OAuthInstallDialogProps) {
  const [state, setState] = useState<
    "idle" | "waiting-for-authorization" | "success" | "error"
  >("idle");
  const open = !!installingIntegration;
  const { getAuthUrl } = useDecoOAuthInstall();
  const buildWorkspaceUrl = useWorkspaceLink();
  const [waitingForInstallId, setWaitingForInstallId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!waitingForInstallId) {
      return;
    }

    const unsubscribe = subscribeToOAuthInstall(
      waitingForInstallId,
      (message) => {
        if (message.type === "OAUTH_FINISHED") {
          setState("success");
        } else if (message.type === "OAUTH_ERROR") {
          setState("error");
        }
      },
    );

    return () => unsubscribe();
  }, [waitingForInstallId]);

  const handleStartOAuth = async () => {
    if (!installingIntegration) {
      return;
    }
    const installId = crypto.randomUUID();
    const returnUrl = new URL(
      buildWorkspaceUrl("/connections/success"),
      globalThis.location.origin,
    );
    setState("waiting-for-authorization");
    const { redirectUrl } = await getAuthUrl({
      appName: installingIntegration.name,
      installId,
      returnUrl: returnUrl.href,
    });
    globalThis.open(redirectUrl, "_blank");
    setWaitingForInstallId(installId);
  };

  return (
    <Dialog open={open} onOpenChange={onCancel}>
      {installingIntegration
        ? (
          <>
            {state === "idle" && (
              <IdleConnect
                integration={installingIntegration}
                onStartOAuth={handleStartOAuth}
              />
            )}
            {state === "waiting-for-authorization" && (
              <WaitingForAuthorization
                integration={installingIntegration}
                onCancel={onCancel}
              />
            )}
            {state === "success" && (
              <OAuthSuccessInstall
                integration={installingIntegration}
                onClose={onCancel}
              />
            )}
            {state === "error" && (
              <OAuthErrorInstall
                integration={installingIntegration}
                onClose={onCancel}
              />
            )}
          </>
        )
        : null}
    </Dialog>
  );
}
