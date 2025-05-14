import { SpanStatusCode, trace } from "@deco/sdk/observability";
import {
  createTool as mastraCreateTool,
  type ToolExecutionContext,
} from "@mastra/core";
import type { ToolExecutionOptions } from "ai";
import { z } from "zod";
import type { AIAgent } from "../agent.ts";

export interface ToolOptions<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
> {
  id: string;
  description?: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: (agent: AIAgent) => (
    context: ToolExecutionContext<TSchemaIn>,
    options?: ToolExecutionOptions,
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
>(opts: ToolOptions<TSchemaIn, TSchemaOut>) => opts;

export const createTool = ({
  execute,
  outputSchema,
  ...args
}: Parameters<typeof mastraCreateTool>[0]) =>
  mastraCreateTool({
    ...args,
    outputSchema: z.union([
      z.object({
        success: z.literal(true),
        message: z.string()
          .describe("A message describing the result of the operation")
          .nullable()
          .optional(),
        data: outputSchema || z.any(),
      }),
      z.object({
        success: z.literal(false),
        message: z.string()
          .describe("A message describing the result of the operation"),
        data: z.null().optional(),
      }),
    ]),
    execute: (ctx, options) => {
      const tracer = trace.getTracer("tool-tracer");
      return tracer.startActiveSpan(
        `TOOL@${args.id}`,
        async (span) => {
          let err: unknown | null = null;
          span.setAttribute("tool.id", args.id);
          ctx.threadId && span.setAttribute("tool.thread", ctx.threadId);
          ctx.resourceId && span.setAttribute("tool.resource", ctx.resourceId);
          try {
            const data = await execute?.(ctx, options);

            return {
              success: true,
              message: "Success",
              data,
            };
          } catch (error) {
            err = error;
            return {
              success: false,
              message: `Failed to execute tool with the following error: ${
                String(error)
              }`,
              data: null,
            };
          } finally {
            if (err) {
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: typeof err === "object" && "message" in err
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
        },
      );
    },
  });
