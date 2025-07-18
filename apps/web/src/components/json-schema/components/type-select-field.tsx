import { useEffect, useState } from "react";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
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

interface TypeSelectFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
  typeValue: string;
  optionsLoader: (type: string) => Promise<OptionItem[]> | OptionItem[];
}

export function TypeSelectField<T extends FieldValues = FieldValues>({
  name,
  title,
  description,
  form,
  isRequired,
  disabled,
  typeValue,
  optionsLoader,
}: TypeSelectFieldProps<T>) {
  const [options, setOptions] = useState<OptionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        setLoading(true);
        const loadedOptions = await optionsLoader(typeValue);
        setOptions(loadedOptions);
      } catch (error) {
        console.error("Error loading options:", error);
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    loadOptions();
  }, [typeValue, optionsLoader]);

  const selectedOption = options.find(
    // deno-lint-ignore no-explicit-any
    (option: OptionItem) => option.value === form.getValues(name as any)?.value,
  );

  return (
    <FormField
      control={form.control}
      name={name as unknown as FieldPath<T>}
      render={({ field }) => (
        <FormItem className="space-y-2">
          <FormLabel>
            {title}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
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
            disabled={disabled || loading}
          >
            <FormControl>
              <SelectTrigger className="h-11">
                <SelectValue
                  placeholder={loading ? "Loading..." : "Select an integration"}
                >
                  {field.value?.value && selectedOption && (
                    <div className="flex items-center gap-3">
                      <IntegrationIcon
                        icon={selectedOption.icon}
                        name={selectedOption.label}
                        size="sm"
                      />
                      <span className="font-medium">
                        {selectedOption.label}
                      </span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((option: OptionItem) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="py-3"
                >
                  <div className="flex items-center gap-3 w-full">
                    <IntegrationIcon
                      icon={option.icon}
                      name={option.label}
                      size="sm"
                      className="flex-shrink-0"
                    />
                    <span className="font-medium text-sm">{option.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {description && (
            <FormDescription className="text-xs text-muted-foreground">
              {description}
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
