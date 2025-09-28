import { Suspense, useEffect, useMemo, useRef } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useThread, useThreadMessages, useUpdateThreadTitle } from "@deco/sdk";
import { ThreadDetailPanel } from "./thread-detail-panel.tsx";

export function ThreadConversation({
  thread,
  onNavigate,
}: {
  thread: { id: string } & Record<string, unknown>;
  onNavigate: (direction: "previous" | "next") => void;
}) {
  const { data: threadDetail } = useThread(thread.id);
  const title = useMemo(() => threadDetail?.title ?? "", [threadDetail?.title]);
  const { data: messages } = useThreadMessages(thread.id);
  const updateThreadTitle = useUpdateThreadTitle();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [thread.id, title]);

  useEffect(() => {
    if (!title || !messages?.messages?.length) {
      return;
    }

    const isGeneratedTitle = !/^new thread/i.test(title.trim());

    if (isGeneratedTitle || updateThreadTitle.isPending || hasTriggeredRef.current) {
      return;
    }

    const summaryCandidate = extractSummaryCandidate(messages.messages);

    if (!summaryCandidate) {
      return;
    }
    hasTriggeredRef.current = true;
    updateThreadTitle.mutate({ threadId: thread.id, title: summaryCandidate, stream: true });
  }, [messages?.messages, thread.id, title, updateThreadTitle.isPending, updateThreadTitle]);

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

function extractSummaryCandidate(messages: { role: string; content: unknown }[]) {
  if (!messages.length) {
    return null;
  }

  const firstUserMessage = messages.find(
    (message) => message.role === "user" && typeof message.content === "string",
  );

  if (typeof firstUserMessage?.content !== "string") {
    return null;
  }

  const normalized = firstUserMessage.content.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= 80) {
    return normalized;
  }

  const truncated = normalized.slice(0, 80);
  const lastSpace = truncated.lastIndexOf(" ");

  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).concat("…");
}
