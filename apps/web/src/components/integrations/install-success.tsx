import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@deco/ui/components/card.tsx";
import { useEffect } from "react";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useIntegrations, useUpdateIntegration } from "@deco/sdk";
import { trackException } from "../../hooks/analytics.ts";
import { notifyIntegrationUpdate } from "../../lib/broadcast-channels.ts";

function ConnectionInstallSuccess() {
  const { mutate: updateIntegration, isPending } = useUpdateIntegration({
    onError: (error) => {
      const searchParams = new URLSearchParams(globalThis.location.search);
      trackException(error, {
        properties: {
          installId: searchParams.get("installId"),
          appName: searchParams.get("appName"),
          mcpUrl: searchParams.get("mcpUrl"),
          name: searchParams.get("name"),
          account: searchParams.get("account"),
        },
      });
    },
    onSuccess: () => {
      const searchParams = new URLSearchParams(globalThis.location.search);
      searchParams.delete("installId");
      const newUrl = `${globalThis.location.pathname}?${searchParams.toString()}`;
      globalThis.history.replaceState({}, "", newUrl);

      // Notify other windows about the successful update
      notifyIntegrationUpdate();
    },
  });
  const { data: allIntegrations } = useIntegrations();

  useEffect(() => {
    const searchParams = new URLSearchParams(globalThis.location.search);
    const installId = searchParams.get("installId");
    const name = searchParams.get("name");
    const account = searchParams.get("account");

    if (!installId || !allIntegrations) {
      return;
    }

    const connectionId = `i:${installId}`;
    const existingIntegration = allIntegrations.find(
      (integration) => integration.id === connectionId,
    );

    if (!existingIntegration) {
      return;
    }

    const newName =
      name ||
      `${existingIntegration.name} | ${account}` ||
      existingIntegration.name;
    const newDescription = account || existingIntegration.description;
    if (existingIntegration.connection.type === "HTTP") {
      existingIntegration.connection.token = installId;
    }

    updateIntegration({
      ...existingIntegration,
      id: connectionId,
      name: newName,
      description: newDescription,
    });
  }, [updateIntegration, allIntegrations]);

  return (
    <div className="min-h-screen h-full flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-4 rounded-xl">
        {isPending ? (
          <CardContent className="text-center space-y-4 py-8">
            <div className="flex justify-center w-full">
              <Spinner size="lg" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-medium">Processing Integration</h3>
              <p className="text-muted-foreground">
                Please wait while we set up your integration...
              </p>
            </div>
          </CardContent>
        ) : (
          <>
            <CardHeader className="text-center">
              <Icon name="check_circle" size={36} className="text-special" />
              <CardTitle className="text-xl font-medium">
                Integration Connected Successfully!
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <p className="text-muted-foreground">
                Your integration has been successfully connected.
              </p>
              <p className="text-muted-foreground">
                You can now close this window.
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}

export default ConnectionInstallSuccess;
