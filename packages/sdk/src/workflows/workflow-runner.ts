import {
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowStepConfig,
} from "cloudflare:workers";
import {
  AppContext,
  type Bindings,
  type BindingsContext,
  PrincipalExecutionContext,
  toBindingsContext,
} from "../mcp/context.ts";
import {
  assertHasWorkspace,
  createResourceAccess,
  MCPClient,
} from "../mcp/index.ts";
import { runCode, runTool } from "../mcp/tools/utils.ts";
import type {
  CodeStepDefinition,
  ToolCallStepDefinition,
  WorkflowStepDefinition,
} from "../mcp/workflows/api.ts";

export type { WorkflowStepConfig };

export type Runnable = (
  input: unknown,
  state: WorkflowState,
) => Promise<Rpc.Serializable<unknown>>;
export interface WorkflowState<T = unknown> {
  input: T;
  steps: Record<string, unknown>;
  sleep: (name: string, duration: number) => Promise<void>;
  sleepUntil: (name: string, date: Date | number) => Promise<void>;
}

export interface WorkflowStep {
  name: string;
  config?: WorkflowStepConfig;
  fn: Runnable;
}

export interface WorkflowRunnerProps<T = unknown> {
  input: T;
  name: string;
  steps: WorkflowStepDefinition[]; // Changed from WorkflowStep[] to WorkflowStepDefinition[]
  stopAfter?: string;
  state?: Record<string, unknown>;
  context: Pick<PrincipalExecutionContext, "workspace" | "locator">;
}

export class WorkflowRunner extends WorkflowEntrypoint<Bindings> {
  protected bindingsCtx: BindingsContext;
  constructor(ctx: ExecutionContext, env: Bindings) {
    super(ctx, env);
    this.bindingsCtx = toBindingsContext(env);
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
   * Convert WorkflowStepDefinition to WorkflowStep with actual runnable functions
   */
  private convertStepDefinitionToStep(
    workflowInput: unknown,
    stepDef: WorkflowStepDefinition,
    appContext: AppContext,
    runtimeId: string,
  ): WorkflowStep {
    const client = MCPClient.forContext(appContext);

    let runnable: Runnable;
    if (stepDef.type === "code") {
      runnable = (_input, state) =>
        runCode(
          workflowInput,
          state,
          stepDef.def as CodeStepDefinition,
          client,
          runtimeId,
        );
    } else if (stepDef.type === "tool_call") {
      runnable = (input) =>
        runTool(input, stepDef.def as ToolCallStepDefinition, client);
    } else {
      throw new Error(
        `Invalid step type: ${(stepDef as unknown as { type: string }).type}`,
      );
    }
    const config =
      stepDef.type === "tool_call" && "options" in stepDef.def
        ? (stepDef.def.options ?? {})
        : {};

    return {
      name: stepDef.def.name,
      config,
      fn: runnable,
    };
  }

  override async run(
    event: Readonly<WorkflowEvent<WorkflowRunnerProps>>,
    cfStep: CloudflareWorkflowStep,
  ) {
    const appContext: AppContext = {
      ...(await this.principalContextFromRunnerProps(event.payload)),
      ...this.bindingsCtx,
    };
    const { input, steps: stepDefinitions, state } = event.payload;
    const runtimeId = appContext.locator?.value ?? "default";

    // Convert step definitions to actual runnable steps
    const steps = stepDefinitions.map((stepDef) =>
      this.convertStepDefinitionToStep(input, stepDef, appContext, runtimeId),
    );

    const workflowState = {
      input,
      steps: state ?? {},
    };
    let prev = input;
    for (const step of steps) {
      prev =
        state?.[step.name] ??
        (await cfStep.do(step.name, step.config ?? {}, async () => {
          const runResult = await step.fn(prev, {
            ...workflowState,
            sleepUntil: (name, date) =>
              cfStep.sleepUntil(`${step.name}-${name}`, date),
            sleep: (name, duration) =>
              cfStep.sleep(`${step.name}-${name}`, duration),
          });
          return runResult as Rpc.Serializable<unknown>;
        }));
      workflowState.steps[step.name] = prev;
      if (event.payload.stopAfter === step.name) {
        break;
      }
    }
    return prev;
  }
}
