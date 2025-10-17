import {
  NotFoundError,
  WELL_KNOWN_AGENTS,
  useAgentData,
  useAgentRoot,
  useFile,
  useRecentResources,
  useSDK,
  useThreadMessages,
  useUpdateAgent,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@deco/ui/components/resizable.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@deco/ui/components/tabs.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  Suspense,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useParams } from "react-router";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { isFilePath } from "../../utils/path.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgentAvatar } from "../common/avatar/agent.tsx";
import { useDecopilotContext } from "../decopilot/context.tsx";
import { useDecopilotThread } from "../decopilot/thread-context.tsx";
import { useAppAdditionalTools } from "../decopilot/use-app-additional-tools.ts";
import { DecopilotLayout } from "../layout/decopilot-layout.tsx";
import AdvancedTab from "../settings/advanced.tsx";
import AgentProfileTab from "../settings/agent-profile.tsx";
import ToolsAndKnowledgeTab from "../settings/integrations.tsx";
import { AgentTriggers } from "../triggers/agent-triggers.tsx";
import { AgenticChatProvider, useAgenticChat } from "../chat/provider.tsx";
import Threads from "./threads.tsx";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Agent } from "@deco/sdk";

interface Props {
  agentId?: string;
  threadId?: string;
}

// Context for managing preview visibility on mobile and chat mode
interface PreviewContextValue {
  showPreview: boolean;
  togglePreview: () => void;
  isMobile: boolean;
  chatMode: "agent" | "decopilot";
  setChatMode: (mode: "agent" | "decopilot") => void;
}

const PreviewContext = createContext<PreviewContextValue | undefined>(
  undefined,
);

function usePreviewContext() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error("usePreviewContext must be used within PreviewProvider");
  }
  return context;
}

function ThreadsButton() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="size-8">
          <Icon name="history" size={16} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <Suspense
          fallback={
            <div className="px-12 py-20 grid place-items-center">
              <Spinner size="sm" />
            </div>
          }
        >
          <Threads />
        </Suspense>
      </PopoverContent>
    </Popover>
  );
}

// Unified chat interface that works for both agent and decopilot modes
function UnifiedChat() {
  const { metadata: { agentId }, chat, agent, isDirty: hasChanges } = useAgenticChat();
  const client = useQueryClient();
  const { locator } = useSDK();
  const { messages } = chat;
  const focusChat = useFocusChat();
  const { chatMode } = usePreviewContext();
  const isEmpty = messages.length === 0;
  // Decopilot mode doesn't show threads or new thread buttons
  const isDecopilotMode = chatMode === "decopilot";
  const showNewThread = !isDecopilotMode && !isEmpty && !hasChanges;
  const showThreadsButton = !isDecopilotMode;

  return (
    <div className="flex flex-col h-full min-w-[320px] bg-sidebar relative">
      <div className="flex-none p-4 relative">
        <div className="justify-self-start flex items-center gap-3 text-muted-foreground w-full">
          <div
            className={cn(
              "flex items-center gap-2 w-full pr-24",
              isEmpty ? "hidden" : "",
            )}
          >
            <AgentAvatar url={agent.avatar} fallback={agent.name} size="sm" />
            <h1 className="text-sm font-medium tracking-tight">{agent.name}</h1>
          </div>
          {/* Use absolute positioning for buttons to prevent layout shift */}
          <div className="absolute right-4 top-4 flex items-center gap-2">
            {showNewThread && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => {
                  client.invalidateQueries({
                    queryKey: ["threads", locator, agentId],
                  });
                  focusChat(agentId, crypto.randomUUID(), {
                    history: false,
                  });
                }}
              >
                New Thread
              </Button>
            )}
            {showThreadsButton && <ThreadsButton />}
          </div>
        </div>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="flex-none pb-4 px-4">
        <ChatInput rightNode={<PreviewToggleButton />} />
      </div>
    </div>
  );
}

function ActionButtons() {
  const {
    form,
    isDirty: hasChanges,
    saveAgent,
    agent,
  } = useAgenticChat();

  const handleSubmit = form.handleSubmit(async () => {
    await saveAgent();
  });

  const isWellKnownAgent = Boolean(
    WELL_KNOWN_AGENTS[agent.id as keyof typeof WELL_KNOWN_AGENTS],
  );

  if (!form) {
    return null;
  }

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;

  function discardChanges() {
    form?.reset();
  }

  return (
    <div className="flex items-center gap-2 bg-sidebar transition-opacity">
      {!isWellKnownAgent && (
        <Button
          type="button"
          variant="outline"
          disabled={form.formState.isSubmitting}
          onClick={discardChanges}
          className={hasChanges ? "inline-flex" : "hidden"}
        >
          Discard
        </Button>
      )}

      <Button
        className={hasChanges ? "inline-flex" : "hidden"}
        variant="special"
        onClick={handleSubmit}
        disabled={!numberOfChanges || form.formState.isSubmitting}
      >
        {form.formState.isSubmitting ? (
          <>
            <Spinner size="xs" />
            <span>Saving...</span>
          </>
        ) : (
          <span>
            {isWellKnownAgent
              ? "Save Agent"
              : `Save ${numberOfChanges} change${
                  numberOfChanges > 1 ? "s" : ""
                }`}
          </span>
        )}
      </Button>
    </div>
  );
}

// Unified preview toggle button for mobile
function PreviewToggleButton() {
  const { showPreview, togglePreview, isMobile } = usePreviewContext();

  if (!isMobile) return null;

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      onClick={togglePreview}
      title={showPreview ? "Back to settings" : "Show preview"}
      className="h-10 w-10"
    >
      <Icon name={showPreview ? "settings" : "visibility"} size={16} />
    </Button>
  );
}

function AgentConfigs() {
  const { isMobile } = usePreviewContext();

  return (
    <div className="h-full flex flex-col gap-2 py-2 relative">
      <Tabs defaultValue="profile">
        <div className="flex items-center justify-between px-4">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          <ActionButtons />
        </div>
        <ScrollArea className="h-[calc(100vh-100px)] overflow-y-scroll">
          <TabsContent value="profile">
            <AgentProfileTab />
          </TabsContent>
          <TabsContent value="tools">
            <ToolsAndKnowledgeTab />
          </TabsContent>
          <TabsContent value="triggers">
            <AgentTriggers />
          </TabsContent>
          <TabsContent value="advanced">
            <Suspense fallback={<AdvancedTab.Skeleton />}>
              <AdvancedTab />
            </Suspense>
          </TabsContent>
        </ScrollArea>
      </Tabs>
      {/* Floating preview toggle button for mobile - bottom right corner */}
      {isMobile && (
        <div className="fixed bottom-6 right-6 z-50">
          <PreviewToggleButton />
        </div>
      )}
    </div>
  );
}

// Wrapper component that provides the right agent based on chat mode
function ChatWithProvider({
  agentId,
  threadId,
}: {
  agentId: string;
  threadId: string;
}) {
  const { chatMode } = usePreviewContext();
  // Use the threadId prop directly for agent mode
  // Separate stable threadId for decopilot mode using useState to maintain state when switching
  const [decopilotThreadId] = useState(() => crypto.randomUUID());

  // Get the agent being edited for decopilot context
  const { data: editingAgent } = useAgentData(agentId || "");

  // Decopilot-specific hooks
  const { threadState, clearThreadState } = useDecopilotThread();

  // Use threadState.threadId when available for decopilot mode
  const effectiveDecopilotThreadId = threadState.threadId ?? decopilotThreadId;

  // Only use initial input if there's an actual message and we're in decopilot mode
  const shouldUseInitialInput =
    chatMode === "decopilot" &&
    threadState.initialMessage &&
    threadState.autoSend;
  const appAdditionalTools = useAppAdditionalTools();
  const {
    additionalTools: contextTools,
    rules: contextRules,
    onToolCall,
  } = useDecopilotContext();

  // Determine which agent and threadId to use based on mode
  const chatAgentId =
    chatMode === "decopilot" ? WELL_KNOWN_AGENTS.decopilotAgent.id : agentId;

  // Prepare decopilot context when in decopilot mode
  const decopilotContextValue = useMemo(() => {
    if (chatMode !== "decopilot" || !editingAgent) return {};

    const rules: string[] = [
      `You are helping with agent editing and configuration. The current agent being edited is "${editingAgent.name}". Focus on operations related to agent configuration, tool management, knowledge base integration, and agent optimization.`,
      `When working with this agent (${editingAgent.name}), prioritize operations that help users configure the agent's behavior, manage its tools and integrations, optimize its performance, and understand its capabilities. Consider the agent's current configuration and settings when providing assistance.`,
    ];

    return { rules };
  }, [chatMode, editingAgent]);

  // Merge additional tools for decopilot mode
  const allAdditionalTools =
    chatMode === "decopilot"
      ? { ...appAdditionalTools, ...contextTools }
      : undefined;

  // Merge rules for decopilot mode
  const allRules =
    chatMode === "decopilot"
      ? [...(decopilotContextValue.rules || []), ...(contextRules || [])]
      : undefined;

  if (!chatAgentId) return null;

  const updateAgentMutation = useUpdateAgent();
  const { data: serverAgent } = useAgentData(agentId);
  const { data: decopilotAgent } = useAgentData(WELL_KNOWN_AGENTS.decopilotAgent.id);
  
  // Fetch required data for providers
  const agentRoot = useAgentRoot(agentId);
  const decopilotRoot = useAgentRoot(WELL_KNOWN_AGENTS.decopilotAgent.id);
  const { preferences } = useUserPreferences();
  const { data: { messages: agentThreadMessages } = { messages: [] } } = useThreadMessages(
    threadId,
    {
      enabled: chatMode === "agent",
    }
  );
  const { data: { messages: decopilotThreadMessages } = { messages: [] } } = useThreadMessages(
    effectiveDecopilotThreadId,
    {
      enabled: chatMode === "decopilot",
    }
  );

  const handleSaveAgent = async (agent: Agent) => {
    await updateAgentMutation.mutateAsync(agent);
    toast.success("Agent updated successfully");
  };

  // Render both providers but only show the active one
  // This way both chats maintain their state
  return (
    <div className="h-full w-full">
      {/* Agent chat - hidden when in decopilot mode */}
      <div className={chatMode === "agent" ? "block h-full" : "hidden"}>
        {serverAgent && (
          <Suspense fallback={null}>
            <AgenticChatProvider
              key={`agent-${agentId}-${threadId}`}
              agentId={agentId}
              threadId={threadId}
              agent={serverAgent}
              agentRoot={agentRoot}
              defaultModel={preferences.defaultModel}
              useOpenRouter={preferences.useOpenRouter}
              sendReasoning={preferences.sendReasoning}
              smoothStream={preferences.smoothStream}
              initialMessages={agentThreadMessages}
              onSave={handleSaveAgent}
              uiOptions={{
                showThreadTools: false,
                showEditAgent: false,
                showModelSelector: false,
                showThreadMessages: true,
                showAgentVisibility: false,
              }}
            >
              <UnifiedChat />
            </AgenticChatProvider>
          </Suspense>
        )}
      </div>

      {/* Decopilot chat - hidden when in agent mode */}
      <div className={chatMode === "decopilot" ? "block h-full" : "hidden"}>
        {decopilotAgent && (
          <Suspense fallback={null}>
            <AgenticChatProvider
              key={effectiveDecopilotThreadId}
              agentId={WELL_KNOWN_AGENTS.decopilotAgent.id}
              threadId={effectiveDecopilotThreadId}
              agent={decopilotAgent}
              agentRoot={decopilotRoot}
              defaultModel={preferences.defaultModel}
              useOpenRouter={preferences.useOpenRouter}
              sendReasoning={preferences.sendReasoning}
              smoothStream={preferences.smoothStream}
              initialMessages={decopilotThreadMessages}
              initialInput={
                shouldUseInitialInput
                  ? (threadState.initialMessage ?? undefined)
                  : undefined
              }
              autoSend={shouldUseInitialInput ? threadState.autoSend : false}
              onAutoSendComplete={clearThreadState}
              initialContext={[
                ...(allRules || []).map(text => ({ type: "rule" as const, text, id: crypto.randomUUID() })),
                ...Object.entries(allAdditionalTools || {}).map(([integrationId, tools]) => ({
                  type: "toolset" as const,
                  integrationId,
                  enabledTools: tools,
                  id: crypto.randomUUID(),
                })),
              ]}
              onToolCall={onToolCall}
              uiOptions={{
                showThreadTools: false,
                showEditAgent: false,
                showModelSelector: true,
                showThreadMessages: false,
                showAgentVisibility: false,
              }}
            >
              <UnifiedChat />
            </AgenticChatProvider>
          </Suspense>
        )}
      </div>
    </div>
  );
}

function ResponsiveLayout({
  agentId,
  threadId,
}: {
  agentId: string;
  threadId: string;
}) {
  const { showPreview, isMobile } = usePreviewContext();

  if (isMobile) {
    // Mobile layout: stack or toggle between config and chat
    return (
      <div className="h-[calc(100vh-48px)] flex flex-col">
        {!showPreview ? (
          <AgentConfigs />
        ) : (
          <ChatWithProvider agentId={agentId} threadId={threadId} />
        )}
      </div>
    );
  }

  // Desktop layout: resizable panels
  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel className="h-[calc(100vh-48px)]" defaultSize={60}>
        <AgentConfigs />
      </ResizablePanel>
      <ResizableHandle />
      <ResizablePanel className="h-[calc(100vh-48px)]" defaultSize={40}>
        <ChatWithProvider agentId={agentId} threadId={threadId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function FormProvider(props: Props & { agentId: string; threadId: string }) {
  const { agentId, threadId } = props;
  const { data: agent } = useAgentData(agentId);
  const agentRoot = useAgentRoot(agentId);
  const { preferences } = useUserPreferences();
  const { data: { messages: threadMessages } = { messages: [] } } = useThreadMessages(
    threadId,
    { enabled: true }
  );
  const { data: resolvedAvatar } = useFile(
    agent?.avatar && isFilePath(agent.avatar) ? agent.avatar : "",
  );
  const { locator } = useSDK();
  const projectKey = typeof locator === "string" ? locator : undefined;
  const { addRecent } = useRecentResources(projectKey);
  const params = useParams<{ org: string; project: string }>();
  const hasTrackedRecentRef = useRef(false);

  // Track as recently opened when agent is loaded (only once)
  useEffect(() => {
    if (
      agent &&
      agentId &&
      threadId &&
      projectKey &&
      params.org &&
      params.project &&
      !hasTrackedRecentRef.current
    ) {
      hasTrackedRecentRef.current = true;
      // Use the resolved avatar URL if available, otherwise fall back to the agent's avatar or default icon
      const avatarUrl =
        resolvedAvatar ||
        (agent.avatar && !isFilePath(agent.avatar) ? agent.avatar : undefined);

      addRecent({
        id: `${agentId}-${threadId}`,
        name: agent.name,
        type: "agent",
        icon: avatarUrl || "robot_2",
        path: `/${projectKey}/agent/${agentId}/${threadId}`,
      });
    }
  }, [
    agent,
    agentId,
    threadId,
    projectKey,
    params.org,
    params.project,
    addRecent,
    resolvedAvatar,
  ]);

  // Mobile detection
  const isMobile = useIsMobile();
  const [showPreview, setShowPreview] = useState(false);

  const togglePreview = () => setShowPreview((prev) => !prev);

  // Chat mode state (agent chat vs decopilot chat)
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const urlChatMode =
    (searchParams.get("chat") as "agent" | "decopilot") || "agent";

  const [chatMode, setChatMode] = useState<"agent" | "decopilot">(urlChatMode);

  // Sync with URL changes
  useEffect(() => {
    setChatMode(urlChatMode);
  }, [urlChatMode]);

  // Prepare decopilot context value for the agent being edited (left panel)
  const decopilotContextValue = useMemo(() => {
    if (!agent) return {};

    const rules: string[] = [
      `You are helping with agent editing and configuration. The current agent is "${agent.name}". Focus on operations related to agent configuration, tool management, knowledge base integration, and agent optimization.`,
      `When working with this agent (${agent.name}), prioritize operations that help users configure the agent's behavior, manage its tools and integrations, optimize its performance, and understand its capabilities. Consider the agent's current configuration and settings when providing assistance.`,
    ];

    return {
      rules,
    };
  }, [agent]);

  useDocumentMetadata({
    title: agent ? `${agent.name} | deco CMS` : undefined,
    description: agent
      ? (agent.description ?? agent.instructions ?? "")
      : undefined,
    favicon: isFilePath(agent?.avatar)
      ? typeof resolvedAvatar === "string"
        ? resolvedAvatar
        : undefined
      : agent?.avatar,
    socialImage: agent?.avatar,
  });

  if (!agent) {
    return null;
  }

  const updateAgentMutation = useUpdateAgent();
  const handleSaveAgent = async (agentData: Agent) => {
    await updateAgentMutation.mutateAsync(agentData);
    toast.success("Agent updated successfully");
  };

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <PreviewContext.Provider
        value={{ showPreview, togglePreview, isMobile, chatMode, setChatMode }}
      >
        <AgenticChatProvider
          agentId={agentId}
          threadId={threadId}
          agent={agent}
          agentRoot={agentRoot}
          defaultModel={preferences.defaultModel}
          useOpenRouter={preferences.useOpenRouter}
          sendReasoning={preferences.sendReasoning}
          smoothStream={preferences.smoothStream}
          initialMessages={threadMessages}
          onSave={handleSaveAgent}
          uiOptions={{
            showThreadTools: false,
            showEditAgent: false,
            showModelSelector: false,
            showThreadMessages: true,
            showAgentVisibility: false,
            showContextResources: true,
          }}
        >
          <ResponsiveLayout agentId={agentId} threadId={threadId} />
        </AgenticChatProvider>
      </PreviewContext.Provider>
    </DecopilotLayout>
  );
}

export default function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  const threadId = useMemo(
    () => props.threadId || params.threadId || agentId,
    [props.threadId, params.threadId, agentId],
  );

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  if (!agentId) {
    throw new NotFoundError("Agent not found");
  }

  return (
    <Suspense
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <FormProvider
        {...props}
        agentId={agentId}
        threadId={threadId!}
        key={chatKey}
      />
    </Suspense>
  );
}
