/**
 * This is where you define your views.
 *
 * Declaring views here will make them available on the user's
 * project when they install your MCP server.
 *
 * @see https://docs.deco.page/en/guides/building-views/
 */
import { StateSchema } from "../shared/deco.gen.ts";
import { Env } from "./main.ts";
import type { CreateMCPServerOptions } from "@deco/workers-runtime/mastra";

export const views: CreateMCPServerOptions<Env, typeof StateSchema>["views"] =
  () => [
    {
      title: "Workflows",
      icon: "account_tree", // Workflow/tree icon
      url: "https://workflows-default.deco.page/",
    },
  ];
