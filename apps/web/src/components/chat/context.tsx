import { CreateMessage, useChat } from "@ai-sdk/react";
import {
  API_SERVER_URL,
  getTraceDebugId,
  useAddOptimisticThread,
  useAgent,
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
  useState,
} from "react";
import { trackEvent } from "../../hooks/analytics.ts";
import { useUserPreferences } from "../../hooks/useUserPreferences.ts";
import { MentionItem } from "./extensions/Mention.ts";
import { IMAGE_REGEXP, openPreviewPanel } from "./utils/preview.ts";
import { useAllIntegrationTools } from "../../hooks/useAllIntegrationTools.ts";

const LAST_MESSAGES_COUNT = 10;
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
  setMentions: (tools: MentionItem[] | null) => void;
};

const Context = createContext<IContext | null>(null);

interface Props {
  agentId: string;
  threadId: string;
  /** Default initial thread message */
  initialMessage?: CreateMessage;
  uiOptions?: Partial<IContext["uiOptions"]>;
}

const THREAD_TOOLS_INVALIDATION_TOOL_CALL = new Set([
  "DECO_INTEGRATION_INSTALL",
  "DECO_INTEGRATION_ENABLE",
  "DECO_INTEGRATION_DISABLE",
  "DECO_AGENT_CONFIGURE",
]);

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
  initialMessage,
  children,
  uiOptions,
}: PropsWithChildren<Props>) {
  const agentRoot = useAgentRoot(agentId);
  const invalidateAll = useInvalidateAll();
  const [mentions, setMentions] = useState<MentionItem[] | null>(null);
  const {
    addOptimisticThread,
  } = useAddOptimisticThread();
  const scrollRef = useRef<HTMLDivElement>(null);
  const onceRef = useRef(false);
  const options = { ...DEFAULT_UI_OPTIONS, ...uiOptions };
  const { data: initialMessages } = !options.showThreadMessages
    ? { data: undefined }
    : useThreadMessages(threadId);

  const { preferences } = useUserPreferences();
  const { data: agent } = useAgent(agentId);

  const correlationIdRef = useRef<string | null>(null);

  const { toolsMap } = useAllIntegrationTools();

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

      const messagesWindow = messages.slice(-LAST_MESSAGES_COUNT);
      const lastMessage = messagesWindow.at(-1);

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
      const integrations = mentions?.map((integration) => integration.id);

      const filteredToolsMap = Object.fromEntries(
        Object.entries(toolsMap)
          .filter(([key]) => integrations?.includes(key))
          .map(([key, tools]) => [
            key,
            Object.fromEntries(tools.map((tool) => [tool.name, tool])),
          ]),
      );

      console.log("filteredToolsMap", filteredToolsMap);

      return {
        args: [messagesWindow, {
          model: options.showModelSelector // use the agent model if selector is not shown on the UI
            ? preferences.defaultModel
            : agent?.model,
          instructions: agent?.instructions,
          bypassOpenRouter,
          lastMessages: 0,
          sendReasoning: true,
          tools: filteredToolsMap,
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
    chat.handleSubmit(e, options);
    setAutoScroll(scrollRef.current, true);
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
        uiOptions: options,
        setAutoScroll,
        isAutoScrollEnabled,
        retry: handleRetry,
        select: handlePickerSelect,
        correlationIdRef,
        setMentions,
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
