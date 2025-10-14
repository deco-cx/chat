import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useLayoutEffect, useRef } from "react";
import { ChatError } from "./chat-error.tsx";
import { ChatFinishReason } from "./chat-finish-reason.tsx";
import { ChatMessage } from "./chat-message.tsx";

import { useAgent } from "../agent/provider.tsx";
import { EmptyState } from "./empty-state.tsx";

interface ChatMessagesProps {
  initialScrollBehavior?: "top" | "bottom";
  className?: string;
}

function Dots() {
  const { chat } = useAgent();
  const { status } = chat;

  if (status !== "streaming" && status !== "submitted") {
    return null;
  }

  return (
    <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 text-muted-foreground ml-4">
      <span className="inline-flex items-center gap-1">
        <span className="animate-bounce [animation-delay:-0.3s]">.</span>
        <span className="animate-bounce [animation-delay:-0.2s]">.</span>
        <span className="animate-bounce [animation-delay:-0.1s]">.</span>
      </span>
    </div>
  );
}

export function ChatMessages({
  initialScrollBehavior = "bottom",
  className,
}: ChatMessagesProps = {}) {
  const { scrollRef, chat, isAutoScrollEnabled, setAutoScroll } = useAgent();

  const hasInitializedScrollRef = useRef(false);
  const isInitialRenderRef = useRef(true);

  const { messages } = chat;

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, []);

  useLayoutEffect(() => {
    if (hasInitializedScrollRef.current) {
      return;
    }

    if (initialScrollBehavior === "bottom") {
      scrollToBottom();
    } else if (initialScrollBehavior === "top") {
      const viewport = scrollRef.current?.closest(
        '[data-slot="scroll-area-viewport"]',
      );
      viewport?.scrollTo({ top: 0, behavior: "auto" });
      setAutoScroll(scrollRef.current, false);
    }

    hasInitializedScrollRef.current = true;
  }, [initialScrollBehavior, scrollToBottom, setAutoScroll]);

  useLayoutEffect(() => {
    if (isInitialRenderRef.current) {
      isInitialRenderRef.current = false;

      if (initialScrollBehavior === "top") {
        return;
      }
    }

    if (initialScrollBehavior === "top") {
      return;
    }

    if (isAutoScrollEnabled(scrollRef.current)) {
      scrollToBottom();
    }
  }, [initialScrollBehavior, isAutoScrollEnabled, messages, scrollToBottom]);

  useLayoutEffect(() => {
    let cancel = false;

    const root = scrollRef.current?.closest(
      '[data-slot="scroll-area-viewport"]',
    );

    if (!scrollRef.current || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (cancel) return;

        const autoScroll = entries.some((e) => e.isIntersecting);
        setAutoScroll(scrollRef.current, autoScroll);
      },
      { root: root, rootMargin: "100px", threshold: 0 },
    );

    observer.observe(scrollRef.current);

    return () => {
      cancel = true;
      observer.disconnect();
    };
  }, [messages, setAutoScroll]);

  const isEmpty = messages.length === 0;

  return (
    <div className={cn("w-full min-w-0", className)}>
      {isEmpty ? (
        <EmptyState />
      ) : (
        <div className="flex flex-col gap-6 min-w-0">
          {messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              message={message}
              isLastMessage={messages.length === index + 1}
            />
          ))}
          <ChatError />
          <div className="px-4">
            <ChatFinishReason />
          </div>
          <Dots />
        </div>
      )}

      <div ref={scrollRef}>
        {messages.length > 0 && (
          <div
            className={cn(
              "absolute bottom-36 sm:bottom-6 md:bottom-0 md:-translate-y-1/2 left-1/2 transform -translate-x-1/2",
              "w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center",
              "cursor-pointer hover:bg-sidebar transition-colors z-50 border border-border",
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
