import {
  getRegistryApp,
  useMarketplaceIntegrations,
  type Integration,
} from "@deco/sdk";
import { AppName } from "@deco/sdk/common";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  useEffect,
  useMemo,
  useState,
  useRef,
  createContext,
  useContext,
  Dispatch,
  SetStateAction,
} from "react";
import { useSearchParams } from "react-router";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCreateCustomConnection } from "../../hooks/use-create-custom-connection.ts";
import { useIntegrationInstall } from "../../hooks/use-integration-install.tsx";
import {
  useNavigateWorkspace,
  useWorkspaceLink,
} from "../../hooks/use-navigate-workspace.ts";
import { IntegrationBindingForm } from "../integration-oauth.tsx";
import { IntegrationIcon } from "./common.tsx";
import { InstalledConnections } from "./installed-connections.tsx";
import {
  Marketplace,
  NEW_CUSTOM_CONNECTION,
  type MarketplaceIntegration,
} from "./marketplace.tsx";
import { OAuthCompletionDialog } from "./oauth-completion-dialog.tsx";
import { UseFormReturn } from "react-hook-form";
import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import {
  GridContainer,
  GridLeftColumn,
  GridRightColumn,
} from "./shared-components.tsx";
import { WalletBalanceAlert } from "../common/wallet-balance-alert.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";

const isDependency = (property: JSONSchema7Definition) =>
  typeof property === "object" && property.properties?.__type;

export interface OauthModalState {
  open: boolean;
  url: string;
  integrationName: string;
  connection: Integration | null;
  openIntegrationOnFinish: boolean;
}
interface OauthModalContextType {
  onOpenOauthModal: Dispatch<SetStateAction<OauthModalState>>;
}
export const OauthModalContextProvider = createContext<
  OauthModalContextType | undefined
>(undefined);
export const useOauthModalContext = () => {
  const context = useContext(OauthModalContextProvider);
  if (!context) {
    console.warn(
      "useOauthModalContext must be used within a OauthModalContextProvider",
    );
  }
  return context;
};

function IntegrationWorkspaceIconForMarketplace({
  integration,
}: {
  integration: MarketplaceIntegration | null;
}) {
  return (
    <div className="absolute -translate-y-1/2">
      <IntegrationIcon
        icon={integration?.icon}
        name={integration?.friendlyName ?? integration?.name}
        size="xl"
      />
    </div>
  );
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
  const open = useMemo(() => !!integration, [integration]);
  const { install, integrationState, isLoading } = useIntegrationInstall(
    integration?.name,
  );
  const formRef = useRef<UseFormReturn<Record<string, unknown>> | null>(null);
  const buildWorkspaceUrl = useWorkspaceLink();
  const navigateWorkspace = useNavigateWorkspace();
  const [stepIndex, setStepIndex] = useState(0);

  const { dependencies: maybeAppDependencyList, app: maybeAppList } =
    useMemo(() => {
      if (!integrationState.schema?.properties)
        return { dependencies: null, app: null };

      const result = { dependencies: [] as string[], app: [] as string[] };

      for (const propertyEntry of Object.entries(
        integrationState.schema.properties,
      )) {
        const [name, property] = propertyEntry;
        if (isDependency(property)) {
          result.dependencies.push(name);
        } else {
          result.app.push(name);
        }
      }
      return result;
    }, [integrationState.schema]);

  const dependenciesSteps = maybeAppDependencyList?.length
    ? maybeAppDependencyList.length
    : 0;
  const appSteps = maybeAppList?.length ? 1 : 0;
  const totalSteps = dependenciesSteps + appSteps;
  const isDepencencyStep = stepIndex < dependenciesSteps;

  const currentSchema = useMemo<JSONSchema7 | undefined>(() => {
    if (isDepencencyStep) {
      const dependencyName = maybeAppDependencyList?.[stepIndex] ?? "";
      const dependencySchema =
        integrationState.schema?.properties?.[dependencyName] ?? {};
      return {
        type: "object",
        properties: {
          [dependencyName]: dependencySchema,
        },
        required: [dependencyName],
      } satisfies JSONSchema7;
    } else {
      const properties: Record<string, JSONSchema7Definition> =
        maybeAppList?.reduce(
          (acc, app) => {
            acc[app] = integrationState.schema?.properties?.[
              app
            ] as JSONSchema7Definition;
            return acc;
          },
          {} as Record<string, JSONSchema7Definition>,
        ) ?? {};

      return {
        type: "object",
        properties,
        required: maybeAppList ? maybeAppList : undefined,
      } satisfies JSONSchema7;
    }
  }, [totalSteps, stepIndex, integrationState.schema]);

  const handleConnect = async () => {
    if (!integration) return;

    const returnUrl = new URL(
      buildWorkspaceUrl("/connections/success"),
      globalThis.location.origin,
    );

    // Combine all dependency form data with main form data
    const mainFormData = formRef.current?.getValues() ?? {};
    try {
      const result = await install(
        {
          appId: integration.id,
          appName: integration.name,
          provider: integration.provider,
          returnUrl: returnUrl.href,
        },
        mainFormData,
      );

      if (typeof result.integration?.id !== "string") {
        console.error(
          "Installed integration is not a string",
          result.integration,
        );
        return;
      }

      trackEvent("integration_install", {
        success: true,
        data: integration,
      });

      // Only call onConfirm if we have a redirect URL (traditional OAuth flow)
      // For stateSchema, the modal will handle the completion
      if (result.redirectUrl) {
        onConfirm({
          connection: result.integration,
          authorizeOauthUrl: result.redirectUrl,
        });
        setIntegration(null);
      } else if (result.stateSchema) {
        onConfirm({
          connection: result.integration,
          authorizeOauthUrl: null,
        });
        setIntegration(null);
      } else if (!result.stateSchema) {
        let link = `/connection/${integration.provider}:::${integration.name}`;
        const isDecoApp = integration.name.startsWith("@deco/");
        if (
          result.redirectUrl === null &&
          isDecoApp &&
          integration.friendlyName
        ) {
          // special case for non oauth-apps
          link = `/connection/deco:::${integration.friendlyName}`;
        }
        navigateWorkspace(link);
        setIntegration(null);
      }
    } catch (error) {
      trackEvent("integration_install", {
        success: false,
        data: integration,
        error,
      });
    }
  };

  // Reset step when dialog closes/opens
  useEffect(() => {
    if (open) {
      setStepIndex(0);
    }
  }, [open]);

  const handleNextDependency = () => {
    // for cases where the app doesn't have dependencies (schema doesn't exist)
    if (!integrationState.schema) {
      handleConnect();
      return;
    }

    if (!maybeAppDependencyList) return;

    if (stepIndex < totalSteps - 1) {
      // Move to next dependency
      setStepIndex((prev) => prev + 1);
    } else {
      // All dependencies and apps configured, install the main app
      handleConnect();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex((prev) => prev - 1);
    }
  };

  if (!integration) return null;

  return (
    <Dialog open={open} onOpenChange={() => setIntegration(null)}>
      <DialogContent className="!p-0 lg:!w-220 lg:!max-w-220 flex flex-col overflow-y-hidden">
        {/* Dependency Steps */}
        <div className="min-h-135 max-h-135 h-full lg:max-h-[60vh] border-b">
          <DependencyStep
            integration={integration}
            dependencyName={maybeAppDependencyList?.[stepIndex]}
            dependencySchema={currentSchema}
            currentStep={stepIndex + 1}
            totalSteps={totalSteps}
            formRef={formRef}
            integrationState={integrationState}
          />
        </div>
        <DialogFooter className="px-4 pb-4">
          {stepIndex > 0 && (
            <Button variant="outline" disabled={isLoading} onClick={handleBack}>
              Back
            </Button>
          )}
          <Button
            variant="special"
            onClick={
              isLoading || integrationState.isLoading
                ? undefined
                : handleNextDependency
            }
            disabled={isLoading || integrationState.isLoading}
          >
            {isLoading || integrationState.isLoading
              ? "Connecting..."
              : stepIndex < totalSteps - 1
                ? "Continue"
                : "Allow access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Dependency Configuration Step
function DependencyStep({
  integration,
  dependencyName,
  dependencySchema,
  currentStep,
  totalSteps,
  formRef,
  integrationState,
}: {
  integration: MarketplaceIntegration;
  dependencyName?: string;
  dependencySchema?: JSONSchema7;
  currentStep: number;
  totalSteps: number;
  formRef: React.RefObject<UseFormReturn<Record<string, unknown>> | null>;
  integrationState: {
    permissions?: Array<{ scope: string; description: string; app?: string }>;
  };
}) {
  const { data: marketplace } = useMarketplaceIntegrations();
  const dependencyIntegration = useMemo(() => {
    if (!dependencySchema || !dependencyName) return null;

    const internalSchema = dependencySchema.properties?.[dependencyName];
    const name =
      typeof internalSchema === "object" &&
      ((internalSchema?.properties?.__type as JSONSchema7)?.const as
        | string
        | undefined);
    if (typeof name !== "string") return null;

    return (
      (marketplace?.integrations.find(
        (integration) => integration.name === name,
      ) as MarketplaceIntegration | null) ?? null
    );
  }, [dependencySchema, dependencyName]);
  const permissionsFromThisDependency = useMemo(
    () =>
      integrationState.permissions?.filter(
        (permission) => permission.app === dependencyIntegration?.name,
      ),
    [dependencyIntegration?.name, integrationState.permissions],
  );

  const schema = dependencySchema;

  return (
    <GridContainer className="lg:max-h-[60vh] max-h-135 min-h-135">
      {/* Left side: App icons and info */}
      <GridLeftColumn>
        <div className="pb-4 px-4 h-full">
          <IntegrationWorkspaceIconForMarketplace integration={integration} />

          <div className="h-full flex flex-col justify-between pt-16">
            <h3 className="text-xl text-base-foreground">
              <span className="font-bold">
                {integration.friendlyName ?? integration.name}
              </span>{" "}
              needs access to the following permissions:
            </h3>

            {/* Warning at bottom left */}
            {/* TODO: identify when integration consume from wallet */}
            <div>
              <WalletBalanceAlert />
            </div>
          </div>
        </div>
      </GridLeftColumn>

      {/* Right side: Dependency configuration */}
      <GridRightColumn>
        <div className="h-full flex flex-col gap-2 pr-4 pt-4">
          {/* Header with step indicator */}
          <div className="flex items-center justify-between py-2 border-b">
            <div className="font-mono text-sm text-foreground uppercase tracking-wide">
              connect requirements
            </div>
            {totalSteps > 1 && (
              <div className="flex items-center gap-2.5">
                <div className="font-mono text-sm uppercase text-foreground">
                  <span className="text-muted-foreground">{currentStep}</span> /{" "}
                  {totalSteps}
                </div>
              </div>
            )}
          </div>

          {/* Dependency integration info */}
          <div className="flex-grow flex flex-col gap-5 py-2">
            {/* Configuration Form */}
            <div className="max-h-[200px] overflow-y-auto">
              {schema && (
                <div className="flex justify-between items-center gap-2">
                  {dependencyIntegration && (
                    <div className="flex items-center gap-2">
                      <IntegrationIcon
                        icon={dependencyIntegration?.icon}
                        name={
                          dependencyIntegration?.friendlyName ??
                          dependencyIntegration?.name
                        }
                        size="lg"
                      />
                      {dependencyIntegration?.friendlyName ??
                        dependencyIntegration?.name}
                    </div>
                  )}
                  <IntegrationBindingForm schema={schema} formRef={formRef} />
                </div>
              )}
            </div>
            {/* Permissions Section */}
            <div className="flex-grow flex flex-col gap-2">
              <div className="font-mono text-sm text-secondary-foreground uppercase">
                permissions
              </div>
              <ScrollArea className="flex-grow h-0">
                {permissionsFromThisDependency?.map((permission, index) => (
                  <div key={index} className="flex gap-4 items-start px-2 py-3">
                    <div className="flex gap-2.5 h-5 items-center justify-start">
                      <Icon
                        name="check_circle"
                        size={20}
                        className="text-success flex-shrink-0"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="text-sm font-medium text-foreground">
                        {permission.scope}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {permission.description}
                      </div>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>
        </div>
      </GridRightColumn>
    </GridContainer>
  );
}

function AddConnectionDialogContent({
  title = "Add integration",
  filter,
  onSelect,
  forceTab,
  myConnectionsEmptyState,
  appName,
}: {
  title?: string;
  filter?: (integration: Integration) => boolean;
  onSelect?: (integration: Integration) => void;
  forceTab?: "my-connections" | "new-connection";
  myConnectionsEmptyState?: React.ReactNode;
  appName?: string;
}) {
  const [_tab, setTab] = useState<"my-connections" | "new-connection">(
    "my-connections",
  );
  const tab = forceTab ?? _tab;
  const [search, setSearch] = useState("");
  const createCustomConnection = useCreateCustomConnection();
  const { data: marketplace } = useMarketplaceIntegrations();
  const [installingIntegration, setInstallingIntegration] =
    useState<MarketplaceIntegration | null>(() => {
      if (!appName) return null;
      return (
        marketplace?.integrations.find(
          (integration) => integration.appName === appName,
        ) ?? null
      );
    });
  const [oauthCompletionDialog, setOauthCompletionDialog] =
    useState<OauthModalState>({
      open: false,
      url: "",
      integrationName: "",
      connection: null,
      openIntegrationOnFinish: true,
    });
  const navigateWorkspace = useNavigateWorkspace();
  const showEmptyState = search.length > 0;
  const handleInstallFromRegistry = async (appName: string) => {
    const app = await getRegistryApp({ name: appName ?? "" });
    setInstallingIntegration({
      ...app,
      name: AppName.build(app.scopeName, app.name),
      provider: "marketplace",
    });
  };

  useEffect(() => {
    if (appName) {
      handleInstallFromRegistry(appName);
    }
  }, [appName]);
  return (
    <DialogContent
      className="p-0 min-w-[80vw] min-h-[80vh] gap-0"
      closeButtonClassName="top-5 right-4"
    >
      <DialogHeader className="flex flex-row justify-between items-center p-2 h-14 px-5 pr-12">
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="flex h-[calc(100vh-10rem)]">
        {!forceTab && (
          <aside className="w-56 flex flex-col p-4 gap-1">
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-muted-foreground",
                tab === "my-connections" && "bg-muted text-foreground",
              )}
              onClick={() => setTab("my-connections")}
            >
              <Icon
                name="widgets"
                size={16}
                className="text-muted-foreground"
              />
              <span>My integrations</span>
            </Button>
            <Button
              variant="ghost"
              className={cn(
                "w-full justify-start text-muted-foreground",
                tab === "new-connection" && "bg-muted text-foreground",
              )}
              onClick={() => setTab("new-connection")}
            >
              <Icon name="add" size={16} className="text-muted-foreground" />
              <span>New integration</span>
            </Button>
            <Button
              variant="ghost"
              className={cn("w-full justify-start text-muted-foreground group")}
              onClick={() => navigateWorkspace("/connections")}
            >
              <Icon name="arrow_outward" size={16} />
              <span className="group-hover:underline">Manage integrations</span>
            </Button>
            {/* Filters will go here */}
          </aside>
        )}

        <div className="h-full overflow-y-hidden p-4 pb-20 w-full">
          <Input
            placeholder="Find integration..."
            value={search}
            className="mb-4"
            onChange={(e) => setSearch(e.target.value)}
          />
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
                setInstallingIntegration(integration);
              }}
            />
          )}
          {tab === "my-connections" && (
            <InstalledConnections
              query={search}
              emptyState={
                showEmptyState
                  ? (myConnectionsEmptyState ?? (
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
                            setInstallingIntegration(integration);
                          }}
                        />
                      </div>
                    ))
                  : null
              }
              filter={filter}
              onClick={(integration) => onSelect?.(integration)}
            />
          )}
        </div>
      </div>
      <OauthModalContextProvider.Provider
        value={{ onOpenOauthModal: setOauthCompletionDialog }}
      >
        <ConfirmMarketplaceInstallDialog
          integration={installingIntegration}
          setIntegration={setInstallingIntegration}
          onConfirm={({ connection, authorizeOauthUrl }) => {
            if (authorizeOauthUrl) {
              const popup = globalThis.open(authorizeOauthUrl, "_blank");
              if (
                !popup ||
                popup.closed ||
                typeof popup.closed === "undefined"
              ) {
                setOauthCompletionDialog({
                  openIntegrationOnFinish: true,
                  open: true,
                  url: authorizeOauthUrl,
                  integrationName: installingIntegration?.name || "the service",
                  connection: connection,
                });
              } else {
                onSelect?.(connection);
              }
            } else {
              onSelect?.(connection);
            }
          }}
        />
      </OauthModalContextProvider.Provider>

      <OAuthCompletionDialog
        open={oauthCompletionDialog.open}
        onOpenChange={(open) => {
          setOauthCompletionDialog((prev) => ({ ...prev, open }));
          if (
            oauthCompletionDialog.connection &&
            oauthCompletionDialog.openIntegrationOnFinish
          ) {
            onSelect?.(oauthCompletionDialog.connection);
          }
        }}
        authorizeOauthUrl={oauthCompletionDialog.url}
        integrationName={oauthCompletionDialog.integrationName}
      />
    </DialogContent>
  );
}

interface SelectConnectionDialogProps {
  trigger?: React.ReactNode;
  title?: string;
  filter?: (integration: Integration) => boolean;
  onSelect?: (integration: Integration) => void;
  forceTab?: "my-connections" | "new-connection";
  myConnectionsEmptyState?: React.ReactNode;
}

export function SelectConnectionDialog(props: SelectConnectionDialogProps) {
  const [query] = useSearchParams();
  const appName = query.get("appName");
  const [isOpen, setIsOpen] = useState(!!appName);

  const trigger = useMemo(() => {
    if (props.trigger) {
      return props.trigger;
    }

    return (
      <Button variant="special">
        <span className="hidden md:inline">Install Apps</span>
      </Button>
    );
  }, [props.trigger]);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <AddConnectionDialogContent
        title={props.title}
        filter={props.filter}
        forceTab={props.forceTab}
        myConnectionsEmptyState={props.myConnectionsEmptyState}
        onSelect={(integration) => {
          props.onSelect?.(integration);
          setIsOpen(false);
        }}
        appName={appName ?? undefined}
      />
    </Dialog>
  );
}
