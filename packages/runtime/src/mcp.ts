// deno-lint-ignore-file no-explicit-any
import { env } from "cloudflare:workers";
import { z } from "zod/v3";
import type { MCPConnection } from "./connection.ts";
import type { DefaultEnv } from "./index.ts";
import { createMCPClientProxy } from "./proxy.ts";

export interface FetchOptions extends RequestInit {
  path?: string;
  segments?: string[];
}

const Timings = z.object({
  sql_duration_ms: z.number().optional(),
});

const Meta = z.object({
  changed_db: z.boolean().optional(),
  changes: z.number().optional(),
  duration: z.number().optional(),
  last_row_id: z.number().optional(),
  rows_read: z.number().optional(),
  rows_written: z.number().optional(),
  served_by_primary: z.boolean().optional(),
  served_by_region: z
    .enum(["WNAM", "ENAM", "WEUR", "EEUR", "APAC", "OC"])
    .optional(),
  size_after: z.number().optional(),
  timings: Timings.optional(),
});

const QueryResult = z.object({
  meta: Meta.optional(),
  results: z.array(z.unknown()).optional(),
  success: z.boolean().optional(),
});

export type QueryResult = z.infer<typeof QueryResult>;

const workspaceTools = [
  {
    name: "INTEGRATIONS_GET" as const,
    inputSchema: z.object({
      id: z.string(),
    }),
    outputSchema: z.object({
      connection: z.object({}),
    }),
  },
  {
    name: "DATABASES_RUN_SQL" as const,
    inputSchema: z.object({
      sql: z.string().describe("The SQL query to run"),
      params: z
        .array(z.string())
        .describe("The parameters to pass to the SQL query"),
    }),
    outputSchema: z.object({
      result: z.array(QueryResult),
    }),
  },
] satisfies ToolBinder<string, unknown, object>[];

// Default fetcher instance with API_SERVER_URL and API_HEADERS
const global = createMCPFetchStub<[]>({});
export const MCPClient = new Proxy(
  {} as typeof global & {
    forWorkspace: (
      workspace: string,
      token?: string,
    ) => MCPClientFetchStub<typeof workspaceTools>;
    forConnection: <TDefinition extends readonly ToolBinder[]>(
      connection: MCPConnectionProvider,
    ) => MCPClientFetchStub<TDefinition>;
  },
  {
    get(_, name) {
      if (name === "toJSON") {
        return null;
      }

      if (name === "forWorkspace") {
        return (workspace: string, token?: string) =>
          createMCPFetchStub<[]>({
            workspace,
            token,
            decoCmsApiUrl: (env as DefaultEnv).DECO_API_URL,
          });
      }
      if (name === "forConnection") {
        return <TDefinition extends readonly ToolBinder[]>(
          connection: MCPConnectionProvider,
        ) =>
          createMCPFetchStub<TDefinition>({
            connection,
            decoCmsApiUrl: (env as DefaultEnv).DECO_API_URL,
          });
      }
      return global[name as keyof typeof global];
    },
  },
);

export interface ToolBinder<
  TName extends string = string,
  TInput = any,
  TReturn extends object | null | boolean = object,
> {
  name: TName;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TReturn>;
  opt?: true;
}
export type MCPClientStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends ToolBinder<
    string,
    infer TInput,
    infer TReturn
  >
    ? (params: TInput, init?: RequestInit) => Promise<TReturn>
    : never;
};

export type MCPClientFetchStub<TDefinition extends readonly ToolBinder[]> = {
  [K in TDefinition[number] as K["name"]]: K extends ToolBinder<
    string,
    infer TInput,
    infer TReturn
  >
    ? (params: TInput, init?: RequestInit) => Promise<TReturn>
    : never;
};

export type MCPConnectionProvider = MCPConnection;

export interface MCPClientRaw {
  callTool: (tool: string, args: unknown) => Promise<unknown>;
  listTools: () => Promise<
    {
      name: string;
      inputSchema: any;
      outputSchema?: any;
      description: string;
    }[]
  >;
}
export type JSONSchemaToZodConverter = (jsonSchema: any) => z.ZodTypeAny;
export interface CreateStubAPIOptions {
  mcpPath?: string;
  decoCmsApiUrl?: string;
  workspace?: string;
  token?: string;
  connection?: MCPConnectionProvider;
  debugId?: () => string;
  getErrorByStatusCode?: (
    statusCode: number,
    message?: string,
    traceId?: string,
  ) => Error;
}

export function createMCPFetchStub<TDefinition extends readonly ToolBinder[]>(
  options?: CreateStubAPIOptions,
): MCPClientFetchStub<TDefinition> {
  return createMCPClientProxy<MCPClientFetchStub<TDefinition>>({
    ...(options ?? {}),
  });
}
