import type { JSONSchema7 } from "json-schema";
import type { SchemaType } from "../index.tsx";
import {
  doesSchemaTypeMatchValue,
  getDetectedType,
  selectAnyOfSchema,
} from "./schema.ts";

/**
 * This algorithm generates default value given a schema and form data, following this steps:
 * 1. has form data;
 * 1.1 form data matches schema, then return formData
 * 2. does not have form data, but has schema.default
 * 2.2. return schema.default
 * 3. otherwise return a default value from the type.
 */
export function generateDefaultValue(
  schema: JSONSchema7,
  formData?: SchemaType,
  fieldPath?: string,
): SchemaType {
  if (!schema || typeof schema !== "object") {
    return null;
  }

  // Special handling for primitive types
  if (
    schema.type &&
    typeof schema.type === "string" &&
    schema.type !== "object" &&
    schema.type !== "array"
  ) {
    // For primitive types, check if form data matches the schema type
    if (formData !== undefined && formData !== null) {
      const formDataType = getDetectedType(formData);
      const schemaTypeMatches = doesSchemaTypeMatchValue(
        schema.type,
        formDataType,
      );

      // If types match, use formData; otherwise use default value
      if (schemaTypeMatches) {
        return formData;
      }
    }

    // Use default value if available
    if (schema.default !== undefined) {
      return schema.default as SchemaType;
    }
  }

  // Handle anyOf schema with improved selection logic
  if (schema.anyOf && Array.isArray(schema.anyOf) && schema.anyOf.length > 0) {
    const representativeSchema = selectAnyOfSchema(schema, formData);
    return generateDefaultValue(representativeSchema, formData, fieldPath);
  }

  // Handle arrays of types (e.g. ["string", "null"])
  const type = Array.isArray(schema.type)
    ? (schema.type.find((prop) => prop !== "null") ?? "null")
    : schema.type;

  switch (type) {
    case "string":
      return schema.default !== undefined
        ? schema.default
        : schema.enum && schema.enum.length > 0
          ? schema.enum[0]
          : "";
    case "number":
    case "integer":
      return schema.default !== undefined ? schema.default : 0;
    case "boolean":
      return schema.default !== undefined ? schema.default : false;
    case "object":
      if (schema.default !== undefined) {
        return schema.default as SchemaType;
      }

      if (schema.properties) {
        const result: Record<string, SchemaType> = {};
        for (const [name, propSchema] of Object.entries(schema.properties)) {
          const isRequired = schema.required?.includes(name);
          const propPath = fieldPath ? `${fieldPath}.${name}` : name;

          // Extract child form data if available and if formData is an object
          const childFormData =
            formData && typeof formData === "object" && !Array.isArray(formData)
              ? (formData as Record<string, SchemaType>)[name]
              : undefined;

          // Check if the property should be included based on form data and schema
          if (childFormData !== undefined) {
            const childType = getDetectedType(childFormData);
            const typeMatches = doesSchemaTypeMatchValue(
              (propSchema as JSONSchema7).type,
              childType,
            );

            if (typeMatches) {
              // If form data type matches schema, use it
              result[name] = generateDefaultValue(
                propSchema as JSONSchema7,
                childFormData,
                propPath,
              );
            } else if (isRequired) {
              // If required but type doesn't match, generate default without using form data
              result[name] = generateDefaultValue(
                propSchema as JSONSchema7,
                undefined,
                propPath,
              );
            }
            // Skip non-required fields with wrong type (per test expectations)
          } else if (isRequired) {
            // Include required fields even if no form data
            result[name] = generateDefaultValue(
              propSchema as JSONSchema7,
              undefined,
              propPath,
            );
          }
        }
        return result;
      }
      return {};
    case "array":
      if (schema.default !== undefined) {
        return schema.default as SchemaType;
      }

      if (schema.items && !Array.isArray(schema.items)) {
        // Type guard for array form data
        const isFormDataArray = Array.isArray(formData);

        if (isFormDataArray) {
          // Process each item in the array
          const items = formData as unknown as SchemaType[];
          return items.map((item: SchemaType, index: number) => {
            const itemPath = fieldPath
              ? `${fieldPath}[${index}]`
              : `[${index}]`;
            return generateDefaultValue(
              schema.items as JSONSchema7,
              item,
              itemPath,
            );
          });
        }

        // Otherwise, check for minItems and create defaults
        const minItems = schema.minItems || 0;
        if (minItems > 0) {
          return Array(minItems)
            .fill(null)
            .map((_, index) => {
              const itemPath = fieldPath
                ? `${fieldPath}[${index}]`
                : `[${index}]`;
              return generateDefaultValue(
                schema.items as JSONSchema7,
                undefined,
                itemPath,
              );
            });
        }
      }
      return [];
    default:
      return null;
  }
}
