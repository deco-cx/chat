import { Suspense, useEffect, useMemo, useRef } from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useThread, useThreadMessages, useUpdateThreadTitle } from "@deco/sdk";
import { ThreadDetailPanel } from "./thread-detail-panel.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { MainChat } from "../agent/chat.tsx";

export function ThreadConversation({
  thread,
  onNavigate,
  canNavigatePrevious,
  canNavigateNext,
}: {
  thread: {
    id: string;
    title?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  } & Record<string, unknown>;
  onNavigate: (direction: "previous" | "next") => void;
  canNavigatePrevious: boolean;
  canNavigateNext: boolean;
}) {
  // Show header immediately with data from the thread list
  const threadForHeader = {
    id: thread.id,
    title: thread.title || "Untitled conversation",
    resourceId: thread.resourceId,
    metadata: thread.metadata || {},
  };

  return (
    <ThreadDetailPanel
      thread={threadForHeader}
      onNavigate={onNavigate}
      canNavigatePrevious={canNavigatePrevious}
      canNavigateNext={canNavigateNext}
    >
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <ThreadMessages threadId={thread.id} />
      </Suspense>
    </ThreadDetailPanel>
  );
}

function ThreadMessages({ threadId }: { threadId: string }) {
  const { data: threadDetail } = useThread(threadId);
  const title = useMemo(() => threadDetail?.title ?? "", [threadDetail?.title]);
  const { data: messages } = useThreadMessages(threadId);
  const updateThreadTitle = useUpdateThreadTitle();
  const hasTriggeredRef = useRef(false);

  useEffect(() => {
    hasTriggeredRef.current = false;
  }, [threadId, title]);

  useEffect(() => {
    if (!title || !messages?.messages?.length) {
      return;
    }

    const isGeneratedTitle = !/^new thread/i.test(title.trim());

    if (
      isGeneratedTitle ||
      updateThreadTitle.isPending ||
      hasTriggeredRef.current
    ) {
      return;
    }

    const summaryCandidate = extractSummaryCandidate(messages.messages);

    if (!summaryCandidate) {
      return;
    }
    hasTriggeredRef.current = true;
    updateThreadTitle.mutate({
      threadId,
      title: summaryCandidate,
      stream: true,
    });
  }, [
    messages?.messages,
    threadId,
    title,
    updateThreadTitle.isPending,
    updateThreadTitle,
  ]);

  if (!threadDetail || !messages) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <AgentProvider
      agentId={threadDetail.metadata?.agentId ?? threadDetail.id}
      threadId={threadDetail.id}
      uiOptions={{
        showThreadTools: false,
        showModelSelector: false,
        showThreadMessages: true,
        showAgentVisibility: false,
        showEditAgent: false,
        showContextResources: false,
      }}
      readOnly
    >
      <MainChat
        showInput={false}
        initialScrollBehavior="top"
        className="flex-1 min-w-0"
        contentClassName="flex flex-col min-w-0"
      />
    </AgentProvider>
  );
}

function extractSummaryCandidate(
  messages: { role: string; content: unknown }[],
) {
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

  return (lastSpace > 40 ? truncated.slice(0, lastSpace) : truncated).concat(
    "…",
  );
}
