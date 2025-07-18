import { type PlanWithTeamMetadata, usePlan } from "@deco/sdk";

export function Protect({
  check,
  fallback,
  children,
}: {
  check: (plan: PlanWithTeamMetadata) => boolean;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const plan = usePlan();
  const canShow = check(plan);

  if (!canShow) {
    return fallback;
  }

  return children;
}

export function PlanBadge() {
  const plan = usePlan();
  const seatCount = plan.user_seats - plan.remainingSeats;
  const seatLimit = plan.user_seats;

  return (
    <div className="w-full bg-accent rounded-lg p-2 flex items-start flex-col gap-2">
      <p className="text-sm font-medium">Plan: {plan.title}</p>
      <p className="text-xs text-muted-foreground">
        {seatCount}/{seatLimit} used seats
      </p>
    </div>
  );
}
