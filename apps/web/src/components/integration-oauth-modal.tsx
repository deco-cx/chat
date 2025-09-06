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
import JsonSchemaForm from "./json-schema/index.tsx";
import { generateDefaultValues } from "./json-schema/utils/generate-default-values.ts";
import type { ContractState } from "@deco/sdk/mcp";
import { MicroDollar } from "@deco/sdk/mcp/wallet";
interface Permission {
  scope: string;
  description: string;
}

interface IntegrationOAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  schema: JSONSchema7;
  contract?: ContractState;
  integrationName: string;
  permissions: Permission[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

export function IntegrationOAuthModal({
  isOpen,
  onClose,
  schema,
  contract,
  integrationName,
  permissions,
  onSubmit,
  isLoading = false,
}: IntegrationOAuthModalProps) {
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

          {contract && contract.clauses.length > 0 && (
            <>
              <Separator />
              <ContractClauses contract={contract} />
            </>
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

function ContractClauses({ contract }: { contract: ContractState }) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold mb-4">Pricing Information</h3>
      <div className="space-y-3">
        {contract.clauses.map((clause) => {
          const formatPrice = (price: string | number): string => {
            if (typeof price === "number") {
              return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 6,
              }).format(price);
            }

            // Handle microdollar string
            try {
              return MicroDollar.from(price).display({
                showAllDecimals: true,
              });
            } catch {
              return `$${price}`;
            }
          };

          return (
            <div
              key={clause.id}
              className="flex items-center justify-between p-3 border rounded-lg bg-muted/20"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{clause.id}</div>
                {clause.description && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {clause.description}
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">
                  {formatPrice(clause.price)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
