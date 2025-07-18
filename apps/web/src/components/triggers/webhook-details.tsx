import type { WebhookTrigger } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { CodeBlock } from "./code-block.tsx";

export function WebhookDetails({ trigger }: { trigger: WebhookTrigger }) {
  return (
    <div className="space-y-4 border p-4 rounded-md bg-muted">
      <div className="flex items-center gap-2">
        <Icon name="webhook" className="h-5 w-5 text-special" />
        <h4 className="font-medium">Webhook Details</h4>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Webhook URL</div>
        <CodeBlock className="break-all">{trigger.url}</CodeBlock>
      </div>

      {trigger.passphrase && (
        <div>
          <div className="text-sm font-medium mb-1">Passphrase</div>
          <CodeBlock>{trigger.passphrase}</CodeBlock>
        </div>
      )}

      {"schema" in trigger && (
        <div>
          <div className="text-sm font-medium mb-1">Schema</div>
          <CodeBlock className="max-h-[200px] overflow-y-auto">
            {JSON.stringify(trigger.schema, null, 2)}
          </CodeBlock>
        </div>
      )}

      <div className="text-sm text-muted-foreground">
        Use this URL to trigger this trigger from external systems.
      </div>
    </div>
  );
}
