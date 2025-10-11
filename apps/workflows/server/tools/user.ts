/**
 * User-related tools for authentication and user management.
 *
 * This file contains all tools related to user operations including:
 * - Getting current user information
 * - User authentication checks
 */
import { createPrivateTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";

/**
 * `createPrivateTool` is a wrapper around `createTool` that
 * will call `env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated`
 * before executing the tool.
 *
 * It automatically returns a 401 error if valid user credentials
 * are not present in the request. You can also call it manually
 * to get the user object.
 */
export const createGetUserTool = (env: Env) =>
  createPrivateTool({
    id: "GET_USER",
    description: "Get the current logged in user",
    inputSchema: z.object({}),
    outputSchema: z.object({
      id: z.string(),
      name: z.string().nullable(),
      avatar: z.string().nullable(),
      email: z.string(),
    }),
    execute: () => {
      const user = env.DECO_CHAT_REQUEST_CONTEXT.ensureAuthenticated();

      if (!user) {
        throw new Error("User not found");
      }

      return {
        id: user.id,
        name: user.user_metadata.full_name,
        avatar: user.user_metadata.avatar_url,
        email: user.email,
      };
    },
  });

// Export all user-related tools
export const userTools = [createGetUserTool];
