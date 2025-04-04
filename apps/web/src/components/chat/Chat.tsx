import { type Message, useChat } from "@ai-sdk/react";
import type { Agent } from "@deco/sdk";
import { useEffect, useLayoutEffect, useRef } from "react";
import { API_SERVER_URL } from "../../constants.ts";
import { ChatInput } from "./ChatInput.tsx";
import { Welcome } from "./EmptyState.tsx";
import { ChatHeader } from "./Header.tsx";
import { ChatMessage } from "./Message.tsx";

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
}

function ChatMessages(
  { messages, status, handlePickerSelect }: ChatMessagesProps,
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

      if (toolCall.toolName === "renderHTML") {
        const { html } = toolCall.args as { html: string };
        return {
          success: true,
          html: html,
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

  return (
    <div className="grid grid-rows-[auto_1fr_auto] grid-cols-1 h-full max-h-full">
      {/* Fixed Header */}
      <div className="w-full mx-auto">
        <ChatHeader agent={agent} />
      </div>

      {/* Scrollable Messages */}
      <div className="w-full max-w-[800px] mx-auto overflow-y-auto">
        <div className="pt-16">
          <div
            ref={containerRef}
            className="pb-32"
          >
            {messages.length === 0 ? <Welcome agent={agent} /> : (
              <ChatMessages
                messages={messages}
                status={status as "streaming" | "submitted" | "ready" | "idle"}
                handlePickerSelect={handlePickerSelect}
              />
            )}
          </div>
        </div>
      </div>

      {/* Fixed Input */}
      <div className="w-full max-w-[800px] mx-auto bg-background">
        {error && (
          <div className="px-8 py-4 bg-destructive/10 text-destructive text-sm">
            An error occurred. Please try again.
          </div>
        )}
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
