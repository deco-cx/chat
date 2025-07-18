import {
  doesChildFieldMatchSchema,
  doesSchemaTypeMatchValue,
  findMatchingAnyOfSchema,
  formatPropertyName,
  getDefaultAnyOfSchema,
  getDetectedType,
  selectAnyOfSchema,
  typeMatches,
} from "../src/components/json-schema/utils/schema.ts";
import type { JSONSchema7 } from "json-schema";
import { expect, test } from "vitest";

test("formatPropertyName", () => {
  // Test camelCase to Title Case
  expect(formatPropertyName("firstName")).toBe("First Name");

  // Test snake_case to Title Case (won't work without additional handling)
  expect(formatPropertyName("first_name")).toBe("First_name");

  // Test already capitalized word
  expect(formatPropertyName("FirstName")).toBe("First Name");

  // Test single character
  expect(formatPropertyName("a")).toBe("A");

  // Test empty string
  expect(formatPropertyName("")).toBe("");
});

test("getDetectedType", () => {
  // Test primitive types
  expect(getDetectedType("string value")).toBe("string");
  expect(getDetectedType(123)).toBe("number");
  expect(getDetectedType(true)).toBe("boolean");

  // Test null
  expect(getDetectedType(null)).toBe("null");

  // Test arrays
  expect(getDetectedType([1, 2, 3])).toBe("array");
  expect(getDetectedType([])).toBe("array");

  // Test objects
  expect(getDetectedType({ key: "value" })).toBe("object");
  expect(getDetectedType({})).toBe("object");
});

test("doesSchemaTypeMatchValue", () => {
  // Test undefined schema type (should match anything)
  expect(doesSchemaTypeMatchValue(undefined, "string")).toBe(true);

  // Test string type
  expect(doesSchemaTypeMatchValue("string", "string")).toBe(true);
  expect(doesSchemaTypeMatchValue("string", "number")).toBe(false);

  // Test number/integer type
  expect(doesSchemaTypeMatchValue("number", "number")).toBe(true);
  expect(doesSchemaTypeMatchValue("integer", "number")).toBe(true);

  // Test array of types
  expect(doesSchemaTypeMatchValue(["string", "null"], "string")).toBe(true);
  expect(doesSchemaTypeMatchValue(["string", "number"], "boolean")).toBe(false);
  expect(doesSchemaTypeMatchValue(["integer", "null"], "number")).toBe(true);
});

test("typeMatches", () => {
  // Test undefined schema type (should match anything)
  expect(typeMatches(undefined, "string")).toBe(true);

  // Test string type
  expect(typeMatches("string", "string")).toBe(true);
  expect(typeMatches("string", "number")).toBe(false);

  // Test number/integer type
  expect(typeMatches("number", "number")).toBe(true);
  expect(typeMatches("integer", "number")).toBe(true);

  // Test array of types
  expect(typeMatches(["string", "null"], "string")).toBe(true);
  expect(typeMatches(["string", "number"], "boolean")).toBe(false);
});

test("findMatchingAnyOfSchema - basic type matching", () => {
  const schemas: JSONSchema7[] = [
    { type: "string" },
    { type: "number" },
    { type: "object", properties: { name: { type: "string" } } },
  ];

  // Test matching by type
  const stringSchema = findMatchingAnyOfSchema(schemas, "test string");
  expect(stringSchema?.type).toBe("string");

  const numberSchema = findMatchingAnyOfSchema(schemas, 42);
  expect(numberSchema?.type).toBe("number");

  // Test no match
  const noMatch = findMatchingAnyOfSchema(schemas, true);
  expect(noMatch).toBeUndefined();
});

test("findMatchingAnyOfSchema - object properties matching", () => {
  const schemas: JSONSchema7[] = [
    {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
    },
    {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
      },
    },
  ];

  // Test matching by properties
  const nameAgeSchema = findMatchingAnyOfSchema(schemas, {
    name: "John",
    age: 30,
  });
  expect(nameAgeSchema?.properties?.name).toBeDefined();
  expect(nameAgeSchema?.properties?.age).toBeDefined();

  const nameSchema = findMatchingAnyOfSchema(schemas, {
    firstName: "John",
    lastName: "Doe",
  });
  expect(nameSchema?.properties?.firstName).toBeDefined();
  expect(nameSchema?.properties?.lastName).toBeDefined();
});

test("findMatchingAnyOfSchema - required properties", () => {
  const schemas: JSONSchema7[] = [
    {
      type: "object",
      properties: {
        name: { type: "string" },
        age: { type: "number" },
      },
      required: ["name", "age"],
    },
  ];

  // Should match when all required properties exist
  const match = findMatchingAnyOfSchema(schemas, { name: "John", age: 30 });
  expect(match).toBeDefined();

  // Should not match when required properties are missing
  const noMatch = findMatchingAnyOfSchema(schemas, { name: "John" });
  expect(noMatch).toBeUndefined();
});

test("doesChildFieldMatchSchema", () => {
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
  };

  // Test matching field
  expect(doesChildFieldMatchSchema("user.name", "user.", schema)).toBe(true);
  expect(doesChildFieldMatchSchema("user.age", "user.", schema)).toBe(true);

  // Test non-matching field
  expect(doesChildFieldMatchSchema("user.email", "user.", schema)).toBe(false);

  // Test non-object schema
  expect(
    doesChildFieldMatchSchema("user.name", "user.", { type: "string" }),
  ).toBe(false);
});

test("getDefaultAnyOfSchema", () => {
  // Test schema with default
  const schemasWithDefault: JSONSchema7[] = [
    { type: "string" },
    { type: "number", default: 42 },
    { type: "boolean" },
  ];
  const defaultSchema = getDefaultAnyOfSchema(schemasWithDefault);
  expect(defaultSchema.type).toBe("number");
  expect(defaultSchema.default).toBe(42);

  // Test non-null preference
  const schemasWithNull: JSONSchema7[] = [
    { type: "null" },
    { type: "string" },
    { type: ["number", "null"] },
  ];
  const nonNullSchema = getDefaultAnyOfSchema(schemasWithNull);
  expect(nonNullSchema.type).toBe("string");

  // Test first item fallback
  const basicSchemas: JSONSchema7[] = [{ type: "boolean" }, { type: "string" }];
  const firstSchema = getDefaultAnyOfSchema(basicSchemas);
  expect(firstSchema.type).toBe("boolean");
});

test("selectAnyOfSchema - with form data", () => {
  const schema: JSONSchema7 = {
    anyOf: [
      { type: "string" },
      { type: "number" },
      {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      },
    ],
  };

  // Test with string data
  const stringSchema = selectAnyOfSchema(schema, "test");
  expect(stringSchema.type).toBe("string");

  // Test with object data
  const objectSchema = selectAnyOfSchema(schema, { name: "John" });
  expect(objectSchema.type).toBe("object");

  // Test with no matching data
  const anySchema = selectAnyOfSchema(schema, true);
  expect(anySchema).toBeDefined(); // Should return default schema
});
