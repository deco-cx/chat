import { CreateMessage, useChat } from "@ai-sdk/react";
import {
  API_SERVER_URL,
  useAddOptimisticThread,
  useAgentRoot,
  useInvalidateAll,
  useThreadMessages,
} from "@deco/sdk";
import {
  createContext,
  PropsWithChildren,
  RefObject,
  useContext,
  useEffect,
  useRef,
} from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { getAgentOverrides } from "../../hooks/useAgentOverrides.ts";
import { useUserPreferences } from "../../hooks/useUserPreferences.ts";
import { IMAGE_REGEXP, openPreviewPanel } from "./utils/preview.ts";
import { getTraceDebugId } from "@deco/sdk";

const LAST_MESSAGES_COUNT = 10;
const MAX_TOKENS = 200000;
interface FileData {
  name: string;
  contentType: string;
  url: string;
}

const setAutoScroll = (e: HTMLDivElement | null, enabled: boolean) => {
  if (!e) return;

  e.dataset.disableAutoScroll = enabled ? "false" : "true";
};

const isAutoScrollEnabled = (e: HTMLDivElement | null) => {
  return e?.dataset.disableAutoScroll !== "true";
};

type IContext = {
  chat: ReturnType<typeof useChat>;
  agentId: string;
  agentRoot: string;
  threadId: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  fileDataRef: RefObject<FileData[]>;
  uiOptions?: {
    showThreadTools?: boolean;
  };
  setAutoScroll: (e: HTMLDivElement | null, enabled: boolean) => void;
  isAutoScrollEnabled: (e: HTMLDivElement | null) => boolean;
  retry: (context?: string[]) => void;
  select: (toolCallId: string, selectedValue: string) => Promise<void>;
  correlationIdRef: RefObject<string | null>;
};

const Context = createContext<IContext | null>(null);

interface Props {
  agentId: string;
  threadId: string;
  /** Default initial thread message */
  initialMessage?: CreateMessage;
  /** Disable thread messages */
  disableThreadMessages?: boolean;
  uiOptions?: {
    showThreadTools?: boolean;
  };
}

const THREAD_TOOLS_INVALIDATION_TOOL_CALL = new Set([
  "DECO_INTEGRATION_INSTALL",
  "DECO_INTEGRATION_ENABLE",
  "DECO_INTEGRATION_DISABLE",
  "DECO_AGENT_CONFIGURE",
]);

export function ChatProvider({
  agentId,
  threadId,
  initialMessage,
  children,
  disableThreadMessages,
  uiOptions,
}: PropsWithChildren<Props>) {
  const agentRoot = useAgentRoot(agentId);
  const invalidateAll = useInvalidateAll();
  const {
    addOptimisticThread,
  } = useAddOptimisticThread();
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileDataRef = useRef<FileData[]>([]);
  const onceRef = useRef(false);
  const { data: initialMessages } = disableThreadMessages
    ? { data: undefined }
    : useThreadMessages(threadId);

  const { preferences } = useUserPreferences();

  const correlationIdRef = useRef<string | null>(null);

  const chat = useChat({
    initialMessages: initialMessages || [],
    credentials: "include",
    headers: {
      "x-deno-isolate-instance-id": agentRoot,
      "x-trace-debug-id": getTraceDebugId(),
    },
    api: new URL("/actors/AIAgent/invoke/stream", API_SERVER_URL).href,
    experimental_prepareRequestBody: ({ messages }) => {
      if (messages.length === 1 && messages[0].role === "user") {
        addOptimisticThread(threadId, agentId);
      }

      const files = fileDataRef.current;
      const allMessages = (messages as CreateMessage[]).slice(
        -LAST_MESSAGES_COUNT,
      ).filter((msg, i, arr) => {
        const isLast = i === arr.length - 1;
        const isTooLong =
          JSON.stringify({ parts: msg.parts, content: msg.content }).length >
            MAX_TOKENS;
        return isLast || !isTooLong;
      });
      const last = allMessages.at(-1);
      const annotations = files && files.length > 0
        ? [
          files.map((file: FileData) => ({
            type: "file",
            url: file.url,
            name: file.name,
            contentType: file.contentType,
            content:
              "This message refers to a file uploaded by the user. You might use the file URL as a parameter to a tool call.",
          })),
        ]
        : last?.annotations || [];
      if (last) {
        last.annotations = annotations;
      }
      const bypassOpenRouter = !preferences.useOpenRouter;

      const overrides = getAgentOverrides(agentId);
      return {
        args: [allMessages, {
          model: preferences.defaultModel,
          instructions: overrides?.instructions,
          bypassOpenRouter,
          lastMessages: 0,
          sendReasoning: true,
          smoothStream: {
            delayInMs: 20,
            chunk: "word",
          },
        }],
        metadata: { threadId: threadId ?? agentId },
      };
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
          openPreviewPanel(
            `preview-${toolCall.toolCallId}`,
            content,
            title,
          );
        }

        return {
          success: true,
        };
      }
    },
    onResponse: (response) => {
      correlationIdRef.current = response.headers.get("x-trace-debug-id");
    },
    onFinish: (message) => {
      const shouldInvalidate = message.toolInvocations?.some((tool) =>
        THREAD_TOOLS_INVALIDATION_TOOL_CALL.has(tool.toolName)
      );

      if (shouldInvalidate) {
        invalidateAll();
      }
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
        }))
      );

      await chat.append({ role: "user", content: selectedValue });
    }
  };

  const handleRetry = async (context?: string[]) => {
    const lastUserMessage = chat.messages.findLast((msg) =>
      msg.role === "user"
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
    // deno-lint-ignore no-explicit-any
    const opts: any = options;
    if (opts?.fileData && opts.fileData.length > 0) {
      fileDataRef.current = opts.fileData;
    } else {
      fileDataRef.current = [];
    }

    chat.handleSubmit(e, options);

    setAutoScroll(scrollRef.current, true);

    // the timeout is absolutely necessary trust me do not question do not remove just accept it
    setTimeout(() => {
      fileDataRef.current = [];
    }, 1000);
  };

  useEffect(() => {
    if (
      chat.messages.length === 0 && initialMessage &&
      !onceRef.current
    ) {
      onceRef.current = true;
      chat.append(initialMessage);
    }
  }, [initialMessage, chat.messages]);

  return (
    <Context.Provider
      value={{
        agentId,
        threadId,
        agentRoot,
        chat: { ...chat, handleSubmit: handleSubmit },
        scrollRef,
        fileDataRef,
        uiOptions: uiOptions,
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
