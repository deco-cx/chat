import { Suspense, useEffect, useMemo, useState } from "react";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import {
  useThread,
  useThreadMessages,
  useUpdateThreadTitle,
  useAgentData,
  useAgentRoot,
  type ThreadDetails,
} from "@deco/sdk";
import type { UIMessage } from "@ai-sdk/react";
import { ThreadDetailPanel } from "./thread-detail-panel.tsx";
import { AgenticChatProvider } from "../chat/provider.tsx";
import { MainChat } from "../agent/chat.tsx";
import { threadCache } from "../../utils/thread-cache.ts";

// Track title generation with timestamps to prevent memory leaks
const TITLE_GENERATION_TTL = 5 * 60 * 1000; // 5 minutes
const titlesInProgress = new Map<string, number>();

// Cleanup expired entries periodically
function cleanupExpiredTitles() {
  const now = Date.now();
  for (const [threadId, timestamp] of titlesInProgress.entries()) {
    if (now - timestamp > TITLE_GENERATION_TTL) {
      titlesInProgress.delete(threadId);
    }
  }
}

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
      <ThreadMessagesWithCache threadId={thread.id} />
    </ThreadDetailPanel>
  );
}

// Wrapper that checks cache first
function ThreadMessagesWithCache({ threadId }: { threadId: string }) {
  const [cachedData, setCachedData] = useState(() => threadCache.get(threadId));

  // Reset cache check when threadId changes
  useEffect(() => {
    const cached = threadCache.get(threadId);
    setCachedData(cached);
  }, [threadId]);

  // If we have cached data, render it instantly (NO Suspense)
  if (cachedData) {
    return <CachedThreadMessages threadId={threadId} cachedData={cachedData} />;
  }

  // No cache, use normal loading WITH Suspense (scoped to messages area only)
  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden">
      <Suspense
        fallback={
          <div className="flex-1 space-y-4 p-4">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-24 w-3/4 rounded-lg ml-auto" />
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-20 w-2/3 rounded-lg ml-auto" />
          </div>
        }
      >
        <ThreadMessages threadId={threadId} />
      </Suspense>
    </div>
  );
}

// Renders cached data instantly - hooks needed for agent data
function CachedThreadMessages({
  threadId: _threadId,
  cachedData,
}: {
  threadId: string;
  cachedData: {
    threadDetail: ThreadDetails;
    messages: { messages: UIMessage[] };
  };
}) {
  const agentId = cachedData.threadDetail.metadata?.agentId ?? cachedData.threadDetail.id;
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);

  if (!agent) return null;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden h-full">
      <AgenticChatProvider
        agentId={agentId}
        threadId={cachedData.threadDetail.id}
        agent={agent}
        agentRoot={agentRoot}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: false,
          showThreadMessages: false,
          showAgentVisibility: false,
          showEditAgent: false,
          showContextResources: false,
          readOnly: true,
        }}
        initialMessages={cachedData.messages.messages}
      >
        <MainChat
          showInput={false}
          initialScrollBehavior="top"
          className="flex-1 min-h-0 h-full"
          contentClassName="flex flex-col min-w-0"
        />
      </AgenticChatProvider>
    </div>
  );
}

// Normal loading path (with caching after load)
function ThreadMessages({ threadId }: { threadId: string }) {
  const { data: threadDetail } = useThread(threadId);
  const title = useMemo(() => threadDetail?.title ?? "", [threadDetail?.title]);
  const { data: messages } = useThreadMessages(threadId, { enabled: true });
  const updateThreadTitle = useUpdateThreadTitle();

  // Cache the data after it loads
  useEffect(() => {
    if (threadDetail && messages) {
      threadCache.set(threadId, threadDetail, messages);
    }
  }, [threadDetail, messages, threadId]);

  useEffect(() => {
    if (!title || !messages?.messages?.length) {
      return;
    }

    const isGeneratedTitle = !/^new thread/i.test(title.trim());

    // Clean up expired entries before checking
    cleanupExpiredTitles();

    // Check if this thread is already being processed (and not expired) or has a generated title
    const inProgressTimestamp = titlesInProgress.get(threadId);
    const isRecentlyInProgress =
      inProgressTimestamp &&
      Date.now() - inProgressTimestamp < TITLE_GENERATION_TTL;

    if (isGeneratedTitle || isRecentlyInProgress) {
      return;
    }

    const summaryCandidate = extractSummaryCandidate(messages.messages);

    if (!summaryCandidate) {
      return;
    }

    // Mark this thread as in progress with current timestamp
    titlesInProgress.set(threadId, Date.now());

    // Fire and forget - let it complete in background
    updateThreadTitle.mutate(
      {
        threadId,
        title: summaryCandidate,
        stream: true,
      },
      {
        onSettled: () => {
          // Clean up after mutation completes (success or error)
          titlesInProgress.delete(threadId);
        },
      },
    );
  }, [messages?.messages, threadId, title, updateThreadTitle]);

  if (!threadDetail || !messages) {
    return (
      <div className="flex-1 space-y-4 p-4">
        <Skeleton className="h-20 w-full rounded-lg" />
        <Skeleton className="h-24 w-3/4 rounded-lg ml-auto" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-20 w-2/3 rounded-lg ml-auto" />
      </div>
    );
  }

  const agentId = threadDetail.metadata?.agentId ?? threadDetail.id;
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);

  if (!agent) return null;

  return (
    <div className="flex flex-1 min-h-0 flex-col overflow-hidden h-full">
      <AgenticChatProvider
        agentId={agentId}
        threadId={threadDetail.id}
        agent={agent}
        agentRoot={agentRoot}
        uiOptions={{
          showThreadTools: false,
          showModelSelector: false,
          showThreadMessages: false,
          showAgentVisibility: false,
          showEditAgent: false,
          showContextResources: false,
          readOnly: true,
        }}
        initialMessages={messages.messages}
      >
        <MainChat
          showInput={false}
          initialScrollBehavior="top"
          className="flex-1 min-h-0 h-full"
          contentClassName="flex flex-col min-w-0"
        />
      </AgenticChatProvider>
    </div>
  );
}

const SUMMARY_MAX_LENGTH = 80;
const SUMMARY_MIN_TRUNCATE_LENGTH = 40;

function extractSummaryCandidate(messages: UIMessage[]) {
  if (!messages.length) {
    return null;
  }

  const firstUserMessage = messages.find((message) => message.role === "user");

  if (!firstUserMessage) {
    return null;
  }

  // Extract text from UIMessage parts
  const textContent =
    firstUserMessage.parts
      ?.map((part) => (part.type === "text" ? part.text : ""))
      .join(" ") ?? "";

  const normalized = textContent.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length <= SUMMARY_MAX_LENGTH) {
    return normalized;
  }

  const truncated = normalized.slice(0, SUMMARY_MAX_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");

  return (
    lastSpace > SUMMARY_MIN_TRUNCATE_LENGTH
      ? truncated.slice(0, lastSpace)
      : truncated
  ).concat("…");
}
