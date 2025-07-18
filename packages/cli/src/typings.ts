// deno-lint-ignore-file no-explicit-any
import { compile } from "json-schema-to-typescript";
import { generateName } from "json-schema-to-typescript/dist/src/utils.js";
import type { DecoBinding } from "./config.ts";
import { createWorkspaceClient } from "./mcp.ts";

interface Options {
  workspace: string;
  local?: boolean;
  bindings: DecoBinding[];
  selfUrl?: string;
}

function slugify(name: string) {
  return name.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

/**
 * format content based on deno fmt
 * @param content the string content
 * @returns the formatted content
 */
export async function format(content: string): Promise<string> {
  const fmt = new Deno.Command(Deno.execPath(), {
    args: ["fmt", "-"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped", // Changed from "null" to capture errors
  });

  const proc = fmt.spawn();

  const raw = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(content));
      controller.close();
    },
  });

  await raw.pipeTo(proc.stdin);
  const out = await proc.output();
  const status = await proc.status;

  // Check if the command failed and print errors
  if (!status.success) {
    return content;
  }

  return new TextDecoder().decode(out.stdout);
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
  // Must start with letter, underscore, or dollar sign
  // Can contain letters, digits, underscores, or dollar signs
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

  const types = new Map<string, number>();
  let tsTypes = "";
  const props = await Promise.all(
    [
      ...bindings,
      ...DEFAULT_BINDINGS,
      ...(selfUrl
        ? [{ name: "SELF", type: "mcp", integration_url: selfUrl }]
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
        },
      })) as {
        structuredContent: {
          tools: { name: string; inputSchema: any; outputSchema?: any }[];
        };
      };

      if (!Array.isArray(tools.structuredContent?.tools)) {
        console.warn(
          `⚠️ No tools found for integration ${binding.name}. Skipping...`,
        );
        return null;
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
          return [t.name, inputName, outputTs ? outputName : undefined];
        }),
      );

      return [
        binding.name,
        compiledTools,
        stateKey,
        // propName, toolName, inputType, outputType
      ] as [
        string,
        [string, string, string | undefined][],
        KeyInfo | undefined,
      ];
    }),
  );

  return await format(`
    // deno-lint-ignore-file no-empty-interface
${tsTypes}
   // this should be added to your package.json
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
          [string, string, string | undefined][],
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
          .map(([toolName, inputName, outputName]) => {
            return `
          ${
            isValidJavaScriptPropertyName(toolName)
              ? toolName
              : [`"${toolName}"`]
          }: (input: ${inputName}) => Promise<${outputName ?? "any"}>;
          `;
          })
          .join("")}
      }>;`;
      })
      .join("")}
  }
  `);
};
