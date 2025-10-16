import {
  WorkflowStep as CloudflareWorkflowStep,
  WorkflowEntrypoint,
  WorkflowEvent,
  WorkflowStepConfig,
} from "cloudflare:workers";
import postgres from "postgres";
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
  context: Pick<PrincipalExecutionContext, "workspace" | "locator"> & {
    workflowURI: string;
    startedBy?: {
      id: string;
      email: string | undefined;
      name: string | undefined;
    };
    startedAt?: string;
  };
}

const DEFAULT_CONFIG: WorkflowStepConfig = {
  retries: {
    limit: 2,
    delay: 2000,
    backoff: "exponential",
  },
  timeout: "5 minutes",
};

export class WorkflowRunner extends WorkflowEntrypoint<Bindings> {
  protected bindingsCtx: BindingsContext;
  protected executionCtx: ExecutionContext;
  private sql: postgres.Sql;

  constructor(ctx: ExecutionContext, env: Bindings) {
    super(ctx, env);
    this.sql = postgres(env.DATABASE_URL, {
      max: 2,
    });
    this.bindingsCtx = toBindingsContext(env, this.sql);
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
      stepDef.type === "tool_call" && stepDef.def && "options" in stepDef.def
        ? (stepDef.def.options ?? {})
        : DEFAULT_CONFIG;

    return {
      name: stepDef.def?.name ?? "",
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
        (await cfStep.do(step.name, step.config ?? {}, () => {
          return contextStorage.run(
            { env: this.env, ctx: this.executionCtx, sql: this.sql },
            () =>
              State.run(
                appContext,
                () =>
                  step.fn(prev, {
                    ...workflowState,
                    sleepUntil: (name, date) =>
                      cfStep.sleepUntil(`${step.name}-${name}`, date),
                    sleep: (name, duration) =>
                      cfStep.sleep(`${step.name}-${name}`, duration),
                  }) as Promise<Rpc.Serializable<unknown>>,
              ),
          );
        }));

      workflowState.steps[step.name] = prev;
      if (event.payload.stopAfter === step.name) {
        break;
      }
    }
    return prev;
  }
}
