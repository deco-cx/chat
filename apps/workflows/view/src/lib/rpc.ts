/**
 * RPC Client - Connect to Deco MCP Server
 * Uses the runtime client to call server tools
 */

import { createClient } from "@deco/workers-runtime/client";
import type { Env } from "../../../shared/deco.gen.ts";

/**
 * Client for calling server-side tools
 * Auto-generated types from deco.gen.ts
 */
export const client = createClient<Env["SELF"]>();
