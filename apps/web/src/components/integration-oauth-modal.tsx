import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@deco/ui/components/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Alert, AlertDescription } from "@deco/ui/components/alert.tsx";
import type { JSONSchema7 } from "json-schema";
import JsonSchemaForm, { type OptionItem } from "./json-schema/index.tsx";
import { generateDefaultValues } from "./json-schema/utils/generate-default-values.ts";
import {
  getRegistryApp,
  type Integration,
  listIntegrations,
  useSDK,
} from "@deco/sdk";

interface Permission {
  scope: string;
  description: string;
}

interface IntegrationOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: JSONSchema7;
  integrationName: string;
  permissions: Permission[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

export function IntegrationOAuthModal({
  isOpen,
  onClose,
  schema,
  integrationName,
  permissions,
  onSubmit,
  isLoading = false,
}: IntegrationOAuthModalProps) {
  const { workspace } = useSDK();
  const form = useForm({
    defaultValues: generateDefaultValues(schema),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = form.getValues();

    try {
      await onSubmit(data);
      onClose();
    } catch (error) {
      console.error("Error submitting OAuth form:", error);
      // TODO: Show error to user
    }
  };

  const optionsLoader = async (type: string): Promise<OptionItem[]> => {
    try {
      // Fetch installed integrations from workspace
      const installedIntegrations = await listIntegrations(workspace);

      // Try to get registry app information for the type to understand what we're looking for
      const registryApp = await getRegistryApp(workspace, { name: type });

      const registryAppName = `@${registryApp.scopeName}/${registryApp.name}`;
      // Filter integrations based on the type
      const matchingIntegrations = installedIntegrations.filter(
        (integration: Integration) => {
          // Match by name (case-insensitive)
          return (
            registryAppName === integration.appName ||
            (integration.connection.type === "HTTP" &&
              registryApp.connection.type === "HTTP" &&
              integration.connection.url === registryApp.connection.url)
          );
        },
      );

      // Convert to OptionItem format with icons
      return matchingIntegrations.map((integration: Integration) => ({
        value: integration.id,
        label: integration.name,
        icon: integration.icon,
      }));
    } catch (error) {
      console.error("Error loading integration options:", error);
      return [];
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Install {integrationName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Permissions Section */}
          {permissions.length > 0 && (
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <strong>{integrationName}</strong> will have access to the
                  following permissions:
                </AlertDescription>
              </Alert>

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
          )}

          <Separator />

          {/* Configuration Form */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Configuration</h3>
            <FormProvider {...form}>
              <JsonSchemaForm
                schema={schema}
                form={form}
                onSubmit={handleSubmit}
                optionsLoader={optionsLoader}
                submitButton={
                  <Button
                    type="submit"
                    disabled={form.formState.isSubmitting || isLoading}
                    className="w-full"
                  >
                    {form.formState.isSubmitting || isLoading
                      ? "Installing..."
                      : `Install ${integrationName}`}
                  </Button>
                }
              />
            </FormProvider>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
