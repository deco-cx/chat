import type { LanguageModelV2FinishReason } from "@ai-sdk/provider";
import type { UIMessage } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import {
  AgentSchema,
  DECO_CMS_API_URL,
  dispatchMessages,
  getTraceDebugId,
  WELL_KNOWN_AGENTS,
  type Agent,
  type MessageMetadata,
} from "@deco/sdk";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@deco/ui/components/alert-dialog.tsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { DefaultChatTransport } from "ai";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useBlocker } from "react-router";
import { toast } from "sonner";
import { z } from "zod";
import { trackEvent } from "../../hooks/analytics.ts";
import { useTriggerToolCallListeners } from "../../hooks/use-tool-call-listener.ts";
import { notifyResourceUpdate } from "../../lib/broadcast-channels.ts";
import { useThreadContext } from "../decopilot/thread-context-provider.tsx";
import { IMAGE_REGEXP, openPreviewPanel } from "../chat/utils/preview.ts";

interface UiOptions {
  showThreadTools: boolean;
  showModelSelector: boolean;
  showThreadMessages: boolean;
  showAgentVisibility: boolean;
  showEditAgent: boolean;
  showContextResources: boolean;
  readOnly: boolean;
}

export interface AgenticChatProviderProps {
  // Agent config
  agentId: string;
  threadId: string;
  agent: Agent; // Required agent data
  agentRoot: string; // Required agent root path
  onSave?: (agent: Agent) => Promise<void>;

  // Chat options
  initialMessages?: UIMessage[];
  initialInput?: string;
  autoSend?: boolean;
  onAutoSendComplete?: () => void;

  // User preferences
  model?: string;
  useOpenRouter?: boolean;
  sendReasoning?: boolean;

  // UI options
  uiOptions?: Partial<UiOptions>;

  children: React.ReactNode;
}

export interface AgenticChatContextValue {
  agent: z.infer<typeof AgentSchema>;
  isDirty: boolean;
  updateAgent: (updates: Partial<Agent>) => void;
  saveAgent: () => Promise<void>;
  resetAgent: () => void;

  // Form state (for settings components)
  form: UseFormReturn<Agent>;

  // Chat state
  chat: ReturnType<typeof useChat>;
  finishReason: LanguageModelV2FinishReason | null;
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;

  // Chat methods
  sendMessage: (message?: UIMessage) => Promise<void>;
  retry: (context?: string[]) => Promise<void>;

  // UI options
  uiOptions: UiOptions;

  // Metadata
  metadata: {
    agentId: string;
    threadId: string;
    agentRoot: string;
  };

  // Refs
  scrollRef: RefObject<HTMLDivElement | null>;
  correlationIdRef: RefObject<string | null>;
}

const DEFAULT_UI_OPTIONS: UiOptions = {
  showThreadTools: true,
  showModelSelector: true,
  showThreadMessages: true,
  showAgentVisibility: true,
  showEditAgent: true,
  showContextResources: true,
  readOnly: false,
};

// Unified chat state
interface ChatState {
  finishReason: LanguageModelV2FinishReason | null;
  isLoading: boolean;
  input: string;
}

type ChatStateAction =
  | {
      type: "SET_FINISH_REASON";
      finishReason: LanguageModelV2FinishReason | null;
    }
  | { type: "SET_IS_LOADING"; isLoading: boolean }
  | { type: "SET_INPUT"; input: string };

function chatStateReducer(
  state: ChatState,
  action: ChatStateAction,
): ChatState {
  switch (action.type) {
    case "SET_FINISH_REASON":
      return { ...state, finishReason: action.finishReason };
    case "SET_IS_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "SET_INPUT":
      return { ...state, input: action.input };
    default:
      return state;
  }
}

export const AgenticChatContext = createContext<AgenticChatContextValue | null>(
  null,
);

export function AgenticChatProvider({
  agentId,
  threadId,
  agent: initialAgent,
  agentRoot,
  onSave,
  initialMessages,
  initialInput,
  autoSend,
  onAutoSendComplete,
  model: defaultModel,
  useOpenRouter,
  sendReasoning,
  uiOptions,
  children,
}: PropsWithChildren<AgenticChatProviderProps>) {
  const { contextItems: threadContextItems } = useThreadContext();
  const triggerToolCallListeners = useTriggerToolCallListeners();

  const [state, dispatch] = useReducer(chatStateReducer, {
    finishReason: null,
    isLoading: false,
    input: initialInput || "",
  });

  const { finishReason, isLoading, input } = state;

  const setIsLoading = useCallback((value: boolean) => {
    dispatch({ type: "SET_IS_LOADING", isLoading: value });
  }, []);

  const setFinishReason = useCallback(
    (value: LanguageModelV2FinishReason | null) => {
      dispatch({ type: "SET_FINISH_REASON", finishReason: value });
    },
    [],
  );

  const setInput = useCallback((value: string) => {
    dispatch({ type: "SET_INPUT", input: value });
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  const correlationIdRef = useRef<string | null>(null);

  const mergedUiOptions = { ...DEFAULT_UI_OPTIONS, ...uiOptions };

  // Form state - for editing agent settings
  const form = useForm({
    defaultValues: initialAgent,
    resolver: zodResolver(AgentSchema),
  });

  // Current agent state - form values
  const agent = form.watch();

  const updateAgent = useCallback(
    (updates: Partial<Agent>) => {
      Object.entries(updates).forEach(([key, value]) => {
        form.setValue(key as keyof Agent, value, { shouldDirty: true });
      });
    },
    [form],
  );

  const saveAgent = useCallback(async () => {
    if (!onSave) {
      toast.error("No save handler provided");
      return;
    }

    try {
      await onSave(agent as Agent);
      form.reset(agent); // Reset form with current values to clear dirty state
    } catch (error) {
      toast.error("Failed to save agent");
      throw error;
    }
  }, [agent, onSave, form]);

  const resetAgent = useCallback(() => {
    form.reset(initialAgent);
  }, [form, initialAgent]);

  // Memoize the transport to prevent unnecessary re-creation
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: new URL("/actors/AIAgent/invoke/stream", DECO_CMS_API_URL).href,
        credentials: "include",
        headers: {
          "x-deno-isolate-instance-id": agentRoot,
          "x-trace-debug-id": getTraceDebugId(),
        },
        prepareSendMessagesRequest: ({
          messages,
          requestMetadata,
        }: {
          messages: UIMessage[];
          requestMetadata?: unknown;
        }) => ({
          body: {
            metadata: { threadId: threadId ?? agentId },
            args: [messages.slice(-1), requestMetadata],
          },
        }),
      }),
    [agentRoot, threadId, agentId],
  );

  // Initialize chat
  const chat = useChat({
    messages: initialMessages || [],
    id: threadId,
    transport,
    onFinish: (result) => {
      setIsLoading(false);

      const metadata = result?.message?.metadata as
        | { finishReason: LanguageModelV2FinishReason }
        | undefined;

      // Read finish reason from metadata attached by the backend
      const finishReason = metadata?.finishReason;

      const isCancelled =
        result.isAbort || result.isDisconnect || result.isError;

      // Only set finish reason if it's one we care about displaying
      if (
        !isCancelled &&
        (finishReason === "length" || finishReason === "tool-calls")
      ) {
        setFinishReason(finishReason);
      } else {
        setFinishReason(null);
      }

      // Broadcast resource updates when assistant message completes
      if (result?.message?.role === "assistant" && result.message.parts) {
        for (const part of result.message.parts) {
          if (
            part.type.startsWith("tool-") &&
            "toolName" in part &&
            part.toolName?.includes("_UPDATE") &&
            part.toolName?.startsWith("DECO_RESOURCE_") &&
            "input" in part &&
            part.input &&
            typeof part.input === "object"
          ) {
            const input = part.input as Record<string, unknown>;
            const resourceUri = input.uri || input.resource;

            if (typeof resourceUri === "string") {
              notifyResourceUpdate(resourceUri);
            }
          }
        }
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setIsLoading(false);
      setFinishReason(null);
    },
    onToolCall: ({ toolCall }) => {
      // Trigger all registered tool call listeners
      triggerToolCallListeners(toolCall);

      // Handle RENDER tool
      if (toolCall.toolName === "RENDER") {
        const { content, title } = (toolCall.input ?? {}) as {
          content?: string;
          title?: string;
        };

        const isImageLike = content && IMAGE_REGEXP.test(content);

        if (!isImageLike) {
          openPreviewPanel(
            `preview-${toolCall.toolCallId}`,
            content || "",
            title || "",
          );
        }
      }

      // Broadcast resource updates for auto-refresh
      if (
        /^DECO_RESOURCE_.*_(UPDATE|CREATE)$/.test(toolCall.toolName ?? "") &&
        toolCall.input &&
        typeof toolCall.input === "object" &&
        "uri" in toolCall.input &&
        typeof toolCall.input.uri === "string"
      ) {
        notifyResourceUpdate(toolCall.input.uri);
      }
    },
  });

  // Track unsaved changes for UI
  const hasUnsavedChanges = form.formState.isDirty;

  // Don't block navigation for well-known agents (they create new agents on save)
  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );
  const shouldBlockNavigation = hasUnsavedChanges && !isWellKnownAgent;
  const blocked = useBlocker(shouldBlockNavigation);

  // Wrap sendMessage to enrich request metadata with all configuration
  const wrappedSendMessage = useCallback(
    (message?: UIMessage) => {
      // Early return if readOnly
      if (mergedUiOptions.readOnly) {
        return Promise.resolve();
      }

      // Set loading state
      setIsLoading(true);

      // If no message provided, send current input (form behavior)
      if (!message) {
        return chat.sendMessage?.() ?? Promise.resolve();
      }

      // Handle programmatic message send with metadata
      // Extract rules and tools from context items
      const contextItems = threadContextItems;

      // Extract rules from context items and convert to UIMessages for context (not persisted to thread)
      const rulesFromContextItems = contextItems
        .filter((item) => item.type === "rule")
        .map((item) => (item as { text: string }).text);

      const context: UIMessage[] | undefined =
        rulesFromContextItems && rulesFromContextItems.length > 0
          ? rulesFromContextItems.map((rule) => ({
              id: crypto.randomUUID(),
              role: "system" as const,
              parts: [
                {
                  type: "text" as const,
                  text: rule,
                },
              ],
            }))
          : undefined;

      // Extract toolsets from context items
      const toolsFromContextItems = contextItems
        .filter((item) => item.type === "toolset")
        .reduce(
          (acc, item) => {
            const toolset = item as {
              integrationId: string;
              enabledTools: string[];
            };
            acc[toolset.integrationId] = toolset.enabledTools;
            return acc;
          },
          {} as Agent["tools_set"],
        );

      const metadata: MessageMetadata = {
        // Agent configuration
        model: mergedUiOptions.showModelSelector ? defaultModel : agent.model,
        instructions: agent.instructions,
        tools: { ...agent.tools_set, ...toolsFromContextItems },
        maxSteps: agent.max_steps,
        temperature: agent.temperature !== null ? agent.temperature : undefined,
        lastMessages: agent.memory?.last_messages,
        maxTokens: agent.max_tokens !== null ? agent.max_tokens : undefined,

        // User preferences
        bypassOpenRouter: !useOpenRouter,
        sendReasoning: sendReasoning ?? true,

        // Context messages (additional context not persisted to thread)
        context: context,
      };

      // Dispatch messages to track them
      dispatchMessages({
        messages: [message],
        threadId: threadId,
        agentId: agentId,
      });

      // Send message with metadata in options
      return chat.sendMessage?.(message, { metadata }) ?? Promise.resolve();
    },
    [
      mergedUiOptions.readOnly,
      mergedUiOptions.showModelSelector,
      defaultModel,
      useOpenRouter,
      sendReasoning,
      agent.model,
      agent.instructions,
      agent.tools_set,
      agent.max_steps,
      agent.temperature,
      agent.max_tokens,
      agent.memory?.last_messages,
      chat.sendMessage,
      threadId,
      agentId,
      setIsLoading,
      threadContextItems,
    ],
  );

  const handleRetry = useCallback(
    async (context?: string[]) => {
      const lastUserMessage = chat.messages.findLast(
        (msg) => msg.role === "user",
      );

      if (!lastUserMessage) return;

      const lastText =
        "content" in lastUserMessage &&
        typeof lastUserMessage.content === "string"
          ? lastUserMessage.content
          : (lastUserMessage.parts
              ?.map((p) => (p.type === "text" ? p.text : ""))
              .join(" ") ?? "");

      await wrappedSendMessage({
        role: "user",
        id: crypto.randomUUID(),
        parts: [
          { type: "text", text: lastText },
          ...(context?.map((c) => ({ type: "text" as const, text: c })) || []),
        ],
      });

      trackEvent("chat_retry", {
        data: { agentId, threadId, lastUserMessage: lastText },
      });
    },
    [chat.messages, wrappedSendMessage, agentId, threadId],
  );

  // Auto-send initialInput when autoSend is true
  useEffect(() => {
    if (autoSend && input && chat.messages.length === 0) {
      wrappedSendMessage({
        role: "user",
        id: crypto.randomUUID(),
        parts: [{ type: "text", text: input }],
      });
      onAutoSendComplete?.();
    }
  }, [
    autoSend,
    input,
    chat.messages.length,
    onAutoSendComplete,
    wrappedSendMessage,
  ]);

  const contextValue: AgenticChatContextValue = {
    agent: agent as Agent,
    isDirty: hasUnsavedChanges,
    updateAgent,
    saveAgent,
    resetAgent,

    // Form state
    form: form as UseFormReturn<Agent>,

    // Chat state
    chat,
    finishReason,
    input,
    setInput,
    isLoading,

    // Chat methods
    sendMessage: wrappedSendMessage,
    retry: handleRetry,

    // UI options
    uiOptions: mergedUiOptions,

    // Metadata
    metadata: {
      agentId,
      threadId,
      agentRoot,
    },

    // Refs
    scrollRef,
    correlationIdRef,
  };

  function handleCancel() {
    blocked.reset?.();
  }

  function discardChangesBlocked() {
    form.reset();
    blocked.proceed?.();
  }

  return (
    <>
      <AlertDialog open={blocked.state === "blocked"}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. If you leave this page, your edits will
              be lost. Are you sure you want to discard your changes and
              navigate away?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={discardChangesBlocked}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AgenticChatContext.Provider value={contextValue}>
        {children}
      </AgenticChatContext.Provider>
    </>
  );
}

// Main hook for the AgenticChatProvider context
export function useAgenticChat() {
  const context = useContext(AgenticChatContext);
  if (!context) {
    throw new Error("useAgenticChat must be used within AgenticChatProvider");
  }
  return context;
}
