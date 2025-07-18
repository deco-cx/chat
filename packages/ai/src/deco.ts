// deno-lint-ignore-file no-explicit-any
import type { JSONSchema7 } from "@ai-sdk/provider";

export interface Tool {
  name: string;
  resolveType: string;
  description: string;
  outputSchema: JSONSchema7;
  inputSchema: JSONSchema7;
}

interface RootSchema extends JSONSchema7 {
  inputSchema?: string;
  outputSchema?: string;
}

const idFromDefinition = (definition: string) => {
  const [_, __, id] = definition.split("/");
  return id;
};

const RESOLVABLE_DEFINITION = "#/definitions/Resolvable";

// Add slugify helper function
const slugify = (name: string) => {
  return name.replace(/[./]/g, "-").replace(/[^a-zA-Z0-9_-]/g, "");
};

export function dereferenceSchema(
  schema: JSONSchema7 | undefined,
  definitions: { [key: string]: JSONSchema7 },
  visited = new Set<string>(),
): JSONSchema7 | undefined {
  if (!schema) return undefined;

  // Handle array types by converting to anyOf
  if (schema.type && Array.isArray(schema.type)) {
    const result: JSONSchema7 = {
      ...schema,
      anyOf: schema.type.map((t: any) => ({ type: t })),
    };
    delete result.type;
    return result;
  }

  // Handle direct $ref
  if ("$ref" in schema && typeof schema.$ref === "string") {
    const refId = idFromDefinition(schema.$ref);
    if (visited.has(refId)) {
      // Prevent infinite recursion
      return { type: "object", properties: {} };
    }
    visited.add(refId);
    const referencedSchema = definitions[refId];
    return dereferenceSchema(
      referencedSchema as JSONSchema7,
      definitions,
      visited,
    );
  }

  const result: JSONSchema7 = { ...schema };

  // Handle allOf
  if (result.allOf) {
    result.allOf = result.allOf.map((subSchema: any) =>
      dereferenceSchema(subSchema as JSONSchema7, definitions, visited),
    ) as JSONSchema7[];
  }

  // Handle anyOf
  if (result.anyOf) {
    result.anyOf = result.anyOf.map((subSchema: any) =>
      dereferenceSchema(subSchema as JSONSchema7, definitions, visited),
    ) as JSONSchema7[];
  }

  // Handle oneOf
  if (result.oneOf) {
    result.oneOf = result.oneOf.map((subSchema: any) =>
      dereferenceSchema(subSchema as JSONSchema7, definitions, visited),
    ) as JSONSchema7[];
  }

  // Handle properties
  if (result.properties) {
    const dereferencedProperties: { [key: string]: JSONSchema7 } = {};
    for (const [key, prop] of Object.entries(result.properties)) {
      dereferencedProperties[key] = dereferenceSchema(
        prop as JSONSchema7,
        definitions,
        visited,
      ) as JSONSchema7;
    }
    result.properties = dereferencedProperties;
  }

  // Handle additionalProperties
  if (
    result.additionalProperties &&
    typeof result.additionalProperties === "object"
  ) {
    result.additionalProperties = dereferenceSchema(
      result.additionalProperties as JSONSchema7,
      definitions,
      visited,
    );
  }

  return result;
}

export const getTools = (schemas?: any): Tool[] => {
  const toolNames = new Map<string, string>();
  if (!schemas) return [];

  const loaders = schemas?.root.loaders ?? { anyOf: [] };
  const actions = schemas?.root.actions ?? { anyOf: [] };
  const availableLoaders = "anyOf" in loaders ? (loaders.anyOf ?? []) : [];
  const availableActions = "anyOf" in actions ? (actions.anyOf ?? []) : [];

  const tools = [...availableLoaders, ...availableActions].map((func) => {
    func = func as RootSchema;
    if (!func.$ref || func.$ref === RESOLVABLE_DEFINITION) return;
    const funcDefinition = schemas.definitions[idFromDefinition(func.$ref)];
    const resolveType = (
      funcDefinition.properties?.__resolveType as { default: string }
    ).default;

    const getInputSchemaId = () => {
      if ("inputSchema" in func) {
        return func.inputSchema as string;
      }
      const props = funcDefinition.allOf ?? [];
      const propsSchema = props[0];
      const ref = (propsSchema as JSONSchema7)?.$ref;
      return ref;
    };

    const ref = getInputSchemaId();
    const rawInputSchema = ref
      ? schemas.definitions[idFromDefinition(ref)]
      : undefined;

    // Dereference the input schema
    const inputSchema = rawInputSchema
      ? dereferenceSchema(rawInputSchema as JSONSchema7, schemas.definitions)
      : undefined;

    const outputSchemaId =
      "outputSchema" in func ? (func.outputSchema as string) : undefined;

    const rawOutputSchema = outputSchemaId
      ? schemas.definitions[idFromDefinition(outputSchemaId)]
      : undefined;

    const selfReference = (rawOutputSchema?.anyOf ?? [])[0];

    const outputSchema = selfReference
      ? dereferenceSchema(selfReference as JSONSchema7, schemas.definitions)
      : undefined;

    // Handle tool name slugification and clashes
    let toolName =
      (funcDefinition as { name?: string })?.name ??
      (inputSchema as { name?: string })?.name ??
      slugify(resolveType);
    let idx = 1;

    while (toolNames.has(toolName) && toolNames.get(toolName) !== resolveType) {
      toolName = `${toolName}-${idx}`;
      idx++;
    }
    toolNames.set(toolName, resolveType);

    const normalizeSchema = (schema?: JSONSchema7): JSONSchema7 => {
      return schema && "type" in schema && schema.type === "object"
        ? schema
        : {
            type: "object",
            additionalProperties: true,
          };
    };
    return {
      name: toolName,
      resolveType,
      description:
        funcDefinition.description ?? inputSchema?.description ?? resolveType,
      outputSchema: normalizeSchema(outputSchema),
      inputSchema: normalizeSchema(inputSchema),
    };
  });

  return tools.filter((tool) => tool !== undefined);
};
