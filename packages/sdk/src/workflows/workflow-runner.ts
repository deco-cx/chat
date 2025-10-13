import {
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStepConfig,
} from "cloudflare:workers";
import { callFunction, inspect } from "@deco/cf-sandbox";
import { contextStorage } from "../fetch.ts";
import {
  AppContext,
  type Bindings,
  type BindingsContext,
  PrincipalExecutionContext,
  State,
  toBindingsContext,
} from "../mcp/context.ts";
import {
  assertHasWorkspace,
  createResourceAccess,
  MCPClient,
} from "../mcp/index.ts";
import {
  asEnv,
  evalCodeAndReturnDefaultHandle,
} from "../mcp/tools/utils.ts";
import type { WorkflowStepDefinition } from "../mcp/workflows/api.ts";

export type { WorkflowStepConfig };

export type Runnable = (
  input: unknown,
) => Promise<Rpc.Serializable<unknown>>;

export interface WorkflowStep {
  name: string;
  config?: WorkflowStepConfig;
  fn: Runnable;
}

export interface WorkflowRunnerProps<T = unknown> {
  input: T;
  name: string;
  steps: WorkflowStepDefinition[];
  stopAfter?: string;
  state?: Record<string, unknown>;
  context: Pick<PrincipalExecutionContext, "workspace" | "locator">;
}

/**
 * Check if a value is an @ref
 */
function isAtRef(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("@");
}

/**
 * Parse an @ref into its components
 */
function parseAtRef(ref: string): {
  type: "step" | "input";
  id?: string;
  path?: string;
} {
  const refStr = ref.substring(1); // Remove @ prefix

  // Input reference: @input.path.to.value
  if (refStr.startsWith("input")) {
    const path = refStr.substring(6); // Remove 'input.'
    return { type: "input", path };
  }

  // Step reference: @stepId.output.path.to.value
  const [id, ...pathParts] = refStr.split(".");
  let path = pathParts.join(".");
  
  // If path starts with 'output.', remove it
  if (path.startsWith("output.")) {
    path = path.substring(7); // Remove 'output.'
  }

  return { type: "step", id, path };
}

/**
 * Get value from object using dot notation path
 */
function getValue(
  obj: Record<string, unknown> | unknown[] | unknown,
  path: string,
): unknown {
  if (!path) return obj;

  const keys = path.split(".");
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === "object" && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else if (Array.isArray(current)) {
      const index = parseInt(key, 10);
      current = isNaN(index) ? undefined : current[index];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Resolve @ references in input object
 */
function resolveReferences(
  input: Record<string, unknown>,
  workflowInput: unknown,
  stepResults: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  function resolveValue(value: unknown): unknown {
    // If it's an @ref, resolve it
    if (isAtRef(value)) {
      const parsed = parseAtRef(value);

      if (parsed.type === "input") {
        return getValue(workflowInput as Record<string, unknown>, parsed.path || "");
      } else if (parsed.type === "step") {
        const stepResult = stepResults[parsed.id || ""];
        if (stepResult === undefined) {
          throw new Error(`Step '${parsed.id}' has not been executed yet`);
        }
        return getValue(stepResult, parsed.path || "");
      }
    }

    // If it's an array, resolve each element
    if (Array.isArray(value)) {
      return value.map(resolveValue);
    }

    // If it's an object, resolve each property
    if (value !== null && typeof value === "object") {
      const resolvedObj: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(value)) {
        resolvedObj[key] = resolveValue(val);
      }
      return resolvedObj;
    }

    // Primitive value, return as-is
    return value;
  }

  for (const [key, value] of Object.entries(input)) {
    resolved[key] = resolveValue(value);
  }

  return resolved;
}

export class WorkflowRunner extends WorkflowEntrypoint<Bindings> {
  protected bindingsCtx: BindingsContext;
  protected executionCtx: ExecutionContext;

  constructor(ctx: ExecutionContext, env: Bindings) {
    super(ctx, env);
    this.bindingsCtx = toBindingsContext(env);
    this.executionCtx = ctx;
  }

  async principalContextFromRunnerProps(
    props: WorkflowRunnerProps,
  ): Promise<PrincipalExecutionContext> {
    assertHasWorkspace(props.context);
    const resourceAccess = createResourceAccess();
    resourceAccess.grant(); // all calls are authorized by default
    const issuer = await this.bindingsCtx.jwtIssuer();
    const token = await issuer.issue({
      sub: `workflow:${props.name}:${props.context.workspace.value}`,
    });
    return {
      params: {},
      resourceAccess,
      workspace: props.context.workspace,
      locator: props.context.locator,
      token,
      user: issuer.decode(token),
    };
  }

  /**
   * Execute a step with resolved input
   */
  private async executeStep(
    stepDef: WorkflowStepDefinition,
    resolvedInput: Record<string, unknown>,
    appContext: AppContext,
    runtimeId: string,
  ): Promise<Rpc.Serializable<unknown>> {
    const client = MCPClient.forContext(appContext);

    // Load and execute the code step function
    using stepEvaluation = await evalCodeAndReturnDefaultHandle(
      stepDef.execute,
      runtimeId,
    );
    const {
      ctx: stepCtx,
      defaultHandle: stepDefaultHandle,
      guestConsole: stepConsole,
    } = stepEvaluation;

    // Create step context with env for integration tool calls
    const stepContext = {
      env: await asEnv(client),
    };

    // Call the function with resolved input and context
    const stepCallHandle = await callFunction(
      stepCtx,
      stepDefaultHandle,
      undefined,
      resolvedInput,
      stepContext,
    );

    const result = stepCtx.dump(stepCtx.unwrapResult(stepCallHandle));

    // Log any console output from the step execution
    if (stepConsole.logs.length > 0) {
      console.log(`Step '${stepDef.name}' logs:`, stepConsole.logs);
    }

    return result as Rpc.Serializable<unknown>;
  }

  override async run(
    event: Readonly<WorkflowEvent<WorkflowRunnerProps>>,
    cfStep: CloudflareWorkflowStep,
  ) {
    const appContext: AppContext = {
      ...(await this.principalContextFromRunnerProps(event.payload)),
      ...this.bindingsCtx,
    };
    const { input: workflowInput, steps: stepDefinitions, state } = event.payload;
    const runtimeId = appContext.locator?.value ?? "default";

    // Track step results for reference resolution
    const stepResults: Record<string, unknown> = state ?? {};

    // Execute each step sequentially
    for (const stepDef of stepDefinitions) {
      // Check if step was already executed (from state)
      if (stepResults[stepDef.name] !== undefined) {
        console.log(`Skipping already executed step: ${stepDef.name}`);
        continue;
      }

      try {
        // Resolve @ references in the step's input
        const resolvedInput = resolveReferences(
          stepDef.input,
          workflowInput,
          stepResults,
        );

        console.log(`Executing step: ${stepDef.name}`, {
          input: stepDef.input,
          resolvedInput,
        });

        // Execute the step
        const result = await cfStep.do(
          stepDef.name,
          stepDef.options ?? {},
          () =>
            contextStorage.run({ env: this.env, ctx: this.executionCtx }, () =>
              State.run(appContext, () =>
                this.executeStep(stepDef, resolvedInput, appContext, runtimeId),
              ),
            ),
        );

        // Store the result for future reference
        stepResults[stepDef.name] = result;

        console.log(`Step completed: ${stepDef.name}`, { result });

        // Stop if we've reached the stopAfter step
        if (event.payload.stopAfter === stepDef.name) {
          console.log(`Stopping workflow after step: ${stepDef.name}`);
          break;
        }
      } catch (error) {
        console.error(`Step failed: ${stepDef.name}`, { error: inspect(error) });
        throw error;
      }
    }

    // Return the last executed step's result
    const lastStepName = stepDefinitions[stepDefinitions.length - 1]?.name;
    return stepResults[lastStepName] as Rpc.Serializable<unknown>;
  }
}
