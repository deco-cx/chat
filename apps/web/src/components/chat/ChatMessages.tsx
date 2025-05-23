import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useLayoutEffect } from "react";
import { ChatError } from "./ChatError.tsx";
import { useChatContext } from "./context.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { ChatMessage } from "./Message.tsx";

function Dots() {
  const { chat: { status } } = useChatContext();

  if (status !== "streaming" && status !== "submitted") {
    return null;
  }

  return (
    <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 text-muted-foreground ml-4">
      <span className="inline-flex items-center gap-1">
        <span className="animate-bounce [animation-delay:-0.3s]">
          .
        </span>
        <span className="animate-bounce [animation-delay:-0.2s]">
          .
        </span>
        <span className="animate-bounce [animation-delay:-0.1s]">
          .
        </span>
      </span>
    </div>
  );
}

export function ChatMessages() {
  const {
    agentId,
    scrollRef,
    chat,
    isAutoScrollEnabled,
    setAutoScroll,
  } = useChatContext();

  const isStreaming = chat.status === "streaming";
  const { messages } = chat;

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  useLayoutEffect(() => {
    if (isAutoScrollEnabled(scrollRef.current)) {
      scrollToBottom();
    }
  }, [messages, scrollToBottom, isAutoScrollEnabled]);

  useLayoutEffect(() => {
    let cancel = false;

    const root = scrollRef.current?.closest(
      '[data-slot="scroll-area-viewport"]',
    );

    if (!scrollRef.current || !root) return;

    const observer = new IntersectionObserver((entries) => {
      if (cancel) return;

      const autoScroll = entries.some((e) => e.isIntersecting);
      setAutoScroll(scrollRef.current, autoScroll);
    }, { root: root, rootMargin: "100px", threshold: 0 });

    observer.observe(scrollRef.current);

    return () => {
      cancel = true;
      observer.disconnect();
    };
  }, [messages, setAutoScroll]);

  const isEmpty = messages.length === 0;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {isEmpty ? <EmptyState /> : (
        <div className="flex flex-col gap-4">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              agentId={agentId}
              isStreaming={isStreaming}
              isLastMessage={messages.length === index + 1}
            />
          ))}
          <ChatError />
          <Dots />
        </div>
      )}

      <div ref={scrollRef}>
        {messages.length > 0 && (
          <div
            className={cn(
              "absolute bottom-36 sm:bottom-6 md:bottom-0 md:-translate-y-1/2 left-1/2 transform -translate-x-1/2",
              "w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center",
              "cursor-pointer hover:bg-slate-50 transition-colors z-50 border border-slate-200",
              `[[data-disable-auto-scroll="false"]_&]:opacity-0 opacity-100 transition-opacity`,
              `[[data-disable-auto-scroll="false"]_&]:pointer-events-none`,
            )}
            onClick={() => scrollToBottom()}
            aria-label="Scroll to bottom"
          >
            <Icon name="arrow_downward" />
          </div>
        )}
      </div>
    </div>
  );
}
