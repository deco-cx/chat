// deno-lint-ignore-file no-explicit-any
import { compile } from "json-schema-to-typescript";
import { generateName } from "json-schema-to-typescript/dist/src/utils.js";
import type { DecoBinding } from "../../lib/config.js";
import { createWorkspaceClient } from "../../lib/mcp.js";
import { spawn } from "child_process";
import { parser as scopeParser } from "../../lib/parse-binding-tool.js";

interface Options {
  workspace: string;
  local?: boolean;
  bindings: DecoBinding[];
  selfUrl?: string;
}

const toValidProperty = (property: string) => {
  return isValidJavaScriptPropertyName(property)
    ? property
    : `["${property}"]`;
}

// Sanitize description for safe use in JSDoc block comments
const formatDescription = (desc: string | undefined) => {
  if (!desc) return "";

  return (
    desc
      // Escape */ sequences that would break the comment block
      .replace(/\*\//g, "*\\/")
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Split into lines and format each line
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => ` * ${line}`)
      .join("\n")
  );
};

function slugify(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * Format content using Prettier instead of deno fmt
 */
export function format(content: string): Promise<string> {
  try {
    // Try to format using npx prettier if available
    const prettier = spawn("npx", ["prettier", "--parser", "typescript"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let formatted = "";
    let error = "";

    prettier.stdout.on("data", (data) => {
      formatted += data.toString();
    });

    prettier.stderr.on("data", (data) => {
      error += data.toString();
    });

    prettier.stdin.write(content);
    prettier.stdin.end();

    return new Promise((resolve) => {
      prettier.on("close", (code) => {
        if (code === 0 && formatted) {
          resolve(formatted);
        } else {
          // If prettier fails, return original content
          resolve(content);
        }
      });
    });
  } catch {
    // If prettier is not available, return original content
    return Promise.resolve(content);
  }
}

// Shared list of reserved JavaScript keywords
const RESERVED_KEYWORDS = [
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
  "enum",
  "await",
  "implements",
  "interface",
  "package",
  "private",
  "protected",
  "public",
  "static",
  "abstract",
  "boolean",
  "byte",
  "char",
  "double",
  "final",
  "float",
  "goto",
  "int",
  "long",
  "native",
  "short",
  "synchronized",
  "throws",
  "transient",
  "volatile",
  "null",
  "true",
  "false",
  "undefined",
  "NaN",
  "Infinity",
];

function isValidJavaScriptPropertyName(name: string): boolean {
  // Check if it's a valid JavaScript identifier
  const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

  if (!validIdentifierRegex.test(name)) {
    return false;
  }

  // Check for reserved keywords
  return !RESERVED_KEYWORDS.includes(name);
}

type KeyInfo = { type: string; key: string };

const DEFAULT_BINDINGS: DecoBinding[] = [
  {
    name: "DECO_CHAT_WORKSPACE_API",
    integration_id: "i:workspace-management",
    type: "mcp",
  },
  {
    name: "DECO_CHAT_API",
    integration_id: "i:user-management",
    type: "mcp",
  },
];

export const genEnv = async ({
  workspace,
  local,
  bindings,
  selfUrl,
}: Options) => {
  const client = await createWorkspaceClient({ workspace, local });
  const apiClient = await createWorkspaceClient({ local });

  try {
    const types = new Map<string, number>();
    types.set("Env", 1); // set the default env type
    let tsTypes = "";
    const mapBindingTools: Record<string, string[]> = {};
    const props = await Promise.all(
      [
        ...bindings,
        ...DEFAULT_BINDINGS,
        ...(selfUrl
          ? [
              {
                name: "SELF",
                type: "mcp" as const,
                integration_url: selfUrl,
                ignoreCache: true,
              },
            ]
          : []),
      ].map(async (binding) => {
        let connection: unknown;
        let stateKey: KeyInfo | undefined;
        if ("integration_id" in binding) {
          const integration = (await client.callTool({
            name: "INTEGRATIONS_GET",
            arguments: {
              id: binding.integration_id,
            },
          })) as { structuredContent: { connection: unknown } };
          connection = integration.structuredContent.connection;
        } else if ("integration_name" in binding) {
          stateKey = { type: binding.integration_name, key: binding.name };
          const app = (await client.callTool({
            name: "REGISTRY_GET_APP",
            arguments: {
              name: binding.integration_name,
            },
          })) as { structuredContent: { connection: unknown } };
          connection = app.structuredContent.connection;
        } else if ("integration_url" in binding) {
          connection = {
            type: "HTTP",
            url: binding.integration_url,
          };
        } else {
          throw new Error(`Unknown binding type: ${binding}`);
        }

        const tools = (await apiClient.callTool({
          name: "INTEGRATIONS_LIST_TOOLS",
          arguments: {
            connection,
            ignoreCache:
              "ignoreCache" in binding ? binding.ignoreCache : undefined,
          },
        })) as {
          structuredContent: {
            tools: {
              name: string;
              inputSchema: any;
              outputSchema?: any;
              description?: string;
            }[];
          };
        };

        if (!Array.isArray(tools.structuredContent?.tools)) {
          console.warn(
            `⚠️ No tools found for integration ${binding.name}. Skipping...`,
          );
          return null;
        }

        if ("integration_name" in binding) {
          mapBindingTools[binding.name] = tools.structuredContent
            .tools.map((t) => t.name);
        }

        const compiledTools = await Promise.all(
          tools.structuredContent.tools.map(async (t) => {
            const jsName = generateName(t.name, new Set());
            const inputName = `${jsName}Input`;
            const outputName = `${jsName}Output`;
            const customName = (schema: any) => {
              let typeName = schema.title ?? schema.type;
              if (Array.isArray(typeName)) {
                typeName = typeName.join(",");
              }

              if (typeof typeName !== "string") {
                return undefined;
              }
              const key = slugify(typeName);
              const count = types.get(key) ?? 0;
              types.set(key, count + 1);
              return count ? `${typeName}_${count}` : typeName;
            };
            const [inputTs, outputTs] = await Promise.all([
              compile({ ...t.inputSchema, title: inputName }, inputName, {
                additionalProperties: false,
                customName,
                format: false,
              }),
              t.outputSchema
                ? await compile(
                    { ...t.outputSchema, title: outputName },
                    outputName,
                    {
                      customName,
                      additionalProperties: false,
                      format: false,
                    },
                  )
                : undefined,
            ]);
            tsTypes += `
        ${inputTs}
        ${outputTs ?? ""}
          `;
            return [
              t.name,
              inputName,
              outputTs ? outputName : undefined,
              t.description,
            ];
          }),
        );

        return [binding.name, compiledTools, stateKey] as [
          string,
          [string, string, string | undefined, string | undefined][],
          KeyInfo | undefined,
        ];
      }),
    );

    return await format(`
    // Generated types - do not edit manually
${tsTypes}
   
  import { z } from "zod";

  export type Mcp<T extends Record<string, (input: any) => Promise<any>>> = {
    [K in keyof T]: ((input: Parameters<T[K]>[0]) => Promise<ReturnType<T[K]>>) & {
      asTool: () => Promise<{
        inputSchema: z.ZodType<Parameters<T[K]>[0]>
        outputSchema?: z.ZodType<ReturnType<T[K]>>
        description: string
        id: string
        execute: ({ context }: { context: Parameters<T[K]>[0] }) => Promise<ReturnType<T[K]>>
      }>
    }
  }

  export const StateSchema = z.object({
    ${props
      .filter((p) => p !== null && p[2] !== undefined)
      .map((prop) => {
        const [_, __, stateKey] = prop as [
          string,
          [string, string, string | undefined, string | undefined][],
          KeyInfo | undefined,
        ];
        return `${stateKey!.key}: z.object({
        value: z.string(),
        __type: z.literal("${stateKey!.type}").default("${stateKey!.type}"),
      })`;
      })
      .join(",\n")}
  })

  export interface Env {
    DECO_CHAT_WORKSPACE: string;
    DECO_CHAT_API_JWT_PUBLIC_KEY: string;
    ${props
      .filter((p) => p !== null)
      .map(([propName, tools]) => {
        return `${propName}: Mcp<{
        ${tools
          .map(([toolName, inputName, outputName, description]) => {
            const docComment = description
              ? `/**\n${formatDescription(description)}\n */`
              : "";

            return `${docComment}
          ${
              toValidProperty(toolName)
            }: (input: ${inputName}) => Promise<${outputName ?? "any"}>;
          `;
          })
          .join("")}
      }>;`;
      })
      .join("")}
  }

  export const Policies = {
    ${
      Object.entries(mapBindingTools).map(([bindingName, tools]) =>
        `${toValidProperty(bindingName)}: {
      ${
          tools.map((toolName) =>
            `${toValidProperty(toolName)}: "${
              scopeParser.fromBindingToolToScope({ bindingName, toolName })
            }"`
          )
            .join(",\n")
        }
    }`
      ).join(",\n")
    }
  }
  `);
  } finally {
    // Clean up the client connections
    await client.close();
    await apiClient.close();
  }
};
