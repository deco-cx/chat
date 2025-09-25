import { useEffect, useMemo, useRef } from "react";
import { LanguageModelV1FinishReason } from "@ai-sdk/provider";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useAgent } from "../agent/provider.tsx";

const REPORTS_BY_FINISH_REASON = {
  "tool-calls": {
    title: "Agent hit the step limit for this response",
    description:
      "You can let the agent keep going from where it stopped, or adjust the step limit in settings.",
  },
  length: {
    title: "Agent hit the token limit for this response",
    description:
      "You can let the agent keep going from where it stopped, or adjust the token limit in settings.",
  },
  stop: {
    title: "Agent completed the response",
    description: "Everything looks good. Ask a follow-up question to keep going.",
  },
} as const;

type KnownFinishReason = keyof typeof REPORTS_BY_FINISH_REASON;

function getFinishReasonKey(
  reason: LanguageModelV1FinishReason | null,
): KnownFinishReason | undefined {
  if (!reason) return undefined;
  if (reason in REPORTS_BY_FINISH_REASON) {
    return reason as KnownFinishReason;
  }
  return undefined;
}

export function ChatFinishReason() {
  const { chat } = useAgent();
  const { append, status, finishReason } = chat;
  const lastLoggedReasonRef = useRef<LanguageModelV1FinishReason | "__NONE__">(
    "__NONE__",
  );

  useEffect(() => {
    if (!finishReason) return;
    if (finishReason in REPORTS_BY_FINISH_REASON) return;
    if (lastLoggedReasonRef.current === finishReason) return;
    lastLoggedReasonRef.current = finishReason;

    console.warn(
      "Unknown finish reason. Consider adding it to REPORTS_BY_FINISH_REASON in chat-finish-reason.tsx. Finish reason:",
      finishReason,
      "- the UI will ignore it.",
    );
  }, [finishReason]);

  const reasonKey = useMemo(
    () => getFinishReasonKey(finishReason),
    [finishReason],
  );

  if (status !== "ready" || !reasonKey) {
    return null;
  }

  return (
    <div className="w-full border border-border rounded-2xl mb-4 empty:hidden">
      <div
        className="p-4 grid gap-2"
        style={{ gridTemplateColumns: "auto 1fr auto" }}
      >
        <div className="w-5 h-5 flex items-center justify-center">
          <Icon name="error" filled className="text-destructive" size={20} />
        </div>

        <div className="flex flex-col gap-1">
          <div className="text-sm font-medium text-foreground">
            {REPORTS_BY_FINISH_REASON[reasonKey].title}
          </div>
          <div className="text-xs text-muted-foreground">
            {REPORTS_BY_FINISH_REASON[reasonKey].description}
          </div>
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            append({ role: "user", content: "Continue" });
          }}
        >
          Continue from here
        </Button>
      </div>
    </div>
  );
}
