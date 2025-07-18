import type { TriggerOutput } from "@deco/sdk";
import { Card, CardContent } from "@deco/ui/components/card.tsx";
import { useState } from "react";
import { timeAgo } from "../../utils/time-ago.ts";
import { UserAvatar } from "../common/avatar/user.tsx";
import { TriggerActions } from "./trigger-actions.tsx";
import { TriggerToggle } from "./trigger-toggle.tsx";
import { TriggerType } from "./trigger-type.tsx";

export type Trigger = TriggerOutput;

export function TriggerCard({
  trigger,
  onClick,
}: {
  trigger: Trigger;
  onClick: (trigger: Trigger) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="overflow-hidden border rounded-xl hover:shadow-md transition-shadow cursor-pointer relative">
      <CardContent
        className="p-6 flex flex-col gap-4"
        onClick={() => onClick(trigger)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <TriggerToggle trigger={trigger} />
            <h3 className="text-lg font-semibold text-foreground">
              {trigger.data.title}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <TriggerType trigger={trigger} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <UserAvatar
            url={trigger.user?.metadata?.avatar_url}
            fallback={trigger.user?.metadata?.full_name || "User"}
            size="xs"
          />
          <span className="text-sm text-muted-foreground">
            {trigger.user?.metadata?.full_name || "Anonymous"}
          </span>
          <span className="text-sm text-muted-foreground/50 ml-auto">
            {timeAgo(new Date(trigger.createdAt || ""))}
          </span>
        </div>
      </CardContent>
      <div className="absolute top-6 right-6">
        <TriggerActions trigger={trigger} open={open} onOpenChange={setOpen} />
      </div>
    </Card>
  );
}
