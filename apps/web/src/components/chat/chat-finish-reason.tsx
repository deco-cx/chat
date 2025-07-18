import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useChatContext } from "./context.tsx";

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
};

export function ChatFinishReason() {
  const {
    chat: { append, status, finishReason },
  } = useChatContext();

  if (
    status !== "ready" ||
    (finishReason !== "tool-calls" && finishReason !== "length")
  ) {
    if (finishReason !== "stop") {
      console.warn(
        "Unknown finish reason. Consider adding it to REPORTS_BY_FINISH_REASON in chat-finish-reason.tsx. Finish reason: ",
        finishReason,
      );
    }

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
            {REPORTS_BY_FINISH_REASON[finishReason].title}
          </div>
          <div className="text-xs text-muted-foreground">
            {REPORTS_BY_FINISH_REASON[finishReason].description}
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
