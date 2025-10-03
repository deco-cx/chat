// deno-lint-ignore-file require-await
import { withRuntime } from "@deco/workers-runtime";
import {
  createStepFromTool,
  createTool,
  createWorkflow,
} from "@deco/workers-runtime/mastra";
import { z } from "zod/v3";
import type { Env as DecoEnv } from "./deco.gen.ts";

interface Env extends DecoEnv {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const createMyTool = (_env: Env) =>
  createTool({
    id: "MY_TOOL",
    description: "Say hello",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
    execute: async ({ context }) => ({
      message: `Hello, ${context.name}!`,
    }),
  });

const createMyWorkflow = (env: Env) => {
  const step = createStepFromTool(createMyTool(env));

  return createWorkflow({
    id: "MY_WORKFLOW",
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ message: z.string() }),
  })
    .then(step)
    .commit();
};

const fallbackToView =
  (viewPath: string = "/") =>
  (req: Request, env: Env) => {
    const LOCAL_URL = "http://localhost:4000";
    const url = new URL(req.url);
    const useDevServer = (
      req.headers.get("origin") || req.headers.get("host")
    )?.includes("localhost");

    const request = new Request(
      useDevServer
        ? new URL(`${url.pathname}${url.search}`, LOCAL_URL)
        : new URL(viewPath, req.url),
      req,
    );

    return useDevServer ? fetch(request) : env.ASSETS.fetch(request);
  };

const { Workflow, ...runtime } = withRuntime<Env>({
  workflows: [createMyWorkflow],
  tools: [createMyTool],
  fetch: fallbackToView("/"),
});

export { Workflow };

export default runtime;
