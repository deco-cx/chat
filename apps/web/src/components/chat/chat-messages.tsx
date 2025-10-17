import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useCallback, useLayoutEffect, useRef, useState, useEffect } from "react";
import { ChatError } from "./chat-error.tsx";
import { ChatFinishReason } from "./chat-finish-reason.tsx";
import { ChatMessage } from "./chat-message.tsx";

import { useAgenticChat } from "../chat/provider.tsx";
import { EmptyState } from "./empty-state.tsx";

interface ChatMessagesProps {
  initialScrollBehavior?: "top" | "bottom";
  className?: string;
}

function Dots() {
  const { chat } = useAgenticChat();
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
  const { scrollRef, chat } = useAgenticChat();

  const hasInitializedScrollRef = useRef(false);
  const isInitialRenderRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const scrollViewportRef = useRef<HTMLElement | null>(null);

  const { messages, status } = chat;
  const isStreaming = status === "streaming" || status === "submitted";

  // Check if user is at the bottom of the scroll container
  const checkIfAtBottom = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return true;

    const threshold = 100; // pixels from bottom to be considered "at bottom"
    const isBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <
      threshold;
    
    return isBottom;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior,
    });
    setIsAtBottom(true);
    setShowScrollButton(false);
  }, []);

  // Handle scroll events to detect position
  useEffect(() => {
    const viewport = scrollRef.current?.closest(
      '[data-slot="scroll-area-viewport"]',
    ) as HTMLElement | null;

    scrollViewportRef.current = viewport;

    if (!viewport) return;

    let timeoutId: NodeJS.Timeout | null = null;

    const handleScroll = () => {
      // Debounce scroll checks for better performance
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      // Use longer delay during streaming to prevent flickering
      const delay = isStreaming ? 300 : 20;

      timeoutId = setTimeout(() => {
        const atBottom = checkIfAtBottom();
        setIsAtBottom(atBottom);
        // Don't show button if we're streaming and at bottom
        if (isStreaming && atBottom) {
          setShowScrollButton(false);
        } else {
          setShowScrollButton(!atBottom);
        }
      }, delay);
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    
    // Initial check - delayed to ensure layout is ready
    const initialCheckTimeout = setTimeout(() => {
      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      // Don't show button during streaming if at bottom
      if (isStreaming && atBottom) {
        setShowScrollButton(false);
      } else {
        setShowScrollButton(!atBottom);
      }
    }, 50);

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      clearTimeout(initialCheckTimeout);
      viewport.removeEventListener("scroll", handleScroll);
    };
  }, [checkIfAtBottom, scrollRef, messages, isStreaming]);

  // Initial scroll behavior
  useLayoutEffect(() => {
    if (hasInitializedScrollRef.current) {
      return;
    }

    const viewport = scrollViewportRef.current;
    if (!viewport) return;

    if (initialScrollBehavior === "bottom") {
      scrollToBottom("auto");
    } else if (initialScrollBehavior === "top") {
      viewport.scrollTo({ top: 0, behavior: "auto" });
      setIsAtBottom(false);
      setShowScrollButton(true);
    }

    hasInitializedScrollRef.current = true;
  }, [initialScrollBehavior, scrollToBottom]);

  // Auto-scroll on new messages if at bottom
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

    if (isAtBottom) {
      scrollToBottom("smooth");
      // Keep button hidden during auto-scroll
      if (isStreaming) {
        setShowScrollButton(false);
      }
    }
  }, [initialScrollBehavior, isAtBottom, messages, scrollToBottom, isStreaming]);

  const isEmpty = messages.length === 0;

  return (
    <div className={cn("w-full min-w-0 relative", className)}>
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

      {/* Scroll to bottom button - sticky at bottom of scroll area */}
      {messages.length > 0 && showScrollButton && !(isStreaming && isAtBottom) && (
        <div className="sticky bottom-0 left-0 right-0 flex justify-center pointer-events-none pb-4 z-[100]">
          <button
            type="button"
            className={cn(
              "w-10 h-10 rounded-full pointer-events-auto",
              "bg-background dark:bg-accent shadow-xl",
              "border border-border/50",
              "flex items-center justify-center",
              "cursor-pointer hover:scale-110 hover:shadow-2xl",
              "transition-all duration-200 ease-out",
              "animate-in fade-in slide-in-from-bottom-4 duration-150",
              "group",
            )}
            onClick={() => scrollToBottom("smooth")}
            aria-label="Scroll to bottom"
          >
            <Icon 
              name="arrow_downward" 
              className="text-foreground group-hover:text-primary transition-colors" 
            />
          </button>
        </div>
      )}
      
      <div ref={scrollRef} />
    </div>
  );
}
