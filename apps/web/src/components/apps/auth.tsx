import {
  type Integration,
  RegistryAppNotFoundError,
  SDKProvider,
  useCreateOAuthCodeForIntegration,
  useIntegrations,
  type Workspace,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Combobox } from "@deco/ui/components/combobox.tsx";
import { useEffect, useMemo, useState, Suspense } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@deco/ui/lib/utils.ts";
import { useUser } from "../../hooks/use-user.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { type CurrentTeam, useUserTeams } from "../sidebar/team-selector.tsx";
import { AppsAuthLayout, OAuthSearchParams } from "./layout.tsx";
import { useRegistryApp, type RegistryApp } from "@deco/sdk";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useInstallCreatingApiKeyAndIntegration } from "../../hooks/use-integration-install-with-modal.tsx";
import { FormProvider, useForm } from "react-hook-form";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@deco/ui/components/accordion.tsx";
import JsonSchemaForm from "../json-schema/index.tsx";
import { generateDefaultValues } from "../json-schema/utils/generate-default-values.ts";
import {
  useMarketplaceAppSchema,
  usePermissionDescriptions,
  type AppScope,
} from "@deco/sdk/hooks";
import type { JSONSchema7 } from "json-schema";
import { VerifiedBadge } from "../integrations/marketplace.tsx";

const preSelectTeam = (
  teams: CurrentTeam[],
  workspace_hint: string | undefined,
) => {
  if (teams.length === 1) {
    return teams[0];
  }

  if (!workspace_hint) {
    return null;
  }

  return (
    teams.find(
      (team) =>
        team.slug === workspace_hint ||
        team.slug === workspace_hint.split("/").pop(),
    ) ?? null
  );
};

const useAppIntegrations = (appName: string) => {
  const { data: allIntegrations } = useIntegrations();
  return allIntegrations?.filter((integration) => {
    if ("appName" in integration) {
      return integration.appName === appName;
    }
    return false;
  });
};

const NoAppFound = ({ client_id }: { client_id: string }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">App not found</h1>
        <div className="flex flex-col gap-2 text-sm text-muted-foreground max-w-sm text-left">
          <p>
            The app you are trying to authorize (
            <span className="font-semibold">{client_id}</span>) does not exist.
          </p>
          <div className="w-full">
            <div className="border rounded-lg p-4 bg-muted flex flex-col items-start gap-2">
              <div className="flex items-center gap-2">
                <Icon name="info" size={16} />
                <span className="font-medium">
                  Maybe you forgot to publish it?
                </span>
              </div>
              <a
                href="https://docs.deco.page/en/guides/deployment/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline text-sm"
              >
                How to publish your app
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NoProjectFound = () => {
  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-semibold">No projects available</h1>
        <p className="text-sm text-muted-foreground max-w-sm">
          You need to have at least one project on your account to authorize
          this app.
        </p>
      </div>
    </div>
  );
};

const SelectProject = ({
  registryApp,
  teams,
  setTeam,
}: {
  registryApp: RegistryApp;
  teams: CurrentTeam[];
  setTeam: (team: CurrentTeam | null) => void;
}) => {
  const [selectedTeam, setSelectedTeam] = useState<CurrentTeam | null>(null);

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center flex flex-col gap-10 w-96">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-center">
            <IntegrationAvatar
              url={registryApp.icon}
              fallback={registryApp.friendlyName ?? registryApp.name}
              size="xl"
            />
          </div>
          <h1 className="text-xl font-semibold">
            Authorize {registryApp.friendlyName ?? registryApp.name}
          </h1>
        </div>

        <div className="flex flex-col items-start gap-2 w-full">
          <p className="text-sm text-foreground">
            Select a project to use this app
          </p>
          <div className="w-full">
            <Combobox
              options={teams.map((team) => ({
                value: team.slug,
                label: team.label,
                avatarUrl: team.avatarUrl,
              }))}
              value={selectedTeam?.slug ?? ""}
              onChange={(value) =>
                setSelectedTeam(
                  teams.find((team) => team.slug === value) ?? null,
                )
              }
              placeholder="Select a project"
              width="w-full"
              triggerClassName="!h-16"
              contentClassName="w-full"
              renderTrigger={(selectedOption) => (
                <div className="flex items-center justify-between w-full h-16 px-3 py-2 border border-input bg-background rounded-md text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                  <div className="flex items-center gap-3">
                    {selectedOption ? (
                      <>
                        <Avatar
                          url={selectedOption.avatarUrl}
                          fallback={selectedOption.label}
                          size="sm"
                          shape="square"
                          objectFit="contain"
                        />
                        <span>{selectedOption.label}</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">
                        Select a project
                      </span>
                    )}
                  </div>
                  <ChevronsUpDown className="opacity-50" />
                </div>
              )}
              renderItem={(option, isSelected) => (
                <div className="flex items-center gap-3 h-12">
                  <Avatar
                    url={option.avatarUrl}
                    fallback={option.label}
                    size="sm"
                    shape="square"
                    objectFit="contain"
                  />
                  <span>{option.label}</span>
                  <Check
                    className={cn(
                      "ml-auto",
                      isSelected ? "opacity-100" : "opacity-0",
                    )}
                  />
                </div>
              )}
            />
          </div>
        </div>

        <Button
          className="w-full"
          disabled={!selectedTeam}
          onClick={() => setTeam(selectedTeam)}
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

const InlineCreateIntegrationForm = ({
  appName,
  onFormSubmit,
  onBack,
  backEnabled,
}: {
  appName: string;
  onFormSubmit: ({
    formData,
    scopes,
  }: {
    formData: Record<string, unknown>;
    scopes: string[];
  }) => Promise<void>;
  onBack: () => void;
  backEnabled: boolean;
}) => {
  const { data } = useMarketplaceAppSchema(appName);
  const scopes = data?.scopes ?? [];
  const schema = data?.schema as JSONSchema7;

  const form = useForm({
    defaultValues: schema ? generateDefaultValues(schema) : {},
  });

  // Default policies required for all integrations
  const DEFAULT_INTEGRATION_POLICIES = [
    { effect: "allow" as const, resource: "DATABASES_RUN_SQL" },
  ];

  const parseAppScope = (scope: string) => {
    const [bindingName, toolName] = scope.split("::");
    return { bindingName, toolName };
  };

  const getAppNameFromSchema = (schema: any, bindingName: string) => {
    const binding = schema.properties?.[bindingName];
    if (
      typeof binding === "object" &&
      binding !== null &&
      "properties" in binding
    ) {
      const typeProperty = binding.properties?.__type;
      if (
        typeof typeProperty === "object" &&
        typeProperty !== null &&
        "const" in typeProperty
      ) {
        return typeProperty.const as string;
      }
    }
    return undefined;
  };

  // Get all scopes (default + integration-specific)
  const getAllScopes = (): AppScope[] => {
    return [
      ...DEFAULT_INTEGRATION_POLICIES.map((policy) => policy.resource),
      ...scopes,
    ].map((scope) => {
      const { bindingName, toolName } = parseAppScope(scope);
      return {
        name: toolName ?? scope,
        app:
          schema && bindingName
            ? getAppNameFromSchema(schema, bindingName)
            : undefined,
      };
    });
  };

  // Get permission descriptions
  const allScopes = getAllScopes();
  const { permissions, isLoading: permissionsLoading } =
    usePermissionDescriptions(allScopes);

  const shouldShowPermissions = useMemo(() => {
    return permissions.length > 0;
  }, [permissions]);

  const shouldShowForm = useMemo(() => {
    return schema.properties && Object.keys(schema.properties).length > 0;
  }, [schema]);

  // Update form defaults when schema changes
  useEffect(() => {
    if (schema) {
      form.reset(generateDefaultValues(schema));
    }
  }, [schema, form]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = form.getValues();
    await onFormSubmit({
      formData,
      scopes,
    });
  };

  return (
    <div className="flex flex-col space-y-6 w-full">
      {!shouldShowForm && !shouldShowPermissions && (
        <div className="flex flex-col items-center justify-center h-screen">
          <p className="text-sm text-muted-foreground">
            No configuration required
          </p>
        </div>
      )}

      {/* Permissions Section */}
      {shouldShowPermissions && (
        <Accordion type="single" collapsible defaultValue="permissions">
          <AccordionItem value="permissions">
            <AccordionTrigger className="text-sm">
              <div className="flex items-center gap-2">
                <span>Permissions Required</span>
                <Badge variant="secondary" className="text-xs">
                  {permissions.length}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <div className="border rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <div className="space-y-4">
                    <div className="grid gap-2">
                      {permissions.map((permission, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex-shrink-0 text-success">✓</div>
                          <div className="flex-1">
                            <div className="text-sm font-medium">
                              {permission.description}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {permission.scope}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Configuration Form */}
      {shouldShowForm && (
        <>
          <Separator />
          <div>
            <h3 className="text-lg font-semibold mb-4">Configuration</h3>
            <FormProvider {...form}>
              <JsonSchemaForm
                schema={schema}
                form={form}
                onSubmit={handleFormSubmit}
                submitButton={
                  <FooterButtons
                    backLabel={backEnabled ? "Back" : "Change project"}
                    onClickBack={onBack}
                    onClickContinue={handleFormSubmit}
                    continueDisabled={form.formState.isSubmitting}
                    continueLoading={form.formState.isSubmitting}
                  />
                }
              />
            </FormProvider>
          </div>
        </>
      )}

      {shouldShowForm ? null : (
        <FooterButtons
          backLabel={backEnabled ? "Back" : "Change project"}
          onClickBack={onBack}
          onClickContinue={handleFormSubmit}
          continueDisabled={form.formState.isSubmitting}
          continueLoading={form.formState.isSubmitting}
        />
      )}
    </div>
  );
};

const SelectableInstallList = ({
  installedIntegrations,
  setSelectedIntegration,
  selectCreateNew,
  selectedIntegration,
}: {
  selectedIntegration: Integration | null;
  installedIntegrations: Integration[];
  setSelectedIntegration: (integration: Integration) => void;
  selectCreateNew: () => void;
}) => {
  return (
    <div className="flex flex-col items-center space-y-2 w-full">
      <p className="text-sm self-start">
        Select an existing install or create a new one
      </p>

      {installedIntegrations.map((integration) => (
        <Button
          key={integration.id}
          variant="outline"
          onClick={() => setSelectedIntegration(integration)}
          className={cn(
            "w-full h-16 justify-start px-3 py-3",
            selectedIntegration?.id === integration.id
              ? "border-foreground"
              : "",
          )}
        >
          <IntegrationAvatar
            url={integration.icon}
            fallback={integration.name}
            size="base"
          />
          <span className="text-sm">{integration.name}</span>
        </Button>
      ))}

      <Button
        variant="outline"
        onClick={selectCreateNew}
        className="w-full h-16 justify-start px-3 py-3"
      >
        <Icon name="add" size={16} />
        <span className="text-sm">Create new </span>
      </Button>
    </div>
  );
};

const FooterButtons = ({
  backLabel,
  onClickBack,
  onClickContinue,
  continueDisabled,
  continueLoading,
}: {
  backLabel: string;
  onClickBack: () => void;
  onClickContinue: (e: React.FormEvent) => Promise<void> | void;
  continueDisabled: boolean;
  continueLoading: boolean;
}) => {
  return (
    <div className="pt-4 flex items-center justify-center gap-2 w-full">
      <Button variant="outline" onClick={onClickBack} className="w-1/2">
        {backLabel}
      </Button>
      <Button
        className="w-1/2"
        disabled={continueDisabled}
        onClick={onClickContinue}
      >
        {continueLoading ? (
          <div className="flex items-center gap-2">
            <Spinner size="sm" />
            Authorizing...
          </div>
        ) : (
          `Continue`
        )}
      </Button>
    </div>
  );
};

const SelectProjectAppInstance = ({
  app,
  project,
  workspace,
  selectAnotherProject,
  clientId,
  redirectUri,
  state,
}: {
  app: RegistryApp;
  project: CurrentTeam;
  workspace: Workspace;
  selectAnotherProject: () => void;
  clientId: string;
  redirectUri: string;
  state: string | undefined;
}) => {
  const installedIntegrations = useAppIntegrations(clientId);
  const createOAuthCode = useCreateOAuthCodeForIntegration();
  const installCreatingApiKeyAndIntegration =
    useInstallCreatingApiKeyAndIntegration();

  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(() => installedIntegrations[0] ?? null);
  const [inlineCreatingIntegration, setInlineCreatingIntegration] =
    useState<boolean>(() => installedIntegrations.length === 0);

  const handleFormSubmit = async ({
    formData,
    scopes,
  }: {
    formData: Record<string, unknown>;
    scopes: string[];
  }) => {
    const integration = await installCreatingApiKeyAndIntegration.mutateAsync({
      clientId,
      app,
      formData,
      scopes,
    });

    await createOAuthCodeAndRedirectBackToApp({
      integrationId: integration.id,
    });
  };

  const createOAuthCodeAndRedirectBackToApp = async ({
    integrationId,
  }: {
    integrationId: string;
  }) => {
    const { redirectTo } = await createOAuthCode.mutateAsync({
      integrationId,
      workspace,
      redirectUri,
      state,
    });
    globalThis.location.href = redirectTo;
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen w-full">
      <div className="text-center space-y-6 max-w-md w-full">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-2">
            <div className="relative">
              <Avatar
                shape="square"
                url={project.avatarUrl}
                fallback={project.label}
                objectFit="contain"
                size="xl"
              />
            </div>

            <div className="relative -mx-4 z-50 bg-background border border-border rounded-lg w-8 h-8 flex items-center justify-center">
              <Icon
                name="sync_alt"
                size={24}
                className="text-muted-foreground"
              />
            </div>

            <div className="relative">
              <IntegrationAvatar
                url={app.icon}
                fallback={app.friendlyName ?? app.name}
                size="xl"
              />
            </div>
          </div>
          <h1 className="text-xl font-semibold flex items-start gap-2">
            <span>Authorize {app.friendlyName ?? app.name}</span>
            <div className="mt-2">{app.verified && <VerifiedBadge />}</div>
          </h1>
        </div>

        {inlineCreatingIntegration ? (
          <Suspense
            fallback={
              <div className="flex flex-col items-center space-y-4 w-full">
                <Spinner size="sm" />
                <p className="text-sm text-muted-foreground">
                  Loading app permissions...
                </p>
              </div>
            }
          >
            <InlineCreateIntegrationForm
              appName={clientId}
              onFormSubmit={handleFormSubmit}
              onBack={() => {
                if (installedIntegrations.length > 0) {
                  setInlineCreatingIntegration(false);
                } else {
                  selectAnotherProject();
                }
              }}
              backEnabled={installedIntegrations.length > 0}
            />
          </Suspense>
        ) : (
          <SelectableInstallList
            installedIntegrations={installedIntegrations}
            setSelectedIntegration={setSelectedIntegration}
            selectCreateNew={() => {
              setInlineCreatingIntegration(true);
              setSelectedIntegration(null);
            }}
            selectedIntegration={selectedIntegration}
          />
        )}

        {inlineCreatingIntegration ? null : (
          <FooterButtons
            backLabel="Change project"
            onClickBack={selectAnotherProject}
            onClickContinue={() => {
              if (!selectedIntegration) {
                throw new Error("No integration selected");
              }
              createOAuthCodeAndRedirectBackToApp({
                integrationId: selectedIntegration.id,
              });
            }}
            continueDisabled={!selectedIntegration || createOAuthCode.isPending}
            continueLoading={createOAuthCode.isPending}
          />
        )}
      </div>
    </div>
  );
};

function AppsOAuth({
  client_id,
  redirect_uri,
  state,
  workspace_hint,
}: OAuthSearchParams) {
  const { data: registryApp } = useRegistryApp({ clientId: client_id });
  const teams = useUserTeams();
  const user = useUser();
  const [team, setTeam] = useState<CurrentTeam | null>(
    preSelectTeam(teams, workspace_hint),
  );

  const selectedWorkspace = useMemo(() => {
    if (!team) {
      return null;
    }
    return team.id === user.id ? `users/${user.id}` : `shared/${team.slug}`;
  }, [team]);

  if (!teams || teams.length === 0) {
    return <NoProjectFound />;
  }

  if (!selectedWorkspace || !team) {
    return (
      <SelectProject
        registryApp={registryApp}
        teams={teams}
        setTeam={setTeam}
      />
    );
  }

  return (
    <SDKProvider workspace={selectedWorkspace as Workspace}>
      <SelectProjectAppInstance
        app={registryApp}
        project={team}
        workspace={selectedWorkspace as Workspace}
        selectAnotherProject={() => setTeam(null)}
        clientId={client_id}
        redirectUri={redirect_uri}
        state={state}
      />
    </SDKProvider>
  );
}

export default function Page() {
  return (
    <AppsAuthLayout>
      {(props) => (
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          }
        >
          <ErrorBoundary
            shouldCatch={(error) => error instanceof RegistryAppNotFoundError}
            fallback={<NoAppFound client_id={props.client_id} />}
          >
            <AppsOAuth {...props} />
          </ErrorBoundary>
        </Suspense>
      )}
    </AppsAuthLayout>
  );
}
