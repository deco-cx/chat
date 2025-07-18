import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@deco/ui/components/form.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { JSONSchema7 } from "json-schema";
import type {
  ArrayPath,
  FieldArray,
  FieldPath,
  FieldValues,
  UseFormReturn,
} from "react-hook-form";
import { useFieldArray } from "react-hook-form";
import { generateDefaultValue } from "../utils/index.ts";

interface ArrayFieldProps<T extends FieldValues = FieldValues> {
  name: string;
  title: string;
  description?: string;
  form: UseFormReturn<T>;
  isRequired: boolean;
  disabled: boolean;
  schema: JSONSchema7;
  RenderItem: React.ComponentType<{
    name: string;
    index: number;
    schema: JSONSchema7;
    title?: string;
  }>;
}

export function ArrayField<T extends FieldValues = FieldValues>({
  name,
  title,
  description,
  form,
  isRequired,
  disabled,
  schema,
  RenderItem,
}: ArrayFieldProps<T>) {
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: name as ArrayPath<T>,
  });

  const itemSchema = (schema.items as JSONSchema7) || { type: "string" };

  const handleAddItem = () => {
    const defaultValue = generateDefaultValue(itemSchema);
    append(defaultValue as FieldArray<T, ArrayPath<T>>);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      move(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < fields.length - 1) {
      move(index, index + 1);
    }
  };

  const handleRemove = (index: number) => {
    remove(index);
  };

  return (
    <FormField
      key={name}
      control={form.control}
      name={name as unknown as FieldPath<T>}
      render={() => (
        <FormItem>
          <FormLabel className="leading-6">
            {title}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
          <FormControl>
            <div className="space-y-4">
              {fields.map((field, index) => (
                <Card key={field.id} className="relative">
                  <CardContent className="py-4">
                    {/* Header with item number and action buttons */}
                    <div className="w-full absolute -top-4 h-8 flex justify-between items-center px-2">
                      <div className="bg-muted text-muted-foreground text-xs px-2 py-1 rounded font-medium">
                        #{index + 1}
                      </div>

                      <div className="flex gap-1 bg-background">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveUp(index)}
                          disabled={disabled || index === 0}
                          className="w-8"
                        >
                          <Icon name="keyboard_arrow_up" size={20} />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveDown(index)}
                          disabled={disabled || index === fields.length - 1}
                          className="w-8"
                        >
                          <Icon name="keyboard_arrow_down" size={20} />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemove(index)}
                          disabled={disabled}
                          className="w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Icon name="close" size={20} />
                        </Button>
                      </div>
                    </div>

                    {/* Content area */}
                    <div className="array-field-content">
                      <RenderItem
                        name={`${name}.${index}`}
                        index={index}
                        schema={itemSchema}
                        title={itemSchema.title || `Item ${index + 1}`}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={handleAddItem}
                disabled={disabled}
                className="w-full"
              >
                <Icon name="add" className="h-4 w-4 mr-2" />
                Add {title}
              </Button>
            </div>
          </FormControl>
          {description && <FormDescription>{description}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
