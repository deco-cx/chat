import {
  type Integration,
  SDKProvider,
  useCreateOAuthCodeForIntegration,
  useIntegrations,
  type Workspace,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { useUser } from "../../hooks/use-user.ts";
import { Avatar } from "../common/avatar/index.tsx";
import { BaseRouteLayout } from "../layout.tsx";
import { type CurrentTeam, useUserTeams } from "../sidebar/team-selector.tsx";

const OAuthSearchParamsSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string(),
  state: z.string().optional(),
  workspace_hint: z.string().optional(),
});

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
    if (integration.id.startsWith("i:")) {
      console.log(integration);
    }
    if ("appName" in integration) {
      return integration.appName === appName;
    }
    return false;
  });
};

const preSelectIntegration = (integrations: Integration[]) => {
  if (integrations.length === 1) {
    return integrations[0];
  }
  return null;
};

function ShowInstalls({
  appName,
  setSelectedIntegration,
  selectedIntegration,
}: {
  appName: string;
  setSelectedIntegration: (integration: Integration | null) => void;
  selectedIntegration: Integration | null;
}) {
  const matchingIntegrations = useAppIntegrations(appName);

  useEffect(() => {
    setSelectedIntegration(preSelectIntegration(matchingIntegrations));
  }, [appName]);

  const [showIntegrationSelector, setShowIntegrationSelector] = useState(false);

  if (!matchingIntegrations || matchingIntegrations.length === 0) {
    return <div>No integrations found</div>;
  }

  if (!selectedIntegration) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center space-y-6">
          <h1 className="text-2xl font-bold">Select an integration</h1>
          <p className="text-muted-foreground">
            Choose which integration to install
          </p>

          <div className="w-full max-w-sm">
            <Select
              value=""
              onValueChange={(value) =>
                setSelectedIntegration(
                  matchingIntegrations.find(
                    (integration) => integration.id === value,
                  ) ?? null,
                )
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select an integration" />
              </SelectTrigger>
              <SelectContent>
                {matchingIntegrations.map((integration) => (
                  <SelectItem key={integration.id} value={integration.id}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={integration.icon}
                        fallback={integration.name}
                        size="sm"
                        shape="square"
                        objectFit="contain"
                      />
                      <span>{integration.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="flex items-center gap-4 p-4 border rounded-xl bg-card">
        <Avatar
          url={selectedIntegration.icon}
          fallback={selectedIntegration.name}
          size="lg"
          shape="square"
          objectFit="contain"
        />
        <div className="text-left">
          <h3 className="font-semibold">{selectedIntegration.name}</h3>
          <p className="text-sm text-muted-foreground">
            {selectedIntegration.description}
          </p>
        </div>
      </div>

      {matchingIntegrations.length > 1 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowIntegrationSelector(!showIntegrationSelector)}
          className="gap-2"
        >
          <Icon name="edit" size={16} />
          Change integration
        </Button>
      )}

      {showIntegrationSelector && (
        <div className="w-full max-w-sm space-y-3">
          <p className="text-sm text-muted-foreground">
            Select a different integration:
          </p>
          <Select
            value={selectedIntegration?.id}
            onValueChange={(value) => {
              setSelectedIntegration(
                matchingIntegrations.find(
                  (integration) => integration.id === value,
                ) ?? null,
              );
              setShowIntegrationSelector(false);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an integration" />
            </SelectTrigger>
            <SelectContent>
              {matchingIntegrations.map((integration) => (
                <SelectItem key={integration.id} value={integration.id}>
                  <div className="flex items-center gap-3">
                    <Avatar
                      url={integration.icon}
                      fallback={integration.name}
                      size="sm"
                      shape="square"
                      objectFit="contain"
                    />
                    <span>{integration.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function AppsOAuth({
  client_id,
  redirect_uri,
  state,
  workspace_hint,
}: z.infer<typeof OAuthSearchParamsSchema>) {
  const teams = useUserTeams();
  const user = useUser();
  const [team, setTeam] = useState<CurrentTeam | null>(
    preSelectTeam(teams, workspace_hint),
  );
  const [showTeamSelector, setShowTeamSelector] = useState(false);
  const [selectedIntegration, setSelectedIntegration] =
    useState<Integration | null>(null);

  const createOAuthCode = useCreateOAuthCodeForIntegration();

  const selectedWorkspace = useMemo(() => {
    if (!team) {
      return null;
    }

    return team.id === user.id ? `users/${user.id}` : `shared/${team.slug}`;
  }, [team, user.id]);

  if (!teams || teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">No teams available</h1>
          <p className="text-muted-foreground">
            You need to be part of a team to install this app.
          </p>
        </div>
      </div>
    );
  }

  if (!selectedWorkspace || !team) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="text-center space-y-6">
          <h1 className="text-2xl font-bold">Select a team</h1>
          <p className="text-muted-foreground">
            Choose which team to install this app into
          </p>

          <div className="w-full max-w-sm">
            <Select
              value=""
              onValueChange={(value) =>
                setTeam(teams.find((team) => team.slug === value) ?? null)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.slug} value={team.slug}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={team.avatarUrl}
                        fallback={team.label}
                        size="sm"
                        shape="square"
                        objectFit="contain"
                      />
                      <span>{team.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <div className="text-center space-y-6 max-w-md">
        <h1 className="text-2xl font-bold">Install app to team</h1>
        <p className="text-muted-foreground">
          This app will be installed into the selected team
        </p>

        <div className="flex flex-col items-center space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-xl bg-card">
            <Avatar
              url={team.avatarUrl}
              fallback={team.label}
              size="lg"
              shape="square"
            />
            <div className="text-left">
              <h3 className="font-semibold">{team.label}</h3>
              <p className="text-sm text-muted-foreground">Team</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTeamSelector(!showTeamSelector)}
            className="gap-2"
          >
            <Icon name="edit" size={16} />
            Change team
          </Button>
        </div>

        {showTeamSelector && (
          <div className="w-full max-w-sm space-y-3">
            <p className="text-sm text-muted-foreground">
              Select a different team:
            </p>
            <Select
              value={team?.slug}
              onValueChange={(value) => {
                setTeam(teams.find((team) => team.slug === value) ?? null);
                setShowTeamSelector(false);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((teamOption) => (
                  <SelectItem key={teamOption.slug} value={teamOption.slug}>
                    <div className="flex items-center gap-3">
                      <Avatar
                        url={teamOption.avatarUrl}
                        fallback={teamOption.label}
                        size="sm"
                        shape="square"
                      />
                      <span>{teamOption.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <SDKProvider workspace={selectedWorkspace as Workspace}>
          <ShowInstalls
            appName={client_id}
            setSelectedIntegration={setSelectedIntegration}
            selectedIntegration={selectedIntegration}
          />
        </SDKProvider>

        <div className="pt-4">
          <Button
            className="w-full"
            onClick={async () => {
              if (!selectedIntegration) {
                return;
              }

              const { redirectTo } = await createOAuthCode.mutateAsync({
                integrationId: selectedIntegration?.id,
                workspace: selectedWorkspace,
                redirectUri: redirect_uri,
                state,
              });

              globalThis.location.href = redirectTo;
            }}
          >
            Continue with {team.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AppsAuthLayout() {
  const [searchParams] = useSearchParams();
  const result = OAuthSearchParamsSchema.safeParse(
    Object.fromEntries(searchParams),
  );

  if (!result.success) {
    return (
      <BaseRouteLayout>
        <div className="flex flex-col items-center justify-center h-screen">
          <div className="text-center space-y-6 max-w-md">
            <div className="flex justify-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <Icon name="error" size={32} className="text-destructive" />
              </div>
            </div>
            <h1 className="text-2xl font-bold">Authentication Error</h1>
            <p className="text-muted-foreground">
              Something went wrong when authenticating your access to that app.
              Please try again or contact us if the problem persists.
            </p>
            <Button
              variant="outline"
              onClick={() => globalThis.history.back()}
              className="gap-2"
            >
              <Icon name="arrow_left_alt" size={16} />
              Go back
            </Button>
          </div>
        </div>
      </BaseRouteLayout>
    );
  }

  return (
    <BaseRouteLayout>
      <AppsOAuth {...result.data} />
    </BaseRouteLayout>
  );
}
