import type { Database } from "./storage/supabase/schema.ts";

export type Plan = Database["public"]["Tables"]["deco_chat_plans"]["Row"];

export interface PlanWithTeamMetadata extends Plan {
  isAtSeatLimit: boolean;
  remainingSeats: number;
}

export const WELL_KNOWN_PLANS = {
  FREE: "00000000-0000-0000-0000-000000000001",
  STARTER: "00000000-0000-0000-0000-000000000002",
  GROWTH: "00000000-0000-0000-0000-000000000003",
  SCALE: "00000000-0000-0000-0000-000000000004",
};

export const WELL_KNOWN_PLAN_IDS = new Set(Object.values(WELL_KNOWN_PLANS));
