import { TriggerSchema, useListTriggersByAgentId } from "@deco/sdk";
import { Badge } from "@deco/ui/components/badge.tsx";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { useParams } from "react-router";
import { AuditListContent } from "../audit/list.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout.tsx";
import { CronDetails } from "./cronDetails.tsx";
import { WebhookDetails } from "./webhookDetails.tsx";
import { TriggerToggle } from "./triggerToggle.tsx";
import { z } from "zod";
import { TriggerModal } from "./triggerModal.tsx";
import { useState } from "react";

const useTrigger = (agentId: string, triggerId: string) => {
  const { data, isLoading } = useListTriggersByAgentId(agentId);
  const trigger = data?.triggers?.find((t) => t.id === triggerId);

  return { trigger, isLoading };
};

export function TriggerDetails(
  { triggerId: _triggerId, onBack, agentId: _agentId }: {
    triggerId?: string;
    onBack?: () => void;
    agentId?: string;
  },
) {
  const params = useParams();
  const agentId = _agentId || params.agentId;
  const triggerId = _triggerId || params.triggerId;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  if (!agentId || !triggerId) {
    return <div>No agent or trigger ID</div>;
  }

  const { trigger, isLoading } = useTrigger(agentId, triggerId);

  if (!trigger || isLoading) {
    return <TriggerDetailsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 max-w-full py-8 h-full">
      {onBack && (
        <Button
          variant="ghost"
          className="flex items-center gap-1 text-sm justify-start w-min px-4"
          onClick={onBack}
        >
          <Icon name="arrow_back" className="h-4 w-4" />
          Back to triggers
        </Button>
      )}

      <ScrollArea className="min-h-0">
        <div className="flex flex-col gap-4 px-4">
          <div className="flex items-center gap-2">
            <TriggerIcon type={trigger.data.type} />
            <h2 className="text-xl font-semibold">{trigger.data.title}</h2>
            <Badge variant="outline" className="ml-2">
              {trigger.data.type}
            </Badge>
            <div className="ml-auto flex items-center gap-2">
              <TriggerModal
                trigger={trigger}
                isOpen={isEditModalOpen}
                onOpenChange={setIsEditModalOpen}
                triggerAction={
                  <Button variant="special">
                    <Icon name="edit" className="h-4 w-4 mr-2" />
                    Edit Trigger
                  </Button>
                }
              />
              <TriggerToggle trigger={trigger} />
            </div>
          </div>

          {trigger.data.description && (
            <div className="px-2">
              <h4 className="text-sm font-medium mb-1">Description</h4>
              <p className="text-sm text-muted-foreground">
                {trigger.data.description}
              </p>
            </div>
          )}

          {trigger.data.type === "webhook" && (
            <WebhookDetails trigger={trigger} />
          )}
          {trigger.data.type === "cron" && <CronDetails trigger={trigger} />}

          <div className="mt-10">
            <h3 className="text-lg font-semibold mb-2">Logs</h3>
            <AuditListContent
              showFilters={false}
              options={{ resourceId: trigger.id, agentId }}
            />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export default function Page() {
  const params = useParams();
  const agentId = params.agentId;
  const triggerId = params.triggerId;

  if (!agentId || !triggerId) {
    return null;
  }

  const { trigger } = useTrigger(agentId, triggerId);

  return (
    <PageLayout
      displayViewsTrigger={false}
      breadcrumb={
        <DefaultBreadcrumb
          items={[
            { label: "Triggers", link: "/triggers" },
            ...(trigger?.data.title ? [{ label: trigger.data.title }] : []),
          ]}
        />
      }
      tabs={{
        main: {
          Component: TriggerDetails,
          title: "Trigger Details",
          initialOpen: true,
        },
      }}
    />
  );
}

function TriggerIcon(
  { type }: { type: z.infer<typeof TriggerSchema>["type"] },
) {
  return (
    <div className="flex items-center justify-center p-2 bg-primary/10 rounded-md">
      {type === "cron" && (
        <Icon name="calendar_today" className="text-primary" />
      )}
      {type === "webhook" && <Icon name="webhook" className="text-primary" />}
    </div>
  );
}

export function TriggerDetailsSkeleton() {
  return (
    <div className="mx-2 space-y-6 max-w-full py-8">
      <Skeleton className="w-32 h-8 mb-2" />
      <div className="flex items-center gap-2">
        <Skeleton className="w-8 h-8 rounded-md" />
        <Skeleton className="w-48 h-6" />
        <Skeleton className="w-16 h-6 ml-2" />
      </div>
      <Skeleton className="w-1/2 h-4 mt-4" />
      <Skeleton className="w-full h-24 mt-4" />
    </div>
  );
}
