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
import { MCPConnection } from "../../models/mcp.ts";
import { WorkflowState } from "../../workflows/workflow-runner.ts";
import {
  CodeStepDefinition,
  ToolCallStepDefinition,
} from "../workflows/api.ts";

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

// Symbol to mark lazy env proxies
export const LAZY_ENV_PROXY = Symbol.for("LAZY_ENV_PROXY");

// Transform current workspace as callable integration environment
export const asEnv = (
  client: MCPClientStub<ProjectTools>,
  {
    authorization,
    workspace,
  }: { authorization?: string; workspace?: string } = {},
) => {
  const cache = new Map<string, MCPConnection>();
  // Create a function that can be called to access integrations and tools
  // This function will be properly serialized to QuickJS
  const envAccessor = (integrationId: string, toolName: string) => {
    return async (args: unknown) => {
      let connection;
      if (authorization && workspace) {
        connection = proxyConnectionForId(integrationId, {
          workspace: workspace,
          token: authorization,
        });
      } else {
        connection = cache.get(integrationId);
        if (!connection) {
          const mConnection = await client.INTEGRATIONS_GET({
            id: integrationId,
          });
          cache.set(integrationId, mConnection.connection);
        }
        connection = cache.get(integrationId);
      }

      const response = await client.INTEGRATIONS_CALL_TOOL({
        connection,
        params: {
          name: toolName,
          arguments: args as Record<string, unknown>,
        },
      });

      if (response.isError) {
        throw new Error(
          `Tool ${toolName} returned an error: ${inspect(response)}`,
        );
      }

      return response.structuredContent || response.content;
    };
  };

  // Create a target object that will hold the accessor function
  const target: Record<string | symbol, unknown> = {
    [LAZY_ENV_PROXY]: envAccessor,
  };

  // Create the nested proxy structure
  const envProxy = new Proxy(target, {
    get(targetObj, prop) {
      // Return the symbol property directly from the target
      if (prop === LAZY_ENV_PROXY) {
        return targetObj[LAZY_ENV_PROXY];
      }

      // For integration IDs, return a nested proxy for tool access
      return new Proxy(
        {},
        {
          get(_, toolName) {
            return envAccessor(prop as string, toolName as string);
          },
        },
      );
    },
  });

  return envProxy;
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
    step.execute ?? "",
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
    env: asEnv(client),
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
  // Find the integration by name or id
  const { items } = await client.INTEGRATIONS_LIST({});

  const integration = items.find(
    (item) => item.name === step.integration || item.id === step.integration,
  );

  if (!integration) {
    const availableIntegrations = items.map((item) => ({
      id: item.id,
      name: item.name,
    }));

    throw new Error(
      `Integration '${step.integration}' not found.\n\nAvailable integrations:\n${JSON.stringify(availableIntegrations, null, 2)}`,
    );
  }

  // Check if the tool exists in the integration
  const tools =
    "tools" in integration && Array.isArray(integration.tools)
      ? integration.tools
      : [];

  const tool = tools.find((t) => t.name === step.tool_name);

  if (!tool) {
    const availableTools = tools.map((t) => ({
      name: t.name,
      inputSchema: t.inputSchema,
      outputSchema: t.outputSchema,
    }));

    throw new Error(
      `Tool '${step.tool_name}' not found in integration '${integration.name}' (${integration.id}).\n\nAvailable tools:\n${JSON.stringify(availableTools, null, 2)}`,
    );
  }

  const response = await client.INTEGRATIONS_CALL_TOOL({
    connection: integration.connection,
    params: {
      name: step.tool_name ?? "",
      arguments: input as Record<string, unknown>,
    },
  });

  if (response.isError) {
    throw new Error(`Tool call failed: ${inspect(response)}`);
  }

  return (response.structuredContent ||
    response.content) as Rpc.Serializable<unknown>;
}
