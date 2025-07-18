import type {
  PostgrestFilterBuilder,
  UnstableGetResult as GetResult,
} from "@supabase/postgrest-js";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./schema.ts";

export type Options = Parameters<typeof createServerClient>;
export type Client = ReturnType<typeof createServerClient<Database, "public">>;

/**
 * Uses the tokens present on the request to create a client.
 * This means it will only have access to the tables the user has access to.
 *
 * DO NOT use this, since this is very slow. Please use the server client below.
 */
export const createSupabaseClient = (
  supabaseUrl: Options[0],
  supabaseKey: Options[1],
  opts: Options[2],
): Client =>
  createServerClient<Database, "public">(supabaseUrl, supabaseKey, opts);

/**
 * This client uses the server token to access the database,
 * so before accessing anything, make sure the user has the correct permissions.
 */
export let client:
  | ReturnType<typeof createServerClient<Database, "public">>
  | undefined;

export const getServerClient = (
  supabaseUrl: Options[0],
  supabaseKey: Options[1],
): Client => {
  client ||= createServerClient<Database, "public">(supabaseUrl, supabaseKey, {
    cookies: { getAll: () => [] },
  });

  return client;
};

export type QueryResult<
  TableName extends keyof Database["public"]["Tables"],
  Query extends string,
> = NonNullable<
  Awaited<
    PostgrestFilterBuilder<
      Database["public"],
      Database["public"]["Tables"][TableName]["Row"],
      GetResult<
        Database["public"],
        Database["public"]["Tables"][TableName]["Row"],
        TableName,
        Database["public"]["Tables"][TableName]["Relationships"],
        Query
      >,
      TableName,
      Database["public"]["Tables"][TableName]["Relationships"]
    >
  >["data"]
>;
