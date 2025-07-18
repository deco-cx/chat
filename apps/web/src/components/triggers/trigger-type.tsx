import type { TriggerOutput } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";

export function TriggerType({ trigger }: { trigger: TriggerOutput }) {
  if (trigger.data.type === "webhook") {
    return (
      <div className="flex items-center gap-1">
        <Icon name="webhook" size={18} />
        Webhook
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <Icon name="schedule" size={18} />
      {trigger.data.cronExp
        ? cronstrue.toString(trigger.data.cronExp)
        : trigger.data.cronExp}
    </div>
  );
}
