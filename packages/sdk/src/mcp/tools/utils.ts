import {
  callFunction,
  createSandboxRuntime,
  inspect,
  installConsole,
  QuickJSHandle,
} from "@deco/cf-sandbox";
import { Validator } from "jsonschema";
import { z } from "zod";
import { createToolGroup, MCPClientStub } from "../context.ts";
import { slugify } from "../deconfig/api.ts";
import { ProjectTools } from "../index.ts";
import { ToolDefinitionSchema } from "./schemas.ts";
import {
  CodeStepDefinition,
  ToolCallStepDefinition,
} from "../workflows/api.ts";
import { WorkflowState } from "../../workflows/workflow-runner.ts";

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
export const asEnv = async (client: MCPClientStub<ProjectTools>) => {
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
      tools.map((tool: z.infer<typeof ToolDefinitionSchema>) => [
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

/**
 * Run code in a workflow step context
 */
export async function runCode(
  workflowInput: unknown,
  state: WorkflowState,
  step: CodeStepDefinition,
  client: MCPClientStub<ProjectTools>,
  runtimeId: string = "default",
): Promise<Rpc.Serializable<unknown>> {
  // Load and execute the code step function
  using stepEvaluation = await evalCodeAndReturnDefaultHandle(
    step.execute,
    runtimeId,
  );
  const {
    ctx: stepCtx,
    defaultHandle: stepDefaultHandle,
    guestConsole: stepConsole,
  } = stepEvaluation;

  // Create step context with WellKnownOptions
  const stepContext = {
    sleep: async (name: string, duration: number) => {
      await state.sleep(name, duration);
    },
    sleepUntil: async (name: string, date: Date | number) => {
      await state.sleepUntil(name, date);
    },
    readWorkflowInput() {
      return workflowInput;
    },
    readStepResult(stepName: string) {
      if (!state.steps[stepName]) {
        throw new Error(`Step '${stepName}' has not been executed yet`);
      }
      return state.steps[stepName];
    },
    env: await asEnv(client),
  };

  // Call the function
  const stepCallHandle = await callFunction(
    stepCtx,
    stepDefaultHandle,
    undefined,
    stepContext,
    {},
  );

  const result = stepCtx.dump(stepCtx.unwrapResult(stepCallHandle));

  // Log any console output from the step execution
  if (stepConsole.logs.length > 0) {
    console.log(`Code step '${step.name}' logs:`, stepConsole.logs);
  }

  return result as Rpc.Serializable<unknown>;
}

/**
 * Run a tool call step in a workflow
 */
export async function runTool(
  input: unknown,
  step: ToolCallStepDefinition,
  client: MCPClientStub<ProjectTools>,
): Promise<Rpc.Serializable<unknown>> {
  // Find the integration by name
  const { items } = await client.INTEGRATIONS_LIST({});
  const integration = items.find(item => item.name === step.integration);
  
  if (!integration) {
    throw new Error(`Integration '${step.integration}' not found`);
  }

  const response = await client.INTEGRATIONS_CALL_TOOL({
    connection: integration.connection,
    params: {
      name: step.tool_name,
      arguments: input as Record<string, unknown>,
    },
  });

  if (response.isError) {
    throw new Error(`Tool call failed: ${inspect(response)}`);
  }

  return (response.structuredContent || response.content) as Rpc.Serializable<unknown>;
}
