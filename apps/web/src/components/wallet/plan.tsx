import { type PlanWithTeamMetadata, usePlan } from "@deco/sdk";

export function Protect(
  { check, fallback, children }: {
    check: (plan: PlanWithTeamMetadata) => boolean;
    fallback?: React.ReactNode;
    children: React.ReactNode;
  },
) {
  const plan = usePlan();
  const canShow = check(plan);

  if (!canShow) {
    return fallback;
  }

  return children;
}
