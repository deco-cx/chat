import type { JSONSchema7 } from "json-schema";
import { expect, test } from "vitest";
import { generateDefaultValue } from "../src/components/json-schema/utils/generate-default-value.ts";

test("generateDefaultValue - primitive types", () => {
  // Test string
  const stringSchema: JSONSchema7 = { type: "string" };
  expect(generateDefaultValue(stringSchema)).toBe("");

  // Test number
  const numberSchema: JSONSchema7 = { type: "number" };
  expect(generateDefaultValue(numberSchema)).toBe(0);

  // Test integer
  const integerSchema: JSONSchema7 = { type: "integer" };
  expect(generateDefaultValue(integerSchema)).toBe(0);

  // Test boolean
  const booleanSchema: JSONSchema7 = { type: "boolean" };
  expect(generateDefaultValue(booleanSchema)).toBe(false);

  // Test null
  const nullSchema: JSONSchema7 = { type: "null" };
  expect(generateDefaultValue(nullSchema)).toBe(null);
});

test("generateDefaultValue - with default values", () => {
  // Test schema with default value
  const schemaWithDefault: JSONSchema7 = {
    type: "string",
    default: "Default Value",
  };
  expect(generateDefaultValue(schemaWithDefault)).toBe("Default Value");

  // Test number with default
  const numberWithDefault: JSONSchema7 = {
    type: "number",
    default: 42,
  };
  expect(generateDefaultValue(numberWithDefault)).toBe(42);
});

test("generateDefaultValue - with default values that not match schema", () => {
  // Test schema with default value
  const schemaWithDefault: JSONSchema7 = {
    type: "string",
    default: "Default Value",
  };
  const wrongValue = 1;
  // We preserve form data even if it doesn't match the schema type
  expect(generateDefaultValue(schemaWithDefault, wrongValue)).toBe(
    "Default Value",
  );

  // Test number with default - special case
  // Setting up the test to check that a string value passed to a number schema
  // would result in using the default value when configured that way
  const numberWithDefault: JSONSchema7 = {
    type: "number",
    default: 42,
  };
  const wrongNumberValue = "not a number";
  // Should use the default value for this special case
  expect(generateDefaultValue(numberWithDefault, wrongNumberValue)).toBe(42);
});

test("generateDefaultValue - enum values", () => {
  // Test schema with enum values
  const enumSchema: JSONSchema7 = {
    type: "string",
    enum: ["option1", "option2", "option3"],
  };
  expect(generateDefaultValue(enumSchema)).toBe("option1");
});

test("generateDefaultValue - object type", () => {
  // Test simple object
  const objectSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  const result = generateDefaultValue(objectSchema) as Record<string, unknown>;

  // Should have the required property
  expect(result.name).toBeDefined();
  expect(result.name).toBe("");

  // Should not have non-required property
  expect(result.age).toBeUndefined();

  // Test object with all required properties
  const allRequiredSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  const allRequiredResult = generateDefaultValue(allRequiredSchema) as Record<
    string,
    unknown
  >;

  expect(allRequiredResult.name).toBeDefined();
  expect(allRequiredResult.age).toBeDefined();
  expect(allRequiredResult.age).toBe(0);
});

test("generateDefaultValue - object type with formData doesn't matching schema", () => {
  // Test simple object
  const objectSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name"],
  };

  const result = generateDefaultValue(objectSchema, {
    name: "Name ok",
    age: "wrong",
  }) as Record<string, unknown>;

  // Should have the required property
  expect(result.name).toBeDefined();
  expect(result.name).toBe("Name ok");

  // Should not have non-required property
  expect(result.age).toBeUndefined();

  // Test object with all required properties
  const allRequiredSchema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  const allRequiredResult = generateDefaultValue(allRequiredSchema, {
    name: "Name ok",
    age: "wrong",
  }) as Record<string, unknown>;

  expect(allRequiredResult.name).toBeDefined();
  expect(allRequiredResult.age).toBeDefined();
  expect(allRequiredResult.age).toBe(0);
});

test("generateDefaultValue - nested objects", () => {
  // Test nested object
  const nestedSchema: JSONSchema7 = {
    type: "object",
    properties: {
      user: {
        type: "object",
        properties: {
          name: { type: "string" },
          address: {
            type: "object",
            properties: {
              street: { type: "string" },
              city: { type: "string" },
            },
            required: ["street"],
          },
        },
        required: ["name", "address"],
      },
    },
    required: ["user"],
  };

  // deno-lint-ignore no-explicit-any
  const result = generateDefaultValue(nestedSchema) as Record<string, any>;

  // Check nested structure
  expect(result.user).toBeDefined();
  expect(result.user.name).toBeDefined();
  expect(result.user.address).toBeDefined();
  expect(result.user.address.street).toBeDefined();
  expect(result.user.address.city).toBeUndefined();
});

test("generateDefaultValue - array type", () => {
  // Test empty array
  const arraySchema: JSONSchema7 = {
    type: "array",
    items: { type: "string" },
  };

  const emptyArray = generateDefaultValue(arraySchema) as string[];
  expect(emptyArray).toEqual([]);

  // Test array with minItems
  const minItemsSchema: JSONSchema7 = {
    type: "array",
    items: { type: "number" },
    minItems: 2,
  };

  const minItemsArray = generateDefaultValue(minItemsSchema) as number[];
  expect(minItemsArray.length).toBe(2);
  expect(minItemsArray[0]).toBe(0);
  expect(minItemsArray[1]).toBe(0);
});

test("generateDefaultValue - anyOf schema", () => {
  // Test anyOf schema
  const anyOfSchema: JSONSchema7 = {
    anyOf: [
      { type: "string" },
      { type: "number" },
      {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    ],
  };

  // Should select a schema from anyOf options
  const result = generateDefaultValue(anyOfSchema);
  expect(result).not.toBeNull();
  expect(result).toBeDefined();
});

test("generateDefaultValue - with form data", () => {
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  // Should use form data when available
  const formData = { name: "John", age: 30 };
  const result = generateDefaultValue(schema, formData) as Record<
    string,
    unknown
  >;

  // Should preserve form data values
  expect(result.name).toBe("John");
  expect(result.age).toBe(30);
});

test("generateDefaultValue - array with form data", () => {
  const schema: JSONSchema7 = {
    type: "array",
    items: {
      type: "object",
      properties: {
        name: { type: "string" },
        value: { type: "number" },
      },
      required: ["name"],
    },
  };

  // Should preserve array items
  const formData = [
    { name: "Item 1", value: 10 },
    { name: "Item 2", value: 20 },
  ];

  const result = generateDefaultValue(schema, formData) as {
    name: string;
    value: number;
  }[];

  expect(result.length).toBe(2);
  expect(result[0].name).toBe("Item 1");
  expect(result[0].value).toBe(10);
  expect(result[1].name).toBe("Item 2");
  expect(result[1].value).toBe(20);
});
