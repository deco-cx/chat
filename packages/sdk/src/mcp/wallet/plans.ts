import { InternalServerError } from "../../errors.ts";
import { type PlanWithTeamMetadata, WELL_KNOWN_PLANS } from "../../plan.ts";
import { assertHasWorkspace } from "../assertions.ts";
import type { AppContext } from "../context.ts";
import {
  enrichPlanWithTeamMetadata,
  getTeamBySlug,
} from "../members/invites-utils.ts";

export const getPlanFromDb = async (c: AppContext, planId: string) => {
  const { data, error } = await c.db
    .from("deco_chat_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  if (error || !data) {
    throw new InternalServerError("Failed to fetch plan");
  }
  return data;
};

export const getPersonalWorkspacePlan = async (
  c: AppContext,
): Promise<PlanWithTeamMetadata> => {
  const data = await getPlanFromDb(c, WELL_KNOWN_PLANS.FREE);
  return {
    ...data,
    isAtSeatLimit: true,
    remainingSeats: 0,
  };
};

export const getTeamPlan = async (
  c: AppContext,
): Promise<PlanWithTeamMetadata> => {
  assertHasWorkspace(c);
  const slug = c.workspace.slug;
  const team = await getTeamBySlug(slug, c.db);
  const plan = await getPlanFromDb(c, team.plan_id);
  return enrichPlanWithTeamMetadata({
    plan,
    team,
  });
};

export const getPlan = async (c: AppContext): Promise<PlanWithTeamMetadata> => {
  assertHasWorkspace(c);
  return c.workspace.root === "users"
    ? await getPersonalWorkspacePlan(c)
    : await getTeamPlan(c);
};
