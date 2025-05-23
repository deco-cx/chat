import type { Agent } from "@deco/sdk";
import { useAgents } from "@deco/sdk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@deco/ui/components/dialog.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useState } from "react";
import { AgentAvatar } from "../common/Avatar.tsx";
import { EmptyState } from "../common/EmptyState.tsx";
import { CronTriggerForm } from "./cronTriggerForm.tsx";
import { WebhookTriggerForm } from "./webhookTriggerForm.tsx";
import { TriggerOutputSchema } from "@deco/sdk";
import { z } from "zod";

function AgentSelect({
  agents,
  value,
  onChange,
  disabled,
}: {
  agents: Agent[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const selectedAgent = agents.find((a) => a.id === value) || agents[0];
  return (
    <Select
      value={value}
      onValueChange={onChange}
      disabled={disabled || agents.length === 0}
    >
      <SelectTrigger className="w-full h-12 rounded-full border border-slate-200 bg-slate-50 text-left px-4">
        <SelectValue>
          {selectedAgent
            ? (
              <div className="flex items-center gap-2">
                <span className="w-6 h-6">
                  <AgentAvatar
                    name={selectedAgent.name}
                    avatar={selectedAgent.avatar}
                  />
                </span>
                <span className="truncate max-w-[120px] text-sm">
                  {selectedAgent.name}
                </span>
              </div>
            )
            : "Select agent"}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-60 overflow-y-auto rounded-xl">
        {agents.map((agent) => (
          <SelectItem
            key={agent.id}
            value={agent.id}
            className="flex items-center gap-2 px-3 py-2"
          >
            <span className="w-6 h-6">
              <AgentAvatar name={agent.name} avatar={agent.avatar} />
            </span>
            <span className="truncate max-w-[120px] text-sm">{agent.name}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TriggerModal(
  { triggerAction, trigger, isOpen, onOpenChange, agentId }: {
    triggerAction?: React.ReactNode;
    agentId?: string;
    trigger?: z.infer<typeof TriggerOutputSchema>;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  },
) {
  const { data: agents = [] } = useAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(
    trigger?.agent?.id || agentId || agents[0]?.id || "",
  );
  const [triggerType, setTriggerType] = useState<"webhook" | "cron">(
    trigger?.data.type === "cron" ? "cron" : "webhook",
  );

  const hasAgents = agents.length > 0;
  const isEditing = !!trigger;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{triggerAction}</DialogTrigger>
      <DialogContent onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit trigger" : "Create trigger"}
          </DialogTitle>
        </DialogHeader>
        {!hasAgents
          ? (
            <EmptyState
              icon="robot_2"
              title="No agents yet"
              description="You need to create an agent before adding a trigger."
              buttonProps={{
                onClick: () => {
                  onOpenChange?.(false);
                  globalThis.location.href = "/agents";
                },
                variant: "special",
                className: "mt-2",
                children: (
                  <>
                    <Icon name="add" />
                    Create agent
                  </>
                ),
              }}
            />
          )
          : (
            <>
              <div className="mb-4">
                <AgentSelect
                  agents={agents}
                  value={selectedAgentId}
                  onChange={setSelectedAgentId}
                  disabled={isEditing}
                />
              </div>
              <Tabs
                value={triggerType}
                onValueChange={(v) => setTriggerType(v as "webhook" | "cron")}
              >
                <TabsList className="mb-2 w-full bg-slate-100 rounded-full">
                  <TabsTrigger
                    value="webhook"
                    className="flex-1 cursor-pointer rounded-full"
                    disabled={isEditing}
                  >
                    Webhook
                  </TabsTrigger>
                  <TabsTrigger
                    value="cron"
                    className="flex-1 cursor-pointer rounded-full"
                    disabled={isEditing}
                  >
                    Cron
                  </TabsTrigger>
                </TabsList>
                <TabsContent
                  value="webhook"
                  className="max-h-[70vh] overflow-y-auto pr-2"
                >
                  <WebhookTriggerForm
                    agentId={selectedAgentId}
                    onSuccess={() => onOpenChange?.(false)}
                    initialValues={trigger?.type === "webhook"
                      ? trigger
                      : undefined}
                  />
                </TabsContent>
                <TabsContent
                  value="cron"
                  className="max-h-[70vh] overflow-y-auto pr-2"
                >
                  <CronTriggerForm
                    agentId={selectedAgentId}
                    onSuccess={() => onOpenChange?.(false)}
                    initialValues={trigger?.type === "cron"
                      ? trigger
                      : undefined}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
      </DialogContent>
    </Dialog>
  );
}
