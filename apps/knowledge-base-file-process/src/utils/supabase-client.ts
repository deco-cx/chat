import { type Database, getServerClient } from "@deco/sdk/storage";

export type SupabaseClient = ReturnType<typeof getServerClient>;

/**
 * Creates an optimized Supabase client with proper database types.
 * Uses the singleton pattern from the SDK for performance optimization.
 */
// deno-lint-ignore no-explicit-any
export function createKnowledgeBaseSupabaseClient(env: any): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVER_TOKEN) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVER_TOKEN environment variables are required",
    );
  }

  return getServerClient(env.SUPABASE_URL, env.SUPABASE_SERVER_TOKEN);
}

/**
 * Type-safe helper for assets table operations
 */
export type AssetRow = Database["public"]["Tables"]["deco_chat_assets"]["Row"];
export type AssetInsert =
  Database["public"]["Tables"]["deco_chat_assets"]["Insert"];
export type AssetUpdate =
  Database["public"]["Tables"]["deco_chat_assets"]["Update"];
