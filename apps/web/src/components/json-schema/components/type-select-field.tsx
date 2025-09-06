import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import type { OptionItem } from "../index.tsx";
import { IntegrationIcon } from "../../integrations/common.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { useOptionsLoader } from "../../../hooks/use-options-loader.ts";
import { useMarketplaceIntegrations } from "@deco/sdk";
import {
  ConfirmMarketplaceInstallDialog,
  useOauthModalContext,
} from "../../integrations/select-connection-dialog.tsx";
import type { MarketplaceIntegration } from "../../integrations/marketplace";
import { useState } from "react";
import type { Integration } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";

interface TypeSelectFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
  typeValue: string;
}

export function TypeSelectField<T extends FieldValues = FieldValues>({
  name,
  description,
  form,
  disabled,
  typeValue,
}: TypeSelectFieldProps<T>) {
  const {
    data: options,
    isPending,
    refetch: refetchOptions,
  } = useOptionsLoader(typeValue);
  const { onOpenOauthModal } = useOauthModalContext();
  const { data: marketplace } = useMarketplaceIntegrations();
  const [installingIntegration, setInstallingIntegration] =
    useState<MarketplaceIntegration | null>(null);

  const selectedOption = options.find(
    // deno-lint-ignore no-explicit-any
    (option: OptionItem) => option.value === form.getValues(name as any)?.value,
  );

  const handleAddIntegration = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    // TODO: handle type for contracts

    // Find the integration from marketplace based on typeValue
    const integration = marketplace?.integrations.find(
      (integration) => integration.name === typeValue,
    );

    if (integration) {
      setInstallingIntegration(integration);
    }
  };

  const handleIntegrationSelect = async ({
    connection,
    authorizeOauthUrl,
  }: {
    connection: Integration;
    authorizeOauthUrl: string | null;
  }) => {
    const refetchOptionsPromise = refetchOptions();
    if (authorizeOauthUrl) {
      const popup = globalThis.open(authorizeOauthUrl, "_blank");
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        onOpenOauthModal({
          openIntegrationOnFinish: false,
          open: true,
          url: authorizeOauthUrl,
          integrationName: installingIntegration?.name || "the service",
          connection: connection,
        });
      }
    }
    await refetchOptionsPromise;
    // deno-lint-ignore no-explicit-any
    form.setValue(name as FieldPath<T>, { value: connection.id } as any);
    setInstallingIntegration(null);
  };

  return (
    <>
      <FormField
        control={form.control}
        name={name as unknown as FieldPath<T>}
        render={({ field }) => (
          <FormItem className="space-y-2">
            <div className="flex items-center gap-4">
              {options?.length > 0 ? (
                <Select
                  onValueChange={(value: string) => {
                    // Update the form with an object containing the selected value
                    const selectedOption = options.find(
                      (option: OptionItem) => option.value === value,
                    );
                    if (selectedOption) {
                      field.onChange({ value: selectedOption.value });
                    }
                  }}
                  defaultValue={field.value?.value}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select an integration">
                        {field.value?.value && selectedOption && (
                          <div className="flex items-center gap-3 max-w-50">
                            <IntegrationIcon
                              icon={selectedOption.icon}
                              name={selectedOption.label}
                              size="sm"
                              className="flex-shrink-0"
                            />
                            <span className="font-medium truncate min-w-0 flex-1">
                              {selectedOption.label}
                            </span>
                          </div>
                        )}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent align="end" side="bottom">
                    {options.map((option: OptionItem) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div className="flex items-center gap-3 max-w-50">
                          <IntegrationIcon
                            icon={option.icon}
                            name={option.label}
                            size="sm"
                            className="flex-shrink-0"
                          />
                          <span className="font-medium text-sm truncate min-w-0 flex-1">
                            {option.label}
                          </span>
                        </div>
                      </SelectItem>
                    ))}

                    <div className="border-t h-px" />
                    <SelectItem
                      key={"__connect_account__"}
                      value="__connect_account__"
                      onClick={handleAddIntegration}
                    >
                      <span className="flex items-center justify-center w-8 h-8">
                        <Icon name="add" size={24} />
                      </span>
                      <span className="font-medium text-sm">Create new</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Button
                  disabled={isPending}
                  onClick={handleAddIntegration}
                  variant="special"
                >
                  Connect account
                </Button>
              )}
            </div>
            {description && (
              <FormDescription className="text-xs text-muted-foreground">
                {description}
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />

      <ConfirmMarketplaceInstallDialog
        integration={installingIntegration}
        setIntegration={setInstallingIntegration}
        onConfirm={handleIntegrationSelect}
      />
    </>
  );
}
