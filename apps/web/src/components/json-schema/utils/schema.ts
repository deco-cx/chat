import type { JSONSchema7 } from "json-schema";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import type { SchemaType } from "../index.tsx";
import { generateDefaultValues } from "./generate-default-values.ts";

// Format property name for display
export function formatPropertyName(name: string): string {
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str: string) => str.toUpperCase())
    .trim();
}

// Initialize form with smart anyOf schema selection based on existing data
export function initializeFormWithSchema<T extends Record<string, SchemaType>>(
  schema: JSONSchema7,
  existingData?: Partial<T>,
): T {
  // If we have existing data, use it to better select anyOf schemas
  if (existingData && Object.keys(existingData).length > 0) {
    return generateDefaultValues(
      schema,
      existingData as Record<string, SchemaType>,
    ) as T;
  }

  // Fall back to basic default generation
  return generateDefaultValues(schema) as T;
}

/**
 * Determines the appropriate data type for a value
 */
export function getDetectedType(value: SchemaType): string {
  const valueType = typeof value;

  // Enhanced type detection for special cases
  return valueType === "object" && value === null
    ? "null"
    : valueType === "object" && Array.isArray(value)
      ? "array"
      : valueType;
}

/**
 * Checks if a schema type matches a detected type
 */
export function doesSchemaTypeMatchValue(
  schemaType: string | string[] | undefined,
  detectedType: string,
): boolean {
  // If no type specified, it's a match
  if (schemaType === undefined) {
    return true;
  }

  // Handle array of types
  if (Array.isArray(schemaType)) {
    return schemaType.some((t) => {
      if (t === "integer" && detectedType === "number") return true;
      if (t === detectedType) return true;
      return false;
    });
  }

  // Handle single type
  if (schemaType === "integer" && detectedType === "number") {
    return true;
  }

  return schemaType === detectedType;
}

/**
 * Helper function to check if schema type matches runtime type
 */
export function typeMatches(
  schemaType: JSONSchema7["type"],
  runtimeType: string,
): boolean {
  if (schemaType === undefined) {
    return true; // If no type is specified in schema, it matches any type
  }

  if (Array.isArray(schemaType)) {
    return schemaType.some((t) => t === runtimeType);
  }

  // Special case for integers (typeof returns 'number')
  if (schemaType === "integer" && runtimeType === "number") {
    return true;
  }

  return schemaType === runtimeType;
}

/**
 * Finds a matching schema from anyOf that best fits the given value
 */
export function findMatchingAnyOfSchema(
  schemas: JSONSchema7[],
  value?: SchemaType,
  checkProperties: boolean = true,
): JSONSchema7 | undefined {
  // Can't match if there's no value
  if (value === undefined || value === null) {
    return undefined;
  }

  const detectedType = getDetectedType(value);

  // First try: Find schema with matching type that also validates the data
  const matchingSchema = schemas.find((subSchema) => {
    const schemaObj = subSchema as JSONSchema7;

    // Check if type matches
    if (!doesSchemaTypeMatchValue(schemaObj.type, detectedType)) {
      return false;
    }

    // For objects, do additional validation with properties
    if (
      checkProperties &&
      detectedType === "object" &&
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      schemaObj.properties
    ) {
      // Get keys from both schema and object
      const schemaKeys = Object.keys(schemaObj.properties);
      const valueKeys = Object.keys(value as Record<string, SchemaType>);

      // If the schema requires properties that don't exist in the value, it's not a match
      if (schemaObj.required) {
        const missingRequired = schemaObj.required.some(
          (req: string) => !valueKeys.includes(req),
        );
        if (missingRequired) {
          return false;
        }
      }

      // Check if there's significant overlap between schema properties and value properties
      const commonKeys = valueKeys.filter((key) => schemaKeys.includes(key));
      return commonKeys.length > 0;
    }

    // For arrays, check if the items schema matches
    if (
      detectedType === "array" &&
      Array.isArray(value) &&
      value.length > 0 &&
      schemaObj.items
    ) {
      // Basic array validation
      return true;
    }

    return true;
  });

  return matchingSchema as JSONSchema7 | undefined;
}

/**
 * Checks if a specific child field path matches a schema
 */
export function doesChildFieldMatchSchema(
  childPath: string,
  namePrefix: string,
  schema: JSONSchema7,
): boolean {
  if (schema.type !== "object" || !schema.properties) {
    return false;
  }

  const schemaProps = Object.keys(schema.properties);
  const childName = childPath.slice(namePrefix.length).split(".")[0];

  return schemaProps.includes(childName);
}

/**
 * Find a schema from anyOf based on child field structure
 */
export function findSchemaByChildFields<
  T extends FieldValues = Record<string, unknown>,
>(
  name: string,
  schemas: JSONSchema7[],
  form: UseFormReturn<T>,
): JSONSchema7 | undefined {
  const childFields = form.getValues();
  if (!childFields || typeof childFields !== "object") {
    return undefined;
  }

  const namePrefix = `${name}.`;
  const childFieldPaths = Object.keys(
    childFields as Record<string, unknown>,
  ).filter((path) => path.startsWith(namePrefix));

  if (childFieldPaths.length === 0) {
    return undefined;
  }

  // Find schema that best matches child field structure
  const bestMatchSchema = schemas.find((subSchema) => {
    for (const childPath of childFieldPaths) {
      if (
        doesChildFieldMatchSchema(
          childPath,
          namePrefix,
          subSchema as JSONSchema7,
        )
      ) {
        return true;
      }
    }
    return false;
  });

  return bestMatchSchema as JSONSchema7 | undefined;
}

/**
 * Find a schema from anyOf based on parent-child relationships
 * Implementation of the _checkParentChildRelationship function from Form.tsx
 */
export function findSchemaByParentRelationship<
  T extends FieldValues = Record<string, unknown>,
>(
  name: string,
  schema: JSONSchema7,
  form: UseFormReturn<T>,
): JSONSchema7 | undefined {
  // Split field name to get parent path
  const parentPath = name.split(".");
  if (parentPath.length <= 1) {
    return undefined; // No parent exists
  }

  // Remove the last segment to get parent path
  parentPath.pop();
  const parentName = parentPath.join(".");
  const parentValue = form.watch(parentName as Path<T>);

  if (!parentValue || typeof parentValue !== "object" || parentValue === null) {
    return undefined;
  }

  // Safely cast parentValue to Record to work with properties
  const parentRecord = parentValue as Record<string, unknown>;

  // Try to find schema that best matches based on parent context
  if (schema.anyOf && Array.isArray(schema.anyOf)) {
    // First strategy: Look for a type property in parent
    if ("type" in parentRecord && typeof parentRecord.type === "string") {
      // Try to match schema title or a property with parent's type
      const matchByTitle = schema.anyOf.find((s) => {
        const schemaObj = s as JSONSchema7;
        return (
          schemaObj.title?.toLowerCase() ===
          parentRecord.type?.toString().toLowerCase()
        );
      });

      if (matchByTitle) {
        return matchByTitle as JSONSchema7;
      }

      // Try by specific property that might indicate type
      const matchByProperty = schema.anyOf.find((s) => {
        const schemaObj = s as JSONSchema7;
        if (schemaObj.properties) {
          const props = Object.entries(schemaObj.properties);
          return props.some(([key, propDef]) => {
            const propSchema = propDef as JSONSchema7;
            return (
              (key === "type" || key === "kind" || key.endsWith("Type")) &&
              propSchema.enum?.includes(parentRecord.type as string)
            );
          });
        }
        return false;
      });

      if (matchByProperty) {
        return matchByProperty as JSONSchema7;
      }
    }

    // Second strategy: Check if parent has properties that match one schema better
    return schema.anyOf.find((subSchema) => {
      const schemaObj = subSchema as JSONSchema7;

      // Skip non-object schemas
      if (schemaObj.type !== "object" || !schemaObj.properties) {
        return false;
      }

      // If the schema has a discriminator property, check if it exists in parent
      // Note: discriminator is an OpenAPI extension not in standard JSON Schema
      const extendedSchema = schemaObj as JSONSchema7 & {
        discriminator?: {
          propertyName?: string;
          mapping?: Record<string, string>;
        };
      };

      if (extendedSchema.discriminator) {
        const { propertyName, mapping } = extendedSchema.discriminator;

        if (propertyName && propertyName in parentRecord) {
          const discriminatorValue = parentRecord[propertyName];
          // Check if this value matches any mapping
          if (
            mapping &&
            typeof discriminatorValue === "string" &&
            discriminatorValue in mapping
          ) {
            return true;
          }
        }
      }

      return false;
    }) as JSONSchema7 | undefined;
  }

  return undefined;
}

/**
 * Get the default schema from anyOf using prioritization rules
 */
export function getDefaultAnyOfSchema(schemas: JSONSchema7[]): JSONSchema7 {
  // First try to find a schema with a default value
  const schemaWithDefault = schemas.find(
    (s) => (s as JSONSchema7).default !== undefined,
  );

  // Then try to find a non-null schema
  const nonNullSchema = !schemaWithDefault
    ? schemas.find((s) => {
        const schemaType = (s as JSONSchema7).type;
        if (Array.isArray(schemaType)) {
          return !schemaType.includes("null");
        }
        return schemaType !== "null";
      })
    : null;

  // Choose the best schema based on priority: default value > non-null > first item
  return (schemaWithDefault || nonNullSchema || schemas[0]) as JSONSchema7;
}

/**
 * Select the best matching schema from anyOf
 * This is a unified function that implements the algorithm used in both
 * Form.tsx and generateDefaultValues.ts
 */
export function selectAnyOfSchema<
  T extends FieldValues = Record<string, unknown>,
>(
  schema: JSONSchema7,
  formData?: SchemaType | Record<string, SchemaType>,
  form?: UseFormReturn<T>,
  fieldName?: string,
): JSONSchema7 {
  if (
    !schema.anyOf ||
    !Array.isArray(schema.anyOf) ||
    schema.anyOf.length === 0
  ) {
    return schema;
  }

  const schemas = schema.anyOf as JSONSchema7[];

  // If we have form data and a field name, try to find a schema based on the current field value
  if (form && fieldName) {
    const currentValue = form.watch(fieldName as Path<T>);

    // Try to match based on the current field value
    const matchingSchema = findMatchingAnyOfSchema(
      schemas,
      currentValue as SchemaType,
      true,
    );
    if (matchingSchema) {
      return matchingSchema;
    }

    // Try to match based on parent-child relationships
    const parentRelatedSchema = findSchemaByParentRelationship(
      fieldName,
      schema,
      form,
    );
    if (parentRelatedSchema) {
      return parentRelatedSchema;
    }

    // Try to match based on child fields
    const childFieldsSchema = findSchemaByChildFields(fieldName, schemas, form);
    if (childFieldsSchema) {
      return childFieldsSchema;
    }
  }

  // If we have form data but no specific field context, try direct matching
  if (formData) {
    const matchingSchema = findMatchingAnyOfSchema(
      schemas,
      formData as SchemaType,
      true,
    );
    if (matchingSchema) {
      return matchingSchema;
    }
  }

  // Fall back to default prioritization
  return getDefaultAnyOfSchema(schemas);
}
