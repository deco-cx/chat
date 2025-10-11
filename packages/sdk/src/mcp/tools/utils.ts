import {
  callFunction,
  createSandboxRuntime,
  inspect,
  installConsole,
  QuickJSHandle,
} from "@deco/cf-sandbox";
import { proxyConnectionForId } from "@deco/workers-runtime";
import { Validator } from "jsonschema";
import { MCPClientStub } from "../context.ts";
import { slugify } from "../deconfig/api.ts";
import { ProjectTools } from "../index.ts";

// Utility functions for consistent naming
export const toolNameSlugify = (txt: string) => slugify(txt).toUpperCase();
export const fileNameSlugify = (txt: string) => slugify(txt).toLowerCase();

// Cache for compiled validators
const validatorCache = new Map<string, Validator>();

export function validate(instance: unknown, schema: Record<string, unknown>) {
  const schemaKey = JSON.stringify(schema);
  let validator = validatorCache.get(schemaKey);

  if (!validator) {
    validator = new Validator();
    validator.addSchema(schema);

    validatorCache.set(schemaKey, validator);
  }

  return validator.validate(instance, schema);
}

// Common function for evaluating code and returning default handle
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

// Transform current workspace as callable integration environment
export const asEnv = async (
  client: MCPClientStub<ProjectTools>,
  {
    authorization,
    workspace,
  }: { authorization?: string; workspace?: string } = {},
) => {
  const { items } = await client.INTEGRATIONS_LIST({});

  const env: Record<
    string,
    Record<string, (args: unknown) => Promise<unknown>>
  > = {};

  for (const item of items) {
    if (!("tools" in item)) {
      continue;
    }
    const tools = item.tools;

    if (!Array.isArray(tools)) {
      continue;
    }

    env[item.id] = Object.fromEntries(
      tools.map((tool) => [
        tool.name,
        async (args: unknown) => {
          const inputValidation = validate(args, tool.inputSchema);

          if (!inputValidation.valid) {
            throw new Error(
              `Input validation failed: ${inspect(inputValidation)}`,
            );
          }

          let connection = item.connection;

          if (authorization && workspace) {
            connection = proxyConnectionForId(item.id, {
              workspace: workspace,
              token: authorization,
            });
          }

          const response = await client.INTEGRATIONS_CALL_TOOL({
            connection,
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

// Helper function to process execute code (inline only)
export async function processExecuteCode(
  execute: string,
  filePath: string,
  client: MCPClientStub<ProjectTools>,
  branch?: string,
): Promise<{ functionCode: string }> {
  // Save inline code to a file
  const functionCode = execute;

  await client.PUT_FILE({
    branch,
    path: filePath,
    content: functionCode,
  });

  return {
    functionCode,
  };
}

// Helper function to validate execute code
export async function validateExecuteCode(
  functionCode: string,
  runtimeId: string,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    using evaluation = await evalCodeAndReturnDefaultHandle(
      functionCode,
      runtimeId,
    );
    const { ctx, defaultHandle } = evaluation;

    if (ctx.typeof(defaultHandle) !== "function") {
      return {
        success: false,
        error: `${name} must export a default function`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Validation error for ${name}: ${inspect(error)}`,
    };
  }
}

