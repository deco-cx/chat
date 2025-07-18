import type { LanguageModelV1FinishReason } from "@ai-sdk/provider";
import { useChat } from "@ai-sdk/react";
import {
  DECO_CHAT_API,
  dispatchMessages,
  getTraceDebugId,
  useAgent,
  useAgentRoot,
  useThreadMessages,
} from "@deco/sdk";
import {
  createContext,
  type PropsWithChildren,
  type RefObject,
  useContext,
  useRef,
  useState,
} from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { IMAGE_REGEXP, openPreviewPanel } from "./utils/preview.ts";
import type { Toolset } from "@deco/ai";

const setAutoScroll = (e: HTMLDivElement | null, enabled: boolean) => {
  if (!e) return;

  e.dataset.disableAutoScroll = enabled ? "false" : "true";
};

const isAutoScrollEnabled = (e: HTMLDivElement | null) => {
  return e?.dataset.disableAutoScroll !== "true";
};

type IContext = {
  chat: ReturnType<typeof useChat> & {
    finishReason: LanguageModelV1FinishReason | null;
  };
  agentId: string;
  agentRoot: string;
  threadId: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  setAutoScroll: (e: HTMLDivElement | null, enabled: boolean) => void;
  isAutoScrollEnabled: (e: HTMLDivElement | null) => boolean;
  retry: (context?: string[]) => void;
  select: (toolCallId: string, selectedValue: string) => Promise<void>;
  correlationIdRef: RefObject<string | null>;
  uiOptions: {
    showThreadTools: boolean;
    showModelSelector: boolean;
    showThreadMessages: boolean;
    showAgentVisibility: boolean;
    showEditAgent: boolean;
  };
};

const Context = createContext<IContext | null>(null);

interface Props {
  agentId: string;
  threadId: string;
  initialInput?: string;
  uiOptions?: Partial<IContext["uiOptions"]>;
  toolsets?: Toolset[];
}

const DEFAULT_UI_OPTIONS: IContext["uiOptions"] = {
  showModelSelector: true,
  showThreadTools: true,
  showThreadMessages: true,
  showAgentVisibility: true,
  showEditAgent: true,
};

export function ChatProvider({
  agentId,
  threadId,
  uiOptions,
  initialInput,
  children,
  toolsets,
}: PropsWithChildren<Props>) {
  const [finishReason, setFinishReason] =
    useState<LanguageModelV1FinishReason | null>(null);
  const agentRoot = useAgentRoot(agentId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const options = { ...DEFAULT_UI_OPTIONS, ...uiOptions };
  const { data: initialMessages } = !options.showThreadMessages
    ? { data: undefined }
    : useThreadMessages(threadId);

  const { preferences } = useUserPreferences();
  const { data: agent } = useAgent(agentId);

  const correlationIdRef = useRef<string | null>(null);

  const chat = useChat({
    initialInput,
    initialMessages: initialMessages || [],
    credentials: "include",
    headers: {
      "x-deno-isolate-instance-id": agentRoot,
      "x-trace-debug-id": getTraceDebugId(),
    },
    api: new URL("/actors/AIAgent/invoke/stream", DECO_CHAT_API).href,
    experimental_prepareRequestBody: ({ messages }) => {
      dispatchMessages({ messages, threadId, agentId });
      const lastMessage = messages.at(-1);

      /** Add annotation so we can use the file URL as a parameter to a tool call */
      if (lastMessage) {
        lastMessage.annotations =
          lastMessage?.["experimental_attachments"]?.map((attachment) => ({
            type: "file",
            url: attachment.url,
            name: attachment.name ?? "unknown file",
            contentType: attachment.contentType ?? "unknown content type",
            content:
              "This message refers to a file uploaded by the user. You might use the file URL as a parameter to a tool call.",
          })) || lastMessage?.annotations;
      }

      const bypassOpenRouter = !preferences.useOpenRouter;

      return {
        metadata: { threadId: threadId ?? agentId },
        args: [
          [lastMessage],
          {
            model: options.showModelSelector // use the agent model if selector is not shown on the UI
              ? preferences.defaultModel
              : agent?.model,
            instructions: agent?.instructions,
            bypassOpenRouter,
            sendReasoning: preferences.sendReasoning ?? true,
            tools: agent?.tools_set,
            maxSteps: agent?.max_steps,
            toolsets,
            smoothStream:
              preferences.smoothStream !== false
                ? { delayInMs: 25, chunk: "word" }
                : undefined,
          },
        ],
      };
    },
    onFinish: (_result, { finishReason }) => {
      setFinishReason(finishReason);
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onToolCall: ({ toolCall }) => {
      if (toolCall.toolName === "RENDER") {
        const { content, title } = toolCall.args as {
          content: string;
          title: string;
        };

        const isImageLike = content && IMAGE_REGEXP.test(content);

        if (!isImageLike) {
          openPreviewPanel(`preview-${toolCall.toolCallId}`, content, title);
        }

        return {
          success: true,
        };
      }
    },
    onResponse: (response) => {
      correlationIdRef.current = response.headers.get("x-trace-debug-id");
    },
  });

  const handlePickerSelect = async (
    toolCallId: string,
    selectedValue: string,
  ) => {
    if (selectedValue) {
      chat.setMessages((prevMessages) =>
        prevMessages.map((msg) => ({
          ...msg,
          toolInvocations: msg.toolInvocations?.filter(
            (tool) => tool.toolCallId !== toolCallId,
          ),
        })),
      );

      await chat.append({ role: "user", content: selectedValue });
    }
  };

  const handleRetry = async (context?: string[]) => {
    const lastUserMessage = chat.messages.findLast(
      (msg) => msg.role === "user",
    );

    if (!lastUserMessage) return;

    await chat.append({
      content: lastUserMessage.content,
      role: "user",
      annotations: context || [],
    });

    trackEvent("chat_retry", {
      data: { agentId, threadId, lastUserMessage: lastUserMessage.content },
    });
  };

  const handleSubmit: typeof chat.handleSubmit = (e, options) => {
    chat.handleSubmit(e, options);
    setAutoScroll(scrollRef.current, true);
  };

  return (
    <Context.Provider
      value={{
        agentId,
        threadId,
        agentRoot,
        chat: {
          ...chat,
          finishReason,
          handleSubmit: handleSubmit,
        },
        scrollRef,
        uiOptions: options,
        setAutoScroll,
        isAutoScrollEnabled,
        retry: handleRetry,
        select: handlePickerSelect,
        correlationIdRef,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const useChatContext = () => {
  const context = useContext(Context);

  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }

  return context;
};
