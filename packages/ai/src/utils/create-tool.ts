import { SpanStatusCode, trace } from "@deco/sdk/observability";
import {
  createTool as mastraCreateTool,
  type ToolExecutionContext,
} from "@mastra/core";
import type { ToolCallOptions } from "ai";
import type { z } from "zod/v3";
import type { AIAgent, Env } from "../agent.ts";

export interface ToolOptions<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> {
  id: string;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: (
    agent: AIAgent,
    env?: Env,
  ) => (
    context: ToolExecutionContext<TSchemaIn>,
    options?: ToolCallOptions,
  ) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
}
export const createInnateTool: <
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(
  opts: ToolOptions<TSchemaIn, TSchemaOut>,
) => ToolOptions<TSchemaIn, TSchemaOut> = <
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(
  opts: ToolOptions<TSchemaIn, TSchemaOut>,
) => opts;

export const createTool = ({
  execute,
  outputSchema,
  ...args
}: Parameters<typeof mastraCreateTool>[0]) =>
  mastraCreateTool({
    ...args,
    outputSchema,
    execute: (ctx, options) => {
      const tracer = trace.getTracer("tool-tracer");
      return tracer.startActiveSpan(`TOOL@${args.id}`, async (span) => {
        let err: unknown | null = null;
        span.setAttribute("tool.id", args.id);
        ctx.threadId && span.setAttribute("tool.thread", ctx.threadId);
        ctx.resourceId && span.setAttribute("tool.resource", ctx.resourceId);
        try {
          const result = await execute?.(ctx, options);

          if (
            Array.isArray(result?.content) &&
            result.content.length > 0 &&
            result.content[0]?.type === "text"
          ) {
            // deno-lint-ignore no-explicit-any
            return result.content.map((t: any) => t.text).join("\n\n");
          }

          return result;
        } catch (error) {
          err = error;
          return `Failed to execute tool with the following error: ${String(
            error,
          )}`;
        } finally {
          if (err) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message:
                typeof err === "object" && "message" in err
                  ? String(err.message)
                  : "Unknown error",
            });
          } else {
            span.setStatus({
              code: SpanStatusCode.OK,
            });
          }
          span.end();
        }
      });
    },
  });
