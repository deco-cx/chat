import { NotFoundError, useAgent, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Suspense } from "react";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { useFocusChat } from "../agents/hooks.ts";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { useChatContext } from "./context.tsx";

export function EmptyState() {
  const { agentId } = useChatContext();

  if (agentId === WELL_KNOWN_AGENT_IDS.teamAgent) {
    return (
      <div className="py-10">
        <div className="flex flex-col items-center justify-center gap-2">
          <div className="text-2xl font-medium leading-loose text-foreground">
            What can I help with?
          </div>
          <div className="text-sm font-normal text-muted-foreground max-w-[510px] text-center">
            Use this chat to ask questions, generate content, execute tasks or
            <br />
            <span className="italic font-crimson-pro text-base">
              build personalized agents.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={<EmptyState.Fallback />}
      shouldCatch={(e) => e instanceof NotFoundError}
    >
      <Suspense fallback={<EmptyState.Skeleton />}>
        <EmptyState.UI />
      </Suspense>
    </ErrorBoundary>
  );
}

EmptyState.Fallback = () => {
  return null;
};

EmptyState.Skeleton = () => {
  return (
    <div className="h-full flex flex-col items-center justify-center animate-pulse gap-4 py-10">
      <div className="bg-muted w-2/3 rounded-xl h-10 ml-auto" />
      <div className="bg-muted w-2/3 rounded-xl h-10 mr-auto" />
      <div className="bg-muted w-2/3 rounded-xl h-10 ml-auto" />
    </div>
  );
};

EmptyState.UI = () => {
  const { agentId, uiOptions } = useChatContext();
  const { data: agent } = useAgent(agentId);
  const editAgent = useFocusChat();

  return (
    <div className="h-full flex flex-col justify-between py-12">
      <div className="flex flex-col items-center justify-center max-w-2xl mx-auto p-4 duration-300 transition-all">
        <div className="flex flex-col items-center gap-4 mb-6">
          <div className="w-12 h-12 flex items-center justify-center ">
            <AgentAvatar url={agent?.avatar} fallback={agent?.name} size="lg" />
          </div>
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <h2 className="text-3xl font-medium text-foreground">
                {agent?.name
                  ? agent.name
                  : "Tell me who I am and how I should be"}
              </h2>
            </div>
            <p className="text-muted-foreground mx-6 text-center">
              {agent?.description ?? "The more you share, the better I get."}
            </p>
            {uiOptions.showEditAgent && (
              <Button
                variant="outline"
                onClick={() => editAgent(agentId, crypto.randomUUID())}
              >
                <Icon name="tune" size={16} />
                Edit agent
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
