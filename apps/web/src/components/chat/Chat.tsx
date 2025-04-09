import { type Message, useChat } from "@ai-sdk/react";
import type { Agent } from "@deco/sdk";
import { API_SERVER_URL } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useEffect, useLayoutEffect, useRef } from "react";
import { ChatInput } from "./ChatInput.tsx";
import { Welcome } from "./EmptyState.tsx";
import { ChatHeader } from "./Header.tsx";
import { ChatMessage } from "./Message.tsx";
import { openPreviewPanel } from "./utils/preview.ts";

interface ChatProps {
  initialMessages?: Message[];
  agent: Agent;
  updateAgent: (updates: Partial<Agent>) => Promise<Agent>;
  agentRoot: string;
  threadId?: string;
}

interface ChatMessagesProps {
  messages: Message[];
  status: "streaming" | "submitted" | "ready" | "idle";
  handlePickerSelect: (
    toolCallId: string,
    selectedValue: string,
  ) => Promise<void>;
  error?: Error;
  onRetry?: (context?: string[]) => void;
}

function ChatMessages(
  { messages, status, handlePickerSelect, error, onRetry }: ChatMessagesProps,
) {
  return (
    <div className="flex flex-col gap-4 p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className="animate-in slide-in-from-bottom duration-300"
        >
          <ChatMessage
            message={message}
            handlePickerSelect={handlePickerSelect}
          />
        </div>
      ))}
      {error && (
        <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 ml-3">
          <div className="flex items-center gap-4 p-4 bg-destructive/5 text-destructive rounded-xl text-sm">
            <Icon name="info" className="h-4 w-4" />
            <p>An error occurred while generating the response.</p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="bg-background hover:bg-background/80 shadow-none border border-input py-3 px-4 h-10"
                onClick={() => {
                  onRetry?.([
                    JSON.stringify({
                      type: "error",
                      message: error.message,
                      name: error.name,
                      stack: error.stack,
                    }),
                    "The previous attempt resulted in an error. I'll try to address the error and provide a better response.",
                  ]);
                }}
              >
                <Icon name="refresh" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}
      {(status === "streaming" || status === "submitted") && (
        <div className="animate-in slide-in-from-bottom duration-300 flex items-center gap-2 text-muted-foreground ml-4">
          <span className="inline-flex items-center gap-1">
            <span className="animate-bounce [animation-delay:-0.3s]">.</span>
            <span className="animate-bounce [animation-delay:-0.2s]">.</span>
            <span className="animate-bounce [animation-delay:-0.1s]">.</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function Chat({
  initialMessages = [],
  agent,
  updateAgent,
  agentRoot,
  threadId,
}: ChatProps) {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    setMessages,
    error,
    append,
    stop,
  } = useChat({
    initialMessages,
    credentials: "include",
    headers: {
      "x-deno-isolate-instance-id": agentRoot,
    },
    api: new URL("/actors/AIAgent/invoke/stream", API_SERVER_URL).href,
    experimental_prepareRequestBody: ({ messages }) => ({
      args: [[messages.at(-1)]],
      metadata: {
        threadId: threadId ?? agent.id,
      },
    }),
    onError: (error) => {
      console.error("Chat error:", error);
      setMessages((prevMessages) => prevMessages.slice(0, -1));
    },
    onToolCall: async ({ toolCall }) => {
      if (toolCall.toolName === "editAgentName") {
        const { name, description } = toolCall.args as {
          name: string;
          description: string;
        };
        const updatedAgent = await updateAgent({ name, description });
        return { success: true, ...updatedAgent };
      }

      if (toolCall.toolName === "RENDER") {
        const { content, title } = toolCall.args as {
          content: string;
          title: string;
        };

        openPreviewPanel(
          `preview-${toolCall.toolCallId}`,
          content,
          title,
        );
        return {
          success: true,
        };
      }
    },
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    globalThis.scrollTo({
      top: container.scrollHeight,
      behavior: "auto",
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    globalThis.scrollTo({
      top: container.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  const handlePickerSelect = async (
    toolCallId: string,
    selectedValue: string,
  ) => {
    if (selectedValue) {
      // Remove the picker
      setMessages((prevMessages) =>
        prevMessages.map((msg) => ({
          ...msg,
          toolInvocations: msg.toolInvocations?.filter(
            (tool) => tool.toolCallId !== toolCallId,
          ),
        }))
      );

      await append({
        role: "user",
        content: selectedValue,
      });
    }
  };

  const handleRetry = async (context?: string[]) => {
    const lastUserMessage = messages.findLast((msg) => msg.role === "user");
    if (!lastUserMessage) return;

    await append({
      content: lastUserMessage.content,
      role: "user",
      annotations: context || [],
    });
  };

  return (
    <div className="grid grid-rows-[auto_1fr_auto] grid-cols-1 h-full max-h-full">
      {/* Fixed Header */}
      <div className="w-full mx-auto">
        <ChatHeader agent={agent} />
      </div>

      {/* Scrollable Messages */}
      <div className="w-full max-w-[800px] mx-auto overflow-y-auto">
        <div ref={containerRef}>
          {messages.length === 0 ? <Welcome agent={agent} /> : (
            <ChatMessages
              messages={messages}
              status={status as "streaming" | "submitted" | "ready" | "idle"}
              handlePickerSelect={handlePickerSelect}
              error={error}
              onRetry={handleRetry}
            />
          )}
        </div>
      </div>

      {/* Fixed Input */}
      <div className="w-full max-w-[800px] mx-auto bg-background">
        <ChatInput
          input={input}
          handleInputChange={handleInputChange}
          handleSubmit={handleSubmit}
          isLoading={status === "submitted" || status === "streaming"}
          stop={stop}
        />
      </div>
    </div>
  );
}
