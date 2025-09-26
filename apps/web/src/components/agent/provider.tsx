import type { LanguageModelV1FinishReason } from "@ai-sdk/provider";
import { useChat } from "@ai-sdk/react";
import {
  type Agent,
  AgentSchema,
  DECO_CMS_API_URL,
  DEFAULT_MODEL,
  dispatchMessages,
  getTraceDebugId,
  type Integration,
  Toolset,
  useAgentData,
  useAgentRoot,
  useIntegrations,
  useThreadMessages,
  useThreads,
  useUpdateAgent,
  WELL_KNOWN_AGENTS,
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
import type { UIMessage } from "ai";
import {
  createContext,
  type PropsWithChildren,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { useBlocker } from "react-router";
import { toast } from "sonner";
import { trackEvent } from "../../hooks/analytics.ts";
import { onRulesUpdated, dispatchRulesUpdated } from "../../utils/events.ts";
import { useCreateAgent } from "../../hooks/use-create-agent.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
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
    finishReason: LanguageModelV1FinishReason | null;
  };

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
  toolsets,
  autoSend,
  onAutoSendComplete,
  initialRules,
}: PropsWithChildren<AgentProviderProps>) {
  const { data: serverAgent } = useAgentData(agentId);
  const isPublic = serverAgent.visibility === "PUBLIC";
  const { data: installedIntegrations } = useIntegrations({ isPublic });
  const updateAgentMutation = useUpdateAgent();
  const createAgent = useCreateAgent();
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();

  const [finishReason, setFinishReason] =
    useState<LanguageModelV1FinishReason | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const correlationIdRef = useRef<string | null>(null);
  const latestRulesRef = useRef<string[] | null>(initialRules || null);
  const [rules, setRulesState] = useState<string[]>(initialRules || []);

  const mergedUiOptions = { ...DEFAULT_UI_OPTIONS, ...uiOptions };
  const { data: threads } = useThreads({
    enabled: mergedUiOptions.showThreadMessages,
  });
  const { data: { messages: threadMessages } = { messages: [] } } =
    !mergedUiOptions.showThreadMessages
      ? { data: { messages: [] } }
      : useThreadMessages(threadId);

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

  const thread = useMemo(() => {
    return threads?.threads.find((t) => t.id === threadId);
  }, [threads, threadId]);

  // Merge additionalTools into serverAgent tools_set
  const mergedToolsSet = useMemo<Agent["tools_set"]>(() => {
    return {
      ...(serverAgent.tools_set ?? {}),
      ...(additionalTools ?? {}),
    };
  }, [serverAgent.tools_set, additionalTools]);

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

  // Initialize chat - always uses current agent state + overrides
  const chat = useChat({
    initialInput,
    initialMessages: initialMessages || threadMessages || [],
    credentials: "include",
    headers: {
      "x-deno-isolate-instance-id": agentRoot,
      "x-trace-debug-id": getTraceDebugId(),
    },
    api: new URL("/actors/AIAgent/invoke/stream", DECO_CMS_API_URL).href,
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

      // Collect persisted rules from latest state provided via events
      const rules = latestRulesRef.current;

      // Merge rules into annotations on the outgoing message so we send a single
      // message with annotations (files + rules) instead of separate system messages
      if (lastMessage) {
        lastMessage.annotations = [
          ...(lastMessage?.annotations ?? []),
          ...(rules?.map((r) => ({ role: "system", content: r })) ?? []),
        ].filter(Boolean);
      }

      return {
        metadata: { threadId: threadId ?? agentId },
        args: [
          [lastMessage],
          {
            model: mergedUiOptions.showModelSelector
              ? preferences.defaultModel
              : effectiveChatState.model,
            instructions: effectiveChatState.instructions,
            bypassOpenRouter,
            sendReasoning: preferences.sendReasoning ?? true,
            threadTitle: thread?.title,
            tools: effectiveChatState.tools_set,
            maxSteps: effectiveChatState.max_steps,
            pdfSummarization: preferences.pdfSummarization ?? true,
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
    ...chatOptions, // Allow passing any additional useChat options
  });

  const hasUnsavedChanges = form.formState.isDirty;
  const blocked = useBlocker(hasUnsavedChanges && !isWellKnownAgent);

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

  const handleSubmitForm = form.handleSubmit(async (_data: Agent) => {
    await saveChanges();
  });

  const handleSubmitChat: typeof chat.handleSubmit = (e, options) => {
    chat.handleSubmit(e, options);
    setAutoScroll(scrollRef.current, true);
  };

  function handleCancel() {
    blocked.reset?.();
  }

  function discardChangesBlocked() {
    form.reset();
    blocked.proceed?.();
  }

  // Auto-send initialInput when autoSend is true
  useEffect(() => {
    if (
      autoSend &&
      initialInput &&
      chat.messages.length === 0 &&
      !chat.isLoading
    ) {
      chat.handleSubmit(new Event("submit"));
      setAutoScroll(scrollRef.current, true);
      onAutoSendComplete?.();
    }
  }, []);

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
      handleSubmit: handleSubmitChat,
    },
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
