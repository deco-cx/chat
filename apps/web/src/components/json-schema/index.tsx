import type { JSONSchema7, JSONSchema7Definition } from "json-schema";
import type { FormEvent, ReactNode } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";
import { ArrayField } from "./components/array-field.tsx";
import { BooleanField } from "./components/boolean-field.tsx";
import { JsonTextField } from "./components/json-text-field.tsx";
import { NumberField } from "./components/number-field.tsx";
import { SelectField } from "./components/select-field.tsx";
import { StringField } from "./components/string-field.tsx";

import { formatPropertyName, selectAnyOfSchema } from "./utils/index.ts";

export type SchemaType = string | number | boolean | object | null;

export interface JsonSchemaFormProps<
  T extends FieldValues = Record<string, SchemaType>,
> {
  schema: JSONSchema7;
  form: UseFormReturn<T>;
  disabled?: boolean;
  onSubmit: (e: FormEvent) => Promise<void> | void;
  // deno-lint-ignore no-explicit-any
  error?: any;
  submitButton: ReactNode;
}

export default function Form<T extends FieldValues = Record<string, unknown>>(
  { schema, form, disabled = false, onSubmit, error, submitButton }:
    JsonSchemaFormProps<T>,
) {
  if (!schema || typeof schema !== "object") {
    return <div className="text-sm text-destructive">Invalid schema</div>;
  }

  // Handle root schema
  return (
    <form
      className="space-y-4"
      onSubmit={onSubmit}
    >
      {schema.type === "object" && schema.properties && (
        <ObjectProperties<T>
          properties={schema.properties}
          required={schema.required || []}
          form={form}
          disabled={disabled}
        />
      )}

      {error && (
        <div className="text-sm text-destructive mt-2">
          {JSON.stringify(error)}
        </div>
      )}

      <div className="flex gap-2">
        {submitButton}
      </div>
    </form>
  );
}

// Object properties component
function ObjectProperties<
  T extends FieldValues = Record<string, unknown>,
>({
  properties,
  required = [],
  form,
  disabled,
}: {
  properties: Record<string, JSONSchema7Definition>;
  required?: string[];
  form: JsonSchemaFormProps<T>["form"];
  disabled: boolean;
}) {
  return (
    <div className="space-y-4">
      {Object.entries(properties).map(([name, propSchema]) => {
        const isRequired = required.includes(name);
        return (
          <Field<T>
            key={name}
            name={name}
            schema={propSchema as JSONSchema7}
            form={form}
            isRequired={isRequired}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}

// Field component to render a field based on its type
function Field<T extends FieldValues = Record<string, unknown>>({
  name,
  schema,
  form,
  isRequired = false,
  disabled = false,
}: {
  name: string;
  schema: JSONSchema7;
  form: JsonSchemaFormProps<T>["form"];
  isRequired?: boolean;
  disabled?: boolean;
}) {
  // Handle anyOf schema
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    // Use the unified schema selection utility from schema.ts
    const representativeSchema = selectAnyOfSchema(
      schema,
      undefined,
      form,
      name,
    );

    return (
      <Field<T>
        name={name}
        schema={representativeSchema}
        form={form}
        isRequired={isRequired}
        disabled={disabled}
      />
    );
  }

  // Handle regular field types (not anyOf)
  const type = Array.isArray(schema.type)
    ? schema.type.find((prop) => prop !== "null") ?? "null"
    : schema.type;
  const description = schema.description as string | undefined;
  // Extract just the property name from the full path for cleaner titles
  const propertyName = name.split(".").pop() || name;
  const title = (schema.title as string | undefined) ||
    formatPropertyName(propertyName);

  switch (type) {
    case "string":
      if (schema.enum) {
        return (
          <SelectField<T>
            key={name}
            name={name}
            title={title}
            options={schema.enum as string[]}
            description={description}
            form={form}
            isRequired={isRequired}
            disabled={disabled}
          />
        );
      }
      return (
        <StringField<T>
          key={name}
          name={name}
          title={title}
          description={description}
          form={form}
          isRequired={isRequired}
          disabled={disabled}
        />
      );
    case "number":
    case "integer":
      return (
        <NumberField<T>
          key={name}
          name={name}
          title={title}
          description={description}
          form={form}
          isRequired={isRequired}
          disabled={disabled}
        />
      );
    case "boolean":
      return (
        <BooleanField<T>
          key={name}
          name={name}
          title={title}
          description={description}
          form={form}
          isRequired={isRequired}
          disabled={disabled}
        />
      );
    case "object":
      if (schema.properties) {
        return (
          <div
            key={name}
            className="object-field border rounded-md p-4 [.array-field-content_&]:border-none [.array-field-content_&]:rounded-none"
          >
            <h3 className="text-md font-medium mb-2 [.array-field-content_&]:hidden">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-muted-foreground mb-4 [.array-field-content_&]:hidden">
                {description}
              </p>
            )}
            <div className="space-y-4">
              {Object.entries(schema.properties).map(
                ([propName, propSchema]) => {
                  const isPropertyRequired = schema.required?.includes(
                    propName,
                  );
                  const fullName = `${name}.${propName}`;

                  return (
                    <Field<T>
                      key={fullName}
                      name={fullName}
                      schema={propSchema as JSONSchema7}
                      form={form}
                      isRequired={isPropertyRequired}
                      disabled={disabled}
                    />
                  );
                },
              )}
            </div>
          </div>
        );
      }
      return (
        <JsonTextField<T>
          key={name}
          name={name}
          title={title}
          description={description}
          form={form}
          isRequired={isRequired}
          disabled={disabled}
        />
      );
    case "array": {
      // Create a RenderItem component for this specific array field
      const RenderItem = (
        { name: itemName, schema: itemSchema, title: itemTitle }: {
          name: string;
          index: number;
          schema: JSONSchema7;
          title?: string;
        },
      ) => (
        <Field<T>
          name={itemName}
          schema={{ ...itemSchema, title: itemTitle }}
          form={form}
          isRequired={false}
          disabled={disabled}
        />
      );

      return (
        <ArrayField<T>
          key={name}
          name={name}
          title={title}
          description={description}
          form={form}
          isRequired={isRequired}
          disabled={disabled}
          schema={schema}
          RenderItem={RenderItem}
        />
      );
    }
    default:
      return (
        <div key={name} className="text-sm text-muted-foreground">
          Field type '{type}' not supported
        </div>
      );
  }
}
