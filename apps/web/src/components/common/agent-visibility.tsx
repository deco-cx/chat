import type { Agent } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import type { ComponentProps } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";

const DESCRIPTIONS = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  WORKSPACE: "Team",
};

export function AgentVisibility({ agent }: { agent: Agent }) {
  return (
    <div className="flex gap-1 items-center text-xs text-muted-foreground px-2 py-1 bg-muted rounded-xl">
      <AgentVisibility.Icon agent={agent} size={12} />
      {DESCRIPTIONS[agent.visibility]}
    </div>
  );
}

AgentVisibility.Icon = ({
  agent,
  ...props
}: { agent: Agent } & Omit<ComponentProps<typeof Icon>, "name">) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Icon
        {...props}
        name={
          agent.visibility === "PUBLIC"
            ? "public"
            : agent.visibility === "PRIVATE"
              ? "lock"
              : "groups"
        }
      />
    </TooltipTrigger>
    <TooltipContent>{DESCRIPTIONS[agent.visibility]}</TooltipContent>
  </Tooltip>
);
