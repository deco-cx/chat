import { NotFoundError, useAgent } from "@deco/sdk";
import { Suspense } from "react";
import { AgentVisibility } from "../common/AgentVisibility.tsx";
import { AgentAvatar } from "../common/Avatar.tsx";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";

interface Props {
  agentId: string;
  variant?: "default" | "summary";
}

export function AgentBreadcrumbSegment(
  { agentId, variant = "default" }: Props,
) {
  return (
    <ErrorBoundary
      fallback={null}
      shouldCatch={(e) => e instanceof NotFoundError}
    >
      <Suspense
        fallback={<AgentBreadcrumbSegment.Loading />}
      >
        <AgentBreadcrumbSegment.UI agentId={agentId} variant={variant} />
      </Suspense>
    </ErrorBoundary>
  );
}

AgentBreadcrumbSegment.Loading = () => {
  return null;
};

AgentBreadcrumbSegment.UI = (
  { agentId, variant = "default" }: {
    agentId: string;
    variant: "default" | "summary";
  },
) => {
  const { data: agent } = useAgent(agentId);

  return (
    <div className="flex items-center gap-2">
      {variant !== "summary" && (
        <AgentAvatar
          name={agent.name}
          avatar={agent.avatar}
          className="w-6 h-6"
        />
      )}
      <h1 className="text-sm font-medium tracking-tight text-slate-700 text-nowrap">
        {agent.name}
      </h1>
      <AgentVisibility agent={agent} />
    </div>
  );
};
