import {
  callFunction,
  createSandboxRuntime,
  inspect,
  installConsole,
  QuickJSHandle,
} from "@deco/cf-sandbox";
import { Validator } from "jsonschema";
import z from "zod";
import { createToolGroup, MCPClientStub } from "../context.ts";
import { slugify } from "../deconfig/api.ts";
import {
  assertWorkspaceResourceAccess,
  MCPClient,
  ProjectTools,
} from "../index.ts";

// Utility functions for consistent naming
const toolNameSlugify = (txt: string) => slugify(txt).toUpperCase();
const fileNameSlugify = (txt: string) => slugify(txt).toLowerCase();

// Cache for compiled validators
const validatorCache = new Map<string, Validator>();

function validate(instance: unknown, schema: Record<string, unknown>) {
  const schemaKey = JSON.stringify(schema);
  let validator = validatorCache.get(schemaKey);

  if (!validator) {
    validator = new Validator();
    validator.addSchema(schema);

    validatorCache.set(schemaKey, validator);
  }

  return validator.validate(instance, schema);
}

/**
 * Reads a tool definition from the workspace
 * @param name - The name of the tool
 * @param client - The MCP client
 * @param branch - The branch to read from
 * @returns The tool definition or null if not found
 */
async function readTool(
  name: string,
  client: ReturnType<typeof MCPClient.forContext>,
  branch?: string,
): Promise<z.infer<typeof ToolDefinitionSchema> | null> {
  try {
    const toolFileName = fileNameSlugify(name);
    const toolPath = `/src/tools/${toolFileName}.json`;

    const result = await client.READ_FILE({
      branch,
      path: toolPath,
      format: "json",
    });

    return result.content as z.infer<typeof ToolDefinitionSchema>;
  } catch {
    return null;
  }
}

export const createTool = createToolGroup("Sandbox", {
  name: "Code Sandbox",
  description: "Run JavaScript code",
  icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
});

const SANDBOX_CREATE_TOOL_DESCRIPTION = `Create a new tool in the sandbox with JSON Schema validation.
example, create a greeting tool pass the following arguments:

{
  name: "Greeting",
  description: "Greet the user",
  inputSchema: {
    "type": "object",
    "properties": {
      "name": { "type": "string" }
    },
    "required": ["name"]
  },
  outputSchema: {
    "type": "object",
    "properties": {
      "greeting": { "type": "string" }
    },
    "required": ["greeting"]
  },
  execute: "export default async function (input, ctx) { return { greeting: 'Hello, ' + input.name }; }"
}

The execute field can be either:
1. Inline ES module code (will be saved to /src/functions/{name}.ts)
2. A file:// URL to an existing function file

The execute should be a complete ES module with a default export function that has this exact signature:
async (input: typeof inputSchema, ctx: unknown): Promise<typeof outputSchema> => {}

Note: Both inputSchema and outputSchema must be valid JSON Schema objects. Input and output data will be validated against these schemas when the tool is created and executed.

Tools can call other tools using the env object from the ctx variable. For this, follow the format of the example below:
async (input: typeof inputSchema, ctx: unknown): Promise<typeof outputSchema> => {
  // some code
  const response = await ctx.env.<INTEGRATION_ID>.<TOOL_NAME>(<tool_arguments>);
  // some more code
  ...
}

INTEGRATION_ID is the ID of the integration that the tool belongs to (you can retrieve it with the INTEGRATIONS_LIST tool)
TOOL_NAME is the name of the tool to call from that integration (you can retrieve it with the INTEGRATIONS_LIST tool)
tool_arguments is the arguments to pass to the tool
`;

const ToolDefinitionSchema = z.object({
  name: z.string().describe("The name of the tool"),
  description: z.string().describe("The description of the tool"),
  inputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the input of the tool"),
  outputSchema: z
    .object({})
    .passthrough()
    .describe("The JSON schema of the output of the tool"),
  execute: z
    .string()
    .describe(
      "Either a file:// URL to an existing function file, or inline ES module code with default export function. If inline code is provided, it will be saved to /src/functions/{name}.ts",
    ),
});

export const evalCodeAndReturnDefaultHandle = async (
  code: string,
  runtimeId: string,
) => {
  // Create sandbox runtime to validate the function
  const runtime = await createSandboxRuntime(runtimeId, {
    memoryLimitBytes: 64 * 1024 * 1024, // 64MB
    stackSizeBytes: 1 << 20, // 1MB,
  });

  const ctx = runtime.newContext({ interruptAfterMs: 100 });

  // Install built-ins
  const guestConsole = installConsole(ctx);

  // Validate the function by evaluating it as an ES module
  const result = ctx.evalCode(code, "index.js", {
    strict: true,
    strip: true,
    type: "module",
  });

  let exportsHandle: QuickJSHandle;
  if (ctx.runtime.hasPendingJob()) {
    const promise = ctx.resolvePromise(ctx.unwrapResult(result));
    ctx.runtime.executePendingJobs();
    exportsHandle = ctx.unwrapResult(await promise);
  } else {
    exportsHandle = ctx.unwrapResult(result);
  }

  const defaultHandle = ctx.getProp(exportsHandle, "default");

  return {
    ctx,
    defaultHandle,
    guestConsole,
    [Symbol.dispose]: ctx.dispose.bind(ctx),
  };
};

const sandboxCreateTool = createTool({
  name: "SANDBOX_UPSERT_TOOL",
  description: SANDBOX_CREATE_TOOL_DESCRIPTION,
  inputSchema: ToolDefinitionSchema,
  outputSchema: z.object({
    success: z.boolean().describe("Whether the tool was created successfully"),
    error: z
      .string()
      .optional()
      .describe("Compilation or validation error if any"),
  }),
  handler: async (
    { name, description, inputSchema, outputSchema, execute },
    c,
  ) => {
    await assertWorkspaceResourceAccess(c);

    const runtimeId = c.locator?.value ?? "default";
    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);
    const filename = fileNameSlugify(name);
    const toolName = toolNameSlugify(name);

    try {
      // Determine if execute is a file:// URL or inline code
      const isFileUrl = execute.startsWith("file://");
      let functionCode: string;
      let functionPath: string;

      if (isFileUrl) {
        // It's already a file:// URL, use it as is
        functionPath = execute.replace("file://", "");

        // Read the existing file to validate it
        const fileResult = await client.READ_FILE({
          branch,
          path: functionPath,
        });
        functionCode = fileResult.content;
      } else {
        // It's inline code, save it to a file
        functionPath = `/src/functions/${filename}.ts`;
        functionCode = execute;

        await client.PUT_FILE({
          branch,
          path: functionPath,
          content: functionCode,
        });
      }

      using evaluation = await evalCodeAndReturnDefaultHandle(
        functionCode,
        runtimeId,
      );
      const { ctx, defaultHandle } = evaluation;

      if (ctx.typeof(defaultHandle) !== "function") {
        return {
          success: false,
          error: "Module must export a default function",
        };
      }

      // Store the tool metadata with file reference
      const toolPath = `/src/tools/${filename}.json`;

      const toolData = {
        name: toolName,
        description,
        inputSchema,
        outputSchema,
        execute: `file://${functionPath}`,
      };

      await client.PUT_FILE({
        branch,
        path: toolPath,
        content: JSON.stringify(toolData, null, 2),
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: inspect(error),
      };
    }
  },
});

// Transform current workspace as callable integration environment
const asEnv = async (client: MCPClientStub<ProjectTools>) => {
  const { items } = await client.INTEGRATIONS_LIST({});

  const env: Record<
    string,
    Record<string, (args: unknown) => Promise<unknown>>
  > = {};

  for (const item of items) {
    // @ts-expect-error Somehow tools are not typed
    const tools = item.tools;

    if (!Array.isArray(tools)) {
      continue;
    }

    env[item.id] = Object.fromEntries(
      // deno-lint-ignore no-explicit-any
      tools.map((tool: any) => [
        tool.name,
        async (args: unknown) => {
          const inputValidation = validate(args, tool.inputSchema);

          if (!inputValidation.valid) {
            throw new Error(
              `Input validation failed: ${inspect(inputValidation)}`,
            );
          }

          const response = await client.INTEGRATIONS_CALL_TOOL({
            connection: item.connection,
            params: {
              name: tool.name,
              arguments: args as Record<string, unknown>,
            },
          });

          if (response.isError) {
            throw new Error(
              `Tool ${tool.name} returned an error: ${inspect(response)}`,
            );
          }

          if (response.structuredContent && tool.outputSchema) {
            const outputValidation = validate(
              response.structuredContent,
              tool.outputSchema,
            );

            if (!outputValidation.valid) {
              throw new Error(
                `Output validation failed: ${inspect(outputValidation)}`,
              );
            }

            return response.structuredContent;
          }

          return response.structuredContent || response.content;
        },
      ]),
    );
  }

  return env;
};

const sandboxRunTool = createTool({
  name: "SANDBOX_RUN_TOOL",
  description: "Run a tool in the sandbox",
  inputSchema: z.object({
    name: z.string().describe("The name of the tool"),
    input: z.object({}).passthrough().describe("The input of the tool"),
  }),
  outputSchema: z.object({
    result: z.any().optional().describe("The result of the tool execution"),
    error: z.any().optional().describe("Error if any"),
    logs: z
      .array(
        z.object({
          type: z.enum(["log", "warn", "error"]),
          content: z.string(),
        }),
      )
      .optional()
      .describe("Console logs from the execution"),
  }),
  handler: async ({ name, input }, c) => {
    await assertWorkspaceResourceAccess(c);

    const runtimeId = c.locator?.value ?? "default";
    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);

    const envPromise = asEnv(client);

    const tool = await readTool(name, client, branch);
    if (!tool) {
      return { error: "Tool not found" };
    }

    // Validate input against the tool's input schema
    const inputValidation = validate(input, tool.inputSchema);
    if (!inputValidation.valid) {
      return { error: `Input validation failed: ${inspect(inputValidation)}` };
    }

    // Load the function code from the file
    const functionPath = tool.execute.replace("file://", "");
    if (!functionPath) {
      return { error: "Tool function file not found" };
    }

    const functionResult = await client.READ_FILE({
      branch,
      path: functionPath,
      format: "plainString",
    });

    const functionCode = functionResult.content;

    using evaluation = await evalCodeAndReturnDefaultHandle(
      functionCode,
      runtimeId,
    );
    const { ctx, defaultHandle, guestConsole } = evaluation;

    try {
      const env = await envPromise;
      // Call the function using the callFunction utility
      const callHandle = await callFunction(
        ctx,
        defaultHandle,
        undefined,
        input,
        { env },
      );

      const callResult = ctx.dump(ctx.unwrapResult(callHandle));

      // Validate output against the tool's output schema
      const outputValidation = validate(callResult, tool.outputSchema);

      if (!outputValidation.valid) {
        return {
          error: `Output validation failed: ${inspect(outputValidation)}`,
          logs: guestConsole.logs,
        };
      }

      return { result: callResult, logs: guestConsole.logs };
    } catch (error) {
      return { error: inspect(error), logs: guestConsole.logs };
    }
  },
});

const getTool = createTool({
  name: "SANDBOX_GET_TOOL",
  description: "Get a tool from the sandbox",
  inputSchema: z.object({ name: z.string().describe("The name of the tool") }),
  outputSchema: z.object({
    tool: ToolDefinitionSchema.nullable().describe(
      "The tool definition. Null if not found",
    ),
  }),
  handler: async ({ name }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;
    const client = MCPClient.forContext(c);

    const tool = await readTool(name, client, branch);

    return { tool: tool ?? null };
  },
});

const deleteTool = createTool({
  name: "SANDBOX_DELETE_TOOL",
  description: "Delete a tool in the sandbox",
  inputSchema: z.object({ name: z.string().describe("The name of the tool") }),
  outputSchema: z.object({
    message: z.string().describe("The message of the tool"),
  }),
  handler: async ({ name }, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;

    try {
      const toolFileName = fileNameSlugify(name);
      const toolPath = `/src/tools/${toolFileName}.json`;

      const client = MCPClient.forContext(c);

      await client.DELETE_FILE({
        branch,
        path: toolPath,
      });

      return { message: "Tool deleted successfully" };
    } catch {
      return { message: "Tool deletion failed" };
    }
  },
});

const sandboxListTools = createTool({
  name: "SANDBOX_LIST_TOOLS",
  description: "List all tools in the sandbox",
  inputSchema: z.object({}),
  outputSchema: z.object({ tools: z.array(ToolDefinitionSchema) }),
  handler: async (_, c) => {
    await assertWorkspaceResourceAccess(c);

    const branch = c.locator?.branch;

    try {
      const client = MCPClient.forContext(c);
      const result = await client.LIST_FILES({
        branch,
        prefix: "/src/tools/",
      });

      const tools: z.infer<typeof ToolDefinitionSchema>[] = [];

      for (const filePath of Object.keys(result.files)) {
        if (filePath.endsWith(".json")) {
          // Extract tool name from file path (e.g., "/src/tools/greeting.json" -> "greeting")
          const toolName = filePath
            .replace("/src/tools/", "")
            .replace(".json", "");
          const tool = await readTool(toolName, client, branch);
          if (tool) {
            tools.push(tool);
          }
        }
      }

      return { tools };
    } catch {
      return { tools: [] };
    }
  },
});

export const SANDBOX_TOOLS = [
  sandboxCreateTool,
  getTool,
  deleteTool,
  sandboxRunTool,
  sandboxListTools,
];
