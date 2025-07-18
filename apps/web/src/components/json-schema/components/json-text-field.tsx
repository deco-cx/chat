// filepath: /Users/igorbrasileiro/dev/deco/chat/apps/web/src/components/common/jsonSchemaForm/components/JsonTextField.tsx
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Textarea } from "@deco/ui/components/textarea.tsx";
import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";

interface JsonTextFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
}

export function JsonTextField<T extends FieldValues = FieldValues>({
  name,
  title,
  description,
  form,
  isRequired,
  disabled,
}: JsonTextFieldProps<T>) {
  return (
    <FormField
      key={name}
      control={form.control}
      name={name as unknown as FieldPath<T>}
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {title}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <Textarea
              {...field}
              value={
                typeof field.value === "object"
                  ? JSON.stringify(field.value, null, 2)
                  : field.value
              }
              onChange={(e) => {
                try {
                  const value = JSON.parse(e.target.value);
                  field.onChange(value);
                } catch {
                  // Keep the raw string if it's not valid JSON
                  field.onChange(e.target.value);
                }
              }}
              className="font-mono"
              rows={5}
              disabled={disabled}
            />
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
