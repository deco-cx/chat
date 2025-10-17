import { type Thread, useSDK, useThreads, WELL_KNOWN_AGENTS } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  forwardRef,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUser } from "../../hooks/use-user.ts";
import { MainChat, MainChatSkeleton } from "../agent/chat.tsx";
import { AgentProvider } from "../agent/provider.tsx";
import { useDecopilotContext } from "./context.tsx";
import { useDecopilotThread } from "./thread-context.tsx";
import { useAppAdditionalTools } from "./use-app-additional-tools.ts";
import { useDecopilotOpen } from "../layout/decopilot-layout.tsx";

export const NO_DROP_TARGET = "no-drop-target";

function ThreadItem({
  thread,
  onClick,
  isActive,
}: {
  thread: Thread;
  onClick: () => void;
  isActive?: boolean;
}) {
  return (
    <button
      className={cn(
        "flex items-center gap-2 px-2.5 py-1.5 rounded text-xs transition-colors w-full text-left",
        "hover:bg-muted/60 cursor-pointer",
        isActive ? "bg-muted text-foreground" : "text-muted-foreground",
      )}
      type="button"
      onClick={onClick}
      title={thread.title}
    >
      <Icon name="chat" size={12} className="flex-shrink-0" />
      <span className="truncate flex-1">{thread.title || "Untitled"}</span>
    </button>
  );
}

function ThreadsModal({
  open,
  threads,
  onThreadSelect,
  activeThreadId,
}: {
  open: boolean;
  threads: Thread[];
  onThreadSelect: (threadId: string) => void;
  activeThreadId?: string;
}) {
  const [searchQuery, setSearchQuery] = useState("");

  // Filter threads based on search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;

    const query = searchQuery.toLowerCase();
    return threads.filter((thread) =>
      thread.title?.toLowerCase().includes(query),
    );
  }, [threads, searchQuery]);

  // Reset search when modal closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed top-21 right-8 z-50 w-80 max-h-96 bg-background border border-border rounded-md shadow-lg overflow-hidden flex flex-col">
      {/* Search Input */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Icon
            name="search"
            size={12}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-7 h-7 text-xs"
            autoFocus
          />
        </div>
      </div>

      {/* Threads List */}
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 p-1.5">
          {filteredThreads.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              {searchQuery.trim()
                ? "No conversations found"
                : "No conversations yet"}
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <ThreadItem
                key={thread.id}
                thread={thread}
                onClick={() => onThreadSelect(thread.id)}
                isActive={activeThreadId === thread.id}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface OpenTab {
  threadId: string;
  title?: string;
}

const ThreadTab = forwardRef<
  HTMLDivElement,
  {
    tab: OpenTab;
    isActive: boolean;
    onClick: () => void;
    onClose: () => void;
  }
>(({ tab, isActive, onClick, onClose }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center gap-2 px-3 py-2 border-r border-border transition-colors cursor-pointer group relative",
        isActive
          ? "bg-background text-foreground"
          : "bg-muted/30 text-muted-foreground hover:bg-muted/50",
      )}
      onClick={onClick}
    >
      <span className="text-sm truncate max-w-[150px]">
        {tab.title || "New chat"}
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className={cn(
          "flex size-4 items-center justify-center rounded hover:bg-accent transition-opacity",
          isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <Icon name="close" size={12} />
      </button>
    </div>
  );
});
ThreadTab.displayName = "ThreadTab";

export function DecopilotChat() {
  const { threadState, clearThreadState } = useDecopilotThread();
  const { setOpen } = useDecopilotOpen();
  const { locator } = useSDK();
  const user = useUser();
  const threads = useThreads({
    agentId: WELL_KNOWN_AGENTS.decopilotAgent.id,
    resourceId: user?.id ?? "",
  });
  const { data: threadsData } = threads;

  // Sort threads by most recent first
  const sortedThreads = useMemo(() => {
    return (threadsData?.threads ?? [])
      .slice()
      .sort(
        (a, b) =>
          new Date(b.updatedAt || b.createdAt).getTime() -
          new Date(a.updatedAt || a.createdAt).getTime(),
      );
  }, [threadsData?.threads]);

  // State for managing open tabs with localStorage persistence
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => {
    try {
      const savedTabs = localStorage.getItem(`decopilot-open-tabs-${locator}`);
      if (savedTabs) {
        return JSON.parse(savedTabs);
      }
    } catch (error) {
      console.error("Failed to load open tabs from localStorage:", error);
    }
    return [];
  });

  const [activeTabIndex, setActiveTabIndex] = useState<number>(() => {
    try {
      const savedIndex = localStorage.getItem(
        `decopilot-active-tab-index-${locator}`,
      );
      if (savedIndex !== null) {
        return Number.parseInt(savedIndex, 10);
      }
    } catch (error) {
      console.error(
        "Failed to load active tab index from localStorage:",
        error,
      );
    }
    return 0;
  });

  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Refs for each tab to enable scrolling
  const tabRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Persist openTabs to localStorage
  useEffect(() => {
    if (openTabs.length > 0) {
      try {
        localStorage.setItem(
          `decopilot-open-tabs-${locator}`,
          JSON.stringify(openTabs),
        );
      } catch (error) {
        console.error("Failed to save open tabs to localStorage:", error);
      }
    }
  }, [openTabs, locator]);

  // Persist activeTabIndex to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        `decopilot-active-tab-index-${locator}`,
        activeTabIndex.toString(),
      );
    } catch (error) {
      console.error("Failed to save active tab index to localStorage:", error);
    }
  }, [activeTabIndex, locator]);

  // Scroll to active tab when it changes or on initial load
  useEffect(() => {
    // Use a small delay to ensure the DOM is fully rendered
    const timeoutId = setTimeout(() => {
      if (tabRefs.current[activeTabIndex]) {
        tabRefs.current[activeTabIndex]?.scrollIntoView({
          behavior: "smooth",
          block: "nearest",
          inline: "center",
        });
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [activeTabIndex, openTabs.length]);

  // Initialize with the first thread or create a new one
  useEffect(() => {
    if (openTabs.length === 0) {
      const defaultThreadId =
        sortedThreads.length > 0
          ? sortedThreads[0].id.replace(`${user?.id ?? ""}-`, "")
          : crypto.randomUUID();

      const defaultTitle =
        sortedThreads.length > 0 ? sortedThreads[0].title : undefined;

      setOpenTabs([{ threadId: defaultThreadId, title: defaultTitle }]);
      setActiveTabIndex(0);
    }
  }, [sortedThreads, user?.id, openTabs.length]);

  const appAdditionalTools = useAppAdditionalTools();
  const {
    additionalTools: contextTools,
    rules,
    onToolCall,
  } = useDecopilotContext();

  // Merge all additional tools
  const allAdditionalTools = {
    ...appAdditionalTools,
    ...contextTools,
  };

  // Get the current active thread
  const activeTab = openTabs[activeTabIndex];

  // Update tab title when thread title changes
  useEffect(() => {
    if (activeTab) {
      const thread = sortedThreads.find(
        (t) =>
          t.id === `${user?.id ?? ""}-${activeTab.threadId}` ||
          t.id === activeTab.threadId,
      );
      if (thread && thread.title !== activeTab.title) {
        setOpenTabs((prev) =>
          prev.map((tab, idx) =>
            idx === activeTabIndex ? { ...tab, title: thread.title } : tab,
          ),
        );
      }
    }
  }, [
    sortedThreads,
    activeTab?.threadId,
    activeTab?.title,
    activeTabIndex,
    user?.id,
  ]);

  function handleThreadSelect(selectedThreadId: string) {
    // Remove user prefix if present for consistency
    const cleanThreadId = selectedThreadId.replace(`${user?.id ?? ""}-`, "");

    // Check if thread is already open in a tab
    const existingTabIndex = openTabs.findIndex(
      (tab) => tab.threadId === cleanThreadId,
    );

    if (existingTabIndex !== -1) {
      // Switch to existing tab
      setActiveTabIndex(existingTabIndex);
    } else {
      // Open in a new tab
      const thread = sortedThreads.find(
        (t) =>
          t.id === selectedThreadId ||
          t.id === `${user?.id ?? ""}-${cleanThreadId}`,
      );
      setOpenTabs((prev) => [
        ...prev,
        { threadId: cleanThreadId, title: thread?.title },
      ]);
      setActiveTabIndex(openTabs.length);
    }

    // Close modal after selection
    setShowHistoryModal(false);
  }

  function handleNewThread() {
    const newThreadId = crypto.randomUUID();
    setOpenTabs((prev) => [
      ...prev,
      { threadId: newThreadId, title: undefined },
    ]);
    setActiveTabIndex(openTabs.length);
  }

  function handleCloseTab(index: number) {
    if (openTabs.length === 1) {
      // Don't close the last tab, just create a new thread in it
      const newThreadId = crypto.randomUUID();
      setOpenTabs([{ threadId: newThreadId, title: undefined }]);
      setActiveTabIndex(0);
      setOpen(false);
      return;
    }

    setOpenTabs((prev) => prev.filter((_, idx) => idx !== index));

    // Adjust active tab index if needed
    if (activeTabIndex >= index && activeTabIndex > 0) {
      setActiveTabIndex(activeTabIndex - 1);
    } else if (
      activeTabIndex === index &&
      activeTabIndex === openTabs.length - 1
    ) {
      setActiveTabIndex(openTabs.length - 2);
    }
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* History Modal */}
      <ThreadsModal
        open={showHistoryModal}
        threads={sortedThreads}
        onThreadSelect={handleThreadSelect}
        activeThreadId={activeTab?.threadId}
      />

      {/* Header with agent info and controls */}
      <div className="flex min-h-10 shrink-0 items-center gap-2 border-b border-border px-2">
        <div className="flex items-center gap-2">
          <img
            src={WELL_KNOWN_AGENTS.decopilotAgent.avatar}
            alt={WELL_KNOWN_AGENTS.decopilotAgent.name}
            className="min-w-5 size-5 rounded-md border border-border"
          />
        </div>
        {/* Tabs bar */}
        {openTabs.length > 0 && (
          <div className="flex items-center overflow-x-auto bg-muted/20 h-full w-full">
            <div className="flex grow overflow-x-auto h-full border-l [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {openTabs.map((tab, index) => (
                <ThreadTab
                  key={tab.threadId}
                  ref={(el) => {
                    tabRefs.current[index] = el;
                  }}
                  tab={tab}
                  isActive={index === activeTabIndex}
                  onClick={() => setActiveTabIndex(index)}
                  onClose={() => handleCloseTab(index)}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={handleNewThread}
              className="cursor-pointer h-full w-10 flex size-8 items-center justify-center hover:bg-accent transition-colors flex-shrink-0 border-l border-border"
              title="New conversation"
            >
              <Icon name="add" size={16} />
            </button>
            <button
              type="button"
              onClick={() => setShowHistoryModal(!showHistoryModal)}
              className="cursor-pointer h-full w-10 flex size-8 items-center justify-center hover:bg-accent transition-colors flex-shrink-0 border-border"
              title="View history"
            >
              <Icon name="history" size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Chat Content - Render all tabs but only show the active one */}
      <div className="flex-1 min-h-0 relative">
        {openTabs.map((tab, index) => (
          <div
            key={tab.threadId}
            className={cn(
              "absolute inset-0",
              index === activeTabIndex ? "block" : "hidden",
            )}
          >
            <Suspense fallback={<MainChatSkeleton />}>
              <AgentProvider
                key={tab.threadId}
                agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
                threadId={tab.threadId}
                initialInput={
                  index === activeTabIndex && threadState.initialMessage
                    ? threadState.initialMessage
                    : undefined
                }
                autoSend={index === activeTabIndex && threadState.autoSend}
                onAutoSendComplete={clearThreadState}
                additionalTools={allAdditionalTools}
                initialRules={rules}
                onToolCall={onToolCall}
                uiOptions={{
                  showThreadTools: true,
                  showModelSelector: true,
                  showThreadMessages: true,
                  showAgentVisibility: false,
                  showEditAgent: false,
                }}
              >
                <MainChat className="h-full" />
              </AgentProvider>
            </Suspense>
          </div>
        ))}
      </div>
    </div>
  );
}
DecopilotChat.displayName = "DefaultChat";
