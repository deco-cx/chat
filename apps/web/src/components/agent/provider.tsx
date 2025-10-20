import type { LanguageModelV2FinishReason } from "@ai-sdk/provider";
import type { UIMessage } from "@ai-sdk/react";
import { useChat } from "@ai-sdk/react";
import {
  AgentSchema,
  DECO_CMS_API_URL,
  DEFAULT_MODEL,
  Toolset,
  WELL_KNOWN_AGENTS,
  dispatchMessages,
  getTraceDebugId,
  useAgentData,
  useAgentRoot,
  useIntegrations,
  useThreadMessages,
  useThreads,
  useUpdateAgent,
  type Agent,
  type Integration,
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
  useRef,
  useState,
  type PropsWithChildren,
  type RefObject,
} from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useBlocker } from "react-router";
import { toast } from "sonner";
import { trackEvent } from "../../hooks/analytics.ts";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { notifyResourceUpdate } from "../../lib/broadcast-channels.ts";
import { dispatchRulesUpdated, onRulesUpdated } from "../../utils/events.ts";
import { IMAGE_REGEXP, openPreviewPanel } from "../chat/utils/preview.ts";

interface UiOptions {
  showThreadTools: boolean;
  showModelSelector: boolean;
  showThreadMessages: boolean;
  showAgentVisibility: boolean;
  showEditAgent: boolean;
  showContextResources: boolean;
}

interface AgentProviderProps {
  agentId: string;
  threadId: string;
  chatOverrides?: Partial<Agent>;
  initialInput?: string;
  initialMessages?: UIMessage[];
  chatOptions?: Record<string, unknown>; // Additional useChat options
  uiOptions?: Partial<UiOptions>; // UI configuration options
  children: React.ReactNode;
  additionalTools?: Agent["tools_set"];
  toolsets?: Toolset[];
  autoSend?: boolean;
  onAutoSendComplete?: () => void;
  initialRules?: string[];
  onToolCall?: (toolCall: { toolName: string }) => void;
  readOnly?: boolean;
}

interface AgentContextValue {
  // Current agent state
  agent: Agent;
  updateAgent: (updates: Partial<Agent>) => void;
  hasUnsavedChanges: boolean;

  // Available integrations for agent configuration
  installedIntegrations: Integration[];

  // UI configuration
  uiOptions: UiOptions;

  // Current rules
  rules: string[];
  setRules: (rules: string[]) => void;

  // Chat integration
  chat: ReturnType<typeof useChat> & {
    finishReason: LanguageModelV2FinishReason | null;
    sendMessage: (message?: UIMessage) => Promise<void>;
  };

  // Input state management
  input: string;
  setInput: (input: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Agent and chat context
  agentId: string;
  agentRoot: string;
  threadId: string;
  scrollRef: RefObject<HTMLDivElement | null>;
  setAutoScroll: (e: HTMLDivElement | null, enabled: boolean) => void;
  isAutoScrollEnabled: (e: HTMLDivElement | null) => boolean;
  retry: (context?: string[]) => void;
  select: (toolCallId: string, selectedValue: string) => Promise<void>;
  correlationIdRef: RefObject<string | null>;

  // Actions
  saveChanges: () => Promise<void>;
  discardChanges: () => void;

  // Form for legacy compatibility
  form: UseFormReturn<Agent>;
  handleSubmit: () => void;
  isPublic?: boolean;
  isReadOnly?: boolean;
}

const DEFAULT_UI_OPTIONS: UiOptions = {
  showThreadTools: true,
  showModelSelector: true,
  showThreadMessages: true,
  showAgentVisibility: true,
  showEditAgent: true,
  showContextResources: true,
};

const AgentContext = createContext<AgentContextValue | null>(null);

const setAutoScroll = (e: HTMLDivElement | null, enabled: boolean) => {
  if (!e) return;
  e.dataset.disableAutoScroll = enabled ? "false" : "true";
};

const isAutoScrollEnabled = (e: HTMLDivElement | null) => {
  return e?.dataset.disableAutoScroll !== "true";
};

export function AgentProvider({
  agentId,
  threadId,
  chatOverrides,
  initialInput,
  initialMessages,
  chatOptions,
  uiOptions,
  children,
  additionalTools,
  autoSend,
  onAutoSendComplete,
  initialRules,
  onToolCall: _onToolCall,
  readOnly = false,
}: PropsWithChildren<AgentProviderProps>) {
  const { data: serverAgent } = useAgentData(agentId);
  const isPublic = serverAgent.visibility === "PUBLIC";
  const { data: installedIntegrations } = useIntegrations({ isPublic });
  const updateAgentMutation = useUpdateAgent();
  const createAgent = useCreateAgent();
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();

  const [finishReason, setFinishReason] =
    useState<LanguageModelV2FinishReason | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const correlationIdRef = useRef<string | null>(null);
  const latestRulesRef = useRef<string[] | null>(initialRules || null);
  const [rules, setRulesState] = useState<string[]>(initialRules || []);
  const [input, setInput] = useState(initialInput || "");
  const [isLoading, setIsLoading] = useState(false);

  const mergedUiOptions = { ...DEFAULT_UI_OPTIONS, ...uiOptions };
  const { data: threads } = useThreads({
    enabled: mergedUiOptions.showThreadMessages,
  });
  const { data: { messages: threadMessages } = { messages: [] } } =
    useThreadMessages(threadId, {
      enabled: mergedUiOptions.showThreadMessages,
    });

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS],
  );

  // Subscribe to dynamic rules updates (for rule removal)
  useEffect(() => {
    const off = onRulesUpdated((ev) => {
      const newRules = ev.detail.rules ?? [];
      latestRulesRef.current = newRules;
      setRulesState(newRules);
    });
    return () => off();
  }, []);

  // Update rules when initialRules prop changes
  useEffect(() => {
    if (initialRules !== undefined) {
      latestRulesRef.current = initialRules;
      setRulesState(initialRules);
    }
  }, [initialRules]);

  const thread = useMemo(() => {
    return threads?.threads.find((t) => t.id === threadId);
  }, [threads, threadId]);

  // Merge additionalTools into serverAgent tools_set
  const mergedToolsSet = useMemo<Agent["tools_set"]>(() => {
    return {
      ...serverAgent.tools_set,
      ...additionalTools,
    };
  }, [serverAgent.tools_set, additionalTools]);

  useEffect(() => {
    form.setValue("tools_set", mergedToolsSet);
  }, [mergedToolsSet]);

  // Form state - for editing agent settings
  const form = useForm({
    defaultValues: { ...serverAgent, tools_set: mergedToolsSet },
    resolver: zodResolver(AgentSchema),
  });

  // Current agent state - form values
  const agent = form.watch();

  // Apply chat overrides to the current agent state
  const effectiveChatState = useMemo(
    () => ({
      ...agent,
      ...chatOverrides,
    }),
    [agent, chatOverrides],
  );

  const updateAgent = useCallback(
    (updates: Partial<Agent>) => {
      Object.entries(updates).forEach(([key, value]) => {
        form.setValue(key as keyof Agent, value, { shouldDirty: true });
      });
    },
    [form],
  );

  const saveChanges = useCallback(async () => {
    try {
      if (isWellKnownAgent) {
        const id = crypto.randomUUID();
        const newAgent = {
          ...agent,
          id,
          model: agent.model ?? DEFAULT_MODEL.id,
        };
        await createAgent(newAgent, {
          eventName: "agent_create_from_well_known",
        });
        const wellKnownAgent =
          WELL_KNOWN_AGENTS[agentId as keyof typeof WELL_KNOWN_AGENTS];
        form.reset(wellKnownAgent);
        return;
      }

      const updatedAgent = await updateAgentMutation.mutateAsync(
        agent as Agent,
      );
      form.reset(updatedAgent); // Reset form with server response
      toast.success("Agent updated successfully");
    } catch (error) {
      toast.error("Failed to update agent");
      throw error;
    }
  }, [
    agent,
    updateAgentMutation,
    createAgent,
    form,
    isWellKnownAgent,
    agentId,
  ]);

  const discardChanges = useCallback(() => {
    form.reset(serverAgent);
  }, [form, serverAgent]);

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

  // Initialize chat - always uses current agent state + overrides
  const chat = useChat({
    messages: initialMessages || threadMessages || [],
    id: threadId,
    transport,
    onFinish: (result) => {
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
      // Check if the last message has resource update tool calls
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
              import("../../lib/broadcast-channels.ts").then(
                ({ notifyResourceUpdate }) => {
                  notifyResourceUpdate(resourceUri);
                },
              );
            }
          }
        }
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
    },
    onToolCall: ({ toolCall }) => {
      _onToolCall?.(toolCall);

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
    ...chatOptions, // Allow passing any additional useChat options
  });

  const hasUnsavedChanges = form.formState.isDirty;
  const blocked = useBlocker(hasUnsavedChanges && !isWellKnownAgent);

  // Wrap sendMessage to enrich request metadata with all configuration
  const wrappedSendMessage = useCallback(
    (message?: UIMessage) => {
      // Early return if readOnly
      if (readOnly) {
        return Promise.resolve();
      }

      setAutoScroll(scrollRef.current, true);

      // If no message provided, send current input (form behavior)
      if (!message) {
        return chat.sendMessage?.();
      }

      // Handle programmatic message send with metadata
      // Convert rules to UIMessages for context (not persisted to thread)
      const context: UIMessage[] | undefined =
        rules && rules.length > 0
          ? rules.map((rule) => ({
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

      const metadata: MessageMetadata = {
        // Agent configuration
        model: mergedUiOptions.showModelSelector
          ? preferences.defaultModel
          : effectiveChatState.model,
        instructions: effectiveChatState.instructions,
        tools: effectiveChatState.tools_set,
        maxSteps: effectiveChatState.max_steps,
        temperature:
          effectiveChatState.temperature !== null
            ? effectiveChatState.temperature
            : undefined,
        lastMessages: effectiveChatState.memory?.last_messages,
        maxTokens:
          effectiveChatState.max_tokens !== null
            ? effectiveChatState.max_tokens
            : undefined,

        // User preferences
        bypassOpenRouter: !preferences.useOpenRouter,
        sendReasoning: preferences.sendReasoning ?? true,
        smoothStream:
          preferences.smoothStream !== false
            ? { delayInMs: 25, chunking: "word" }
            : undefined,

        // Thread info
        threadTitle: thread?.title,

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
      return chat.sendMessage?.(message, { metadata });
    },
    [
      mergedUiOptions.showModelSelector,
      preferences.defaultModel,
      preferences.useOpenRouter,
      preferences.sendReasoning,
      preferences.smoothStream,
      effectiveChatState.model,
      effectiveChatState.instructions,
      effectiveChatState.tools_set,
      effectiveChatState.max_steps,
      effectiveChatState.temperature,
      effectiveChatState.max_tokens,
      effectiveChatState.memory?.last_messages,
      thread?.title,
      rules,
      chat.sendMessage,
      readOnly,
    ],
  );

  const handlePickerSelect = async (
    _toolCallId: string,
    selectedValue: string,
  ) => {
    if (selectedValue) {
      await wrappedSendMessage({
        role: "user",
        id: crypto.randomUUID(),
        parts: [{ type: "text", text: selectedValue }],
      });
    }
  };

  const handleRetry = async (context?: string[]) => {
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
            .join(" ") ??
          lastUserMessage.parts
            ?.map((p) => (p.type === "text" ? p.text : ""))
            .join(" ") ??
          "");

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
  };

  const handleSubmitForm = form.handleSubmit(async (_data: Agent) => {
    await saveChanges();
  });

  function handleCancel() {
    blocked.reset?.();
  }

  function discardChangesBlocked() {
    form.reset();
    blocked.proceed?.();
  }

  // Auto-send initialInput when autoSend is true
  useEffect(() => {
    if (autoSend && input && chat.messages.length === 0 && !isLoading) {
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
    isLoading,
    onAutoSendComplete,
    wrappedSendMessage,
  ]);

  const contextValue: AgentContextValue = {
    agent: agent as Agent,
    updateAgent,
    hasUnsavedChanges,
    installedIntegrations:
      installedIntegrations?.filter((i) => !i.id.includes(agentId)) || [],
    uiOptions: mergedUiOptions,
    rules,
    setRules: (newRules: string[]) => {
      latestRulesRef.current = newRules;
      setRulesState(newRules);
      dispatchRulesUpdated({ rules: newRules });
    },
    chat: {
      ...chat,
      finishReason,
      sendMessage: wrappedSendMessage as typeof chat.sendMessage,
    },
    input,
    setInput,
    isLoading,
    setIsLoading,
    agentId,
    agentRoot,
    threadId,
    scrollRef,
    setAutoScroll,
    isAutoScrollEnabled,
    retry: handleRetry,
    select: handlePickerSelect,
    correlationIdRef,
    saveChanges,
    discardChanges,
    form: form as UseFormReturn<Agent>,
    handleSubmit: handleSubmitForm,
    isPublic,
  };

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

      <AgentContext.Provider value={contextValue}>
        {children}
      </AgentContext.Provider>
    </>
  );
}

// Main hook for the AgentProvider context
export const useAgent = () => {
  const context = useContext(AgentContext);
  if (!context) throw new Error("useAgent must be used within AgentProvider");
  return context;
};
