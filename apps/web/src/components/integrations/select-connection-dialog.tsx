import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useMemo, useState } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Marketplace,
  type MarketplaceIntegration,
  NEW_CUSTOM_CONNECTION,
} from "./marketplace.tsx";
import { type Integration, useInstallFromMarketplace } from "@deco/sdk";
import { InstalledConnections } from "./installed-connections.tsx";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { trackEvent } from "../../hooks/analytics.ts";
import { IntegrationIcon } from "./common.tsx";
import { useWorkspaceLink } from "../../hooks/use-navigate-workspace.ts";
import { Tabs, TabsList, TabsTrigger } from "@deco/ui/components/tabs.tsx";

type ConnectionsDialogEvent = {
  type: "select_connections";
  integrations: Integration[];
} | {
  type: "start_oauth";
  integration: MarketplaceIntegration;
};

type onEvent = (e: ConnectionsDialogEvent) => void | Promise<void>;

type AddConnectionDialogContentProps = {
  title?: string;
  filter?: (integration: Integration) => boolean;
  forceTab?: "my-connections" | "new-connection";
  myConnectionsEmptyState?: React.ReactNode;
  onEvent: onEvent;
};

type SelectConnectionDialogProps = AddConnectionDialogContentProps & {
  trigger?: React.ReactNode;
};

export function useOAuthInstall() {
  const [installingIntegration, setInstallingIntegration] = useState<
    MarketplaceIntegration | null
  >(null);

  return {
    installingIntegration,
    setInstallingIntegration,
  };
}

export function ConfirmMarketplaceInstallDialog({
  integration,
  setIntegration,
  onConfirm,
}: {
  integration: MarketplaceIntegration | null;
  setIntegration: (integration: MarketplaceIntegration | null) => void;
  onConfirm: ({
    connection,
    authorizeOauthUrl,
  }: {
    connection: Integration;
    authorizeOauthUrl: string | null;
  }) => void;
}) {
  const open = !!integration;
  const { mutate: installIntegration } = useInstallFromMarketplace();
  const [isPending, setIsPending] = useState(false);
  const buildWorkspaceUrl = useWorkspaceLink();

  const handleConnect = () => {
    if (!integration) return;
    setIsPending(true);
    const returnUrl = new URL(
      buildWorkspaceUrl("/connections/success"),
      globalThis.location.origin,
    );

    installIntegration({
      appName: integration.id,
      provider: integration.provider,
      returnUrl: returnUrl.href,
    }, {
      onSuccess: ({ integration: installedIntegration, redirectUrl }) => {
        if (typeof installedIntegration?.id !== "string") {
          setIsPending(false);
          console.error(
            "Installed integration is not a string",
            installedIntegration,
          );
          return;
        }

        setIsPending(false);
        trackEvent("integration_install", {
          success: true,
          data: integration,
        });
        onConfirm({
          connection: installedIntegration,
          authorizeOauthUrl: redirectUrl ?? null,
        });
        setIntegration(null);
      },
      onError: (error) => {
        setIsPending(false);
        trackEvent("integration_install", {
          success: false,
          data: integration,
          error,
        });
      },
    });
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={() => setIntegration(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Connect to {integration.name}
          </DialogTitle>
          <DialogDescription>
            <div className="mt-4">
              <div className="grid grid-cols-[80px_1fr] items-start gap-4">
                <IntegrationIcon
                  icon={integration?.icon}
                />
                <div>
                  <div className="text-sm text-muted-foreground">
                    {integration?.description}
                  </div>
                </div>
              </div>
              {integration.provider !== "deco" && (
                <div className="mt-4 p-3 bg-accent border border-border rounded-xl text-sm">
                  <div className="flex items-center gap-2">
                    <Icon name="info" size={16} />
                    <span className="font-medium">
                      Third-party integration
                    </span>
                  </div>
                  <p className="mt-1">
                    This integration is provided by a third party and is not
                    maintained by deco.
                    <br />
                    Provider:{" "}
                    <span className="font-medium">{integration.provider}</span>
                  </p>
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {isPending
            ? (
              <Button disabled={isPending}>
                Connecting...
              </Button>
            )
            : (
              <Button onClick={handleConnect}>
                Connect
              </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddConnectionDialogContent({
  title = "Add integration",
  filter,
  forceTab,
  myConnectionsEmptyState,
  onEvent,
}: AddConnectionDialogContentProps) {
  const [_tab, setTab] = useState<"my-connections" | "new-connection">(
    "my-connections",
  );
  const tab = forceTab ?? _tab;
  const [search, setSearch] = useState("");
  const createCustomConnection = useCreateCustomConnection();
  const [selectedConnections, setSelectedConnections] = useState<Integration[]>(
    [],
  );
  const showEmptyState = search.length > 0;

  const handleConnectionSelect = (integration: Integration) => {
    setSelectedConnections((prev) => {
      const isSelected = prev.some((conn) => conn.id === integration.id);
      if (isSelected) {
        return prev.filter((conn) => conn.id !== integration.id);
      } else {
        return [...prev, integration];
      }
    });
  };

  const handleConfirmMultiple = () => {
    onEvent({
      type: "select_connections",
      integrations: selectedConnections,
    });
  };

  const isConnectionSelected = (integration: Integration) => {
    return selectedConnections.some((conn) => conn.id === integration.id);
  };

  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row items-center p-4 h-auto">
        <DialogTitle className="text-left w-full">{title}</DialogTitle>
      </DialogHeader>
      {!forceTab && (
        <div className="flex justify-center w-full mt-2 mb-4">
          <Tabs
            value={tab}
            onValueChange={(v) =>
              setTab(v as "my-connections" | "new-connection")}
            className="w-fit"
          >
            <TabsList>
              <TabsTrigger value="new-connection" className="w-48">
                New integration
              </TabsTrigger>
              <TabsTrigger value="my-connections" className="w-48">
                Connected
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}
      <div className="flex flex-col h-[calc(100vh-14rem)] w-full px-8 pb-4">
        <Input
          placeholder="Find integration..."
          value={search}
          className="mb-4 w-full"
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto w-full">
          {tab === "new-connection" && (
            <Marketplace
              filter={search}
              emptyState={
                <div className="flex flex-col h-full min-h-[200px] gap-4">
                  <div className="flex flex-col gap-2 py-8 w-full items-center">
                    <h3 className="text-2xl font-medium">
                      No integrations found for the search "{search}"
                    </h3>
                    <p className="text-sm text-muted-foreground w-full text-center">
                      You can{" "}
                      <Button
                        variant="link"
                        className="px-0"
                        onClick={() => setTab("my-connections")}
                      >
                        create a new custom integration
                      </Button>{" "}
                      instead.
                    </p>
                  </div>
                </div>
              }
              onClick={async (integration) => {
                if (integration.id === NEW_CUSTOM_CONNECTION.id) {
                  await createCustomConnection();
                  return;
                }
                onEvent({
                  type: "start_oauth",
                  integration,
                });
              }}
            />
          )}
          {tab === "my-connections" && (
            <InstalledConnections
              query={search}
              emptyState={showEmptyState
                ? myConnectionsEmptyState ?? (
                  <div className="flex flex-col h-full min-h-[200px] gap-4 pb-16">
                    <div className="w-full flex items-center flex-col gap-2 py-8">
                      <h3 className="text-2xl font-medium">
                        No integrations found
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Create a new integration to get started
                      </p>
                    </div>
                    <Marketplace
                      filter={search}
                      emptyState={
                        <div className="flex flex-col gap-2 py-8 w-full items-center">
                          <p className="text-sm text-muted-foreground">
                            No integrations found for the search "{search}"
                          </p>
                        </div>
                      }
                      onClick={async (integration) => {
                        if (integration.id === NEW_CUSTOM_CONNECTION.id) {
                          await createCustomConnection();
                          return;
                        }
                        onEvent({
                          type: "start_oauth",
                          integration,
                        });
                      }}
                    />
                  </div>
                )
                : null}
              filter={filter}
              onClick={handleConnectionSelect}
              isSelected={isConnectionSelected}
            />
          )}
        </div>
      </div>
      {tab === "my-connections" && selectedConnections.length > 0 && (
        <DialogFooter className="p-2 absolute bottom-0 left-0 right-0 border-t bg-background rounded-b-xl">
          <Button
            onClick={handleConfirmMultiple}
            disabled={selectedConnections.length === 0}
          >
            Select {selectedConnections.length}{" "}
            connection{selectedConnections.length !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      )}
    </DialogContent>
  );
}

export function SelectConnectionDialog(props: SelectConnectionDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useMemo(() => {
    if (props.trigger) {
      return props.trigger;
    }

    return (
      <Button variant="special">
        <span className="hidden md:inline">Add integration</span>
      </Button>
    );
  }, [props.trigger]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <AddConnectionDialogContent
        title={props.title}
        filter={props.filter}
        forceTab={props.forceTab}
        myConnectionsEmptyState={props.myConnectionsEmptyState}
        onEvent={(e) => {
          props.onEvent(e);
          setIsOpen(false);
        }}
      />
    </Dialog>
  );
}
