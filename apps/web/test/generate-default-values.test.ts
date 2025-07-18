/** biome-ignore-all lint/suspicious/noExplicitAny: fine for tests */
import type { JSONSchema7 } from "json-schema";
import { expect, test } from "vitest";
import { generateDefaultValues } from "../src/components/json-schema/utils/generate-default-values.ts";

test("generateDefaultValues - empty or invalid schema", () => {
  // Test with null or undefined schema
  expect(generateDefaultValues(null as unknown as JSONSchema7)).toEqual({});
  expect(generateDefaultValues(undefined as unknown as JSONSchema7)).toEqual(
    {},
  );

  // Test with non-object schema
  expect(generateDefaultValues({ type: "string" } as JSONSchema7)).toEqual({});
});

test("generateDefaultValues - schema with default value", () => {
  // Test schema with default value
  const schemaWithDefault: JSONSchema7 = {
    type: "object",
    default: { name: "Default Name", age: 25 },
  };

  const result = generateDefaultValues(schemaWithDefault);
  expect(result.name).toBe("Default Name");
  expect(result.age).toBe(25);
});

test("generateDefaultValues - basic object properties", () => {
  // Test object schema with properties
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      isActive: { type: "boolean" },
    },
    required: ["name", "isActive"],
  };

  const result = generateDefaultValues(schema);

  // Should have required properties
  expect(result.name).toBeDefined();
  expect(result.name).toBe("");

  expect(result.isActive).toBeDefined();
  expect(result.isActive).toBe(false);

  // Should not have optional properties
  expect(result.age).toBeUndefined();
});

test("generateDefaultValues - with formData", () => {
  // Test using existing form data
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      isActive: { type: "boolean" },
    },
  };

  const formData = {
    name: "John Doe",
    age: 30,
  };

  const result = generateDefaultValues(schema, formData);

  // Should preserve properties from formData
  expect(result.name).toBeDefined();
  expect(result.name).toBe("John Doe");

  expect(result.age).toBeDefined();
  expect(result.age).toBe(30);

  // Properties not in formData should not be included
  expect(result.isActive).toBeUndefined();
});

test("generateDefaultValues - anyOf schema", () => {
  // Test anyOf schema
  const anyOfSchema: JSONSchema7 = {
    anyOf: [
      {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
        required: ["name"],
      },
      {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
        },
        required: ["firstName", "lastName"],
      },
    ],
  };

  // Should select a schema from anyOf options
  const result = generateDefaultValues(anyOfSchema);
  expect(result).not.toEqual({});

  // Test anyOf with matching form data
  const formData = {
    firstName: "John",
    lastName: "Doe",
  };

  const resultWithFormData = generateDefaultValues(anyOfSchema, formData);
  expect(resultWithFormData.firstName).toBeDefined();
  expect(resultWithFormData.lastName).toBeDefined();
  expect(resultWithFormData.firstName).toBe("John");
  expect(resultWithFormData.lastName).toBe("Doe");
});

test("generateDefaultValues - nested objects", () => {
  // Test schema with nested objects
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

  const result = generateDefaultValues(nestedSchema) as any;

  // Check nested structure
  expect(result.user).toBeDefined();
  expect(result.user.name).toBeDefined();
  expect(result.user.address).toBeDefined();
  expect(result.user.address.street).toBeDefined();
  expect(result.user.address.street).toBe("");
  expect(result.user.address.city).toBeUndefined();
});

test("generateDefaultValues - nested objects with formData", () => {
  // Test schema with nested objects
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

  const formData = {
    user: {
      name: "John Smith",
      address: {
        street: "123 Main St",
        city: "Anytown",
      },
    },
  };

  const result = generateDefaultValues(nestedSchema, formData) as Record<
    string,
    any
  >;

  // Check that nested structure preserves formData values
  expect(result.user).toBeDefined();
  expect(result.user.name).toBe("John Smith");
  expect(result.user.address).toBeDefined();
  expect(result.user.address.street).toBe("123 Main St");
  expect(result.user.address.city).toBe("Anytown");
});

test("generateDefaultValues - with field path", () => {
  // Test with field path parameter
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
    },
    required: ["name", "age"],
  };

  const result = generateDefaultValues(schema, undefined, "user");

  expect(result.name).toBeDefined();
  expect(result.age).toBeDefined();
  expect(result.name).toBe("");
  expect(result.age).toBe(0);
});

test("generateDefaultValues - with formData type mismatch", () => {
  // Test handling of form data that doesn't match schema type
  const schema: JSONSchema7 = {
    type: "object",
    properties: {
      name: { type: "string", default: "Default Name" },
      age: { type: "number", default: 25 },
      isActive: { type: "boolean", default: true },
    },
  };

  const formData = {
    name: 42, // Not a string
    age: "thirty", // Not a number
    isActive: "yes", // Not a boolean
  };

  const result = generateDefaultValues(schema, formData);

  // Should use default values when types don't match
  expect(result.name).toBe("Default Name");
  expect(result.age).toBe(25);
  expect(result.isActive).toBe(true);
});
