import { Suspense } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useThread, useThreadMessages } from "@deco/sdk";
import { ThreadDetailPanel } from "./thread-detail-panel.tsx";

export function ThreadConversation({
  thread,
  onNavigate,
}: {
  thread: { id: string } & Record<string, unknown>;
  onNavigate: (direction: "previous" | "next") => void;
}) {
  const { data: threadDetail } = useThread(thread.id);
  const { data: messages } = useThreadMessages(thread.id);

  if (!threadDetail || !messages) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <ThreadDetailPanel
      thread={{ ...threadDetail, messages: messages.messages }}
      onNavigate={onNavigate}
    />
  );
}
