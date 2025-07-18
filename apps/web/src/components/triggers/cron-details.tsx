import type { CronTrigger } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import cronstrue from "cronstrue";
import { CodeBlock } from "./code-block.tsx";

export function CronDetails({ trigger }: { trigger: CronTrigger }) {
  // Check if this is an agent trigger (has prompt) or tool trigger (has callTool)
  const isAgentTrigger = "prompt" in trigger;
  const isToolTrigger = "callTool" in trigger;

  return (
    <div className="space-y-4 border p-4 rounded-md bg-muted">
      <div className="flex items-center gap-2">
        <Icon name="calendar_today" className="h-5 w-5 text-special" />
        <h4 className="font-medium">Schedule Details</h4>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Cron Expression</div>
        <CodeBlock>{trigger.cronExp}</CodeBlock>
      </div>

      <div>
        <div className="text-sm font-medium mb-1">Runs At</div>
        <div className="text-sm">
          {trigger.cronExp
            ? cronstrue.toString(trigger.cronExp)
            : trigger.cronExp}
        </div>
      </div>

      {isAgentTrigger && (
        <div>
          <div className="text-sm font-medium mb-1">Prompt</div>
          <CodeBlock>{JSON.stringify(trigger.prompt, null, 2)}</CodeBlock>
        </div>
      )}

      {isToolTrigger && (
        <div>
          <div className="text-sm font-medium mb-1">Arguments</div>
          <CodeBlock>
            {JSON.stringify(trigger.callTool.arguments, null, 2)}
          </CodeBlock>
        </div>
      )}
    </div>
  );
}
