import { SDKProvider, UnauthorizedError, Workspace } from "@deco/sdk";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { SidebarInset, SidebarProvider } from "@deco/ui/components/sidebar.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "react-router";
import { ErrorBoundary } from "../../error-boundary.tsx";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { ChatProvider } from "../chat/context.tsx";
import { EmptyState } from "../common/empty-state.tsx";
import { PageLayout } from "../layout.tsx";
import { ChatHeader } from "./chat-header.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";

const MainChat = () => {
  return (
    <div className="h-full w-full flex flex-col">
      <ScrollArea className="flex-1 min-h-0">
        <ChatMessages />
      </ScrollArea>
      <div className="p-2">
        <ChatInput />
      </div>
    </div>
  );
};

const TABS = {
  chat: {
    Component: MainChat,
    title: "Chat",
    initialOpen: true,
  },
  chatView: {
    Component: ThreadView,
    title: "Thread",
    hideFromViews: true,
  },
  preview: {
    Component: AgentPreview,
    title: "Preview",
    hideFromViews: true,
  },
};

export const getPublicChatLink = (agentId: string, workspace: Workspace) => {
  const url = new URL("/chats", globalThis.location.href);
  url.searchParams.set("agentId", agentId);
  url.searchParams.set("workspace", workspace);

  return url.href;
};

function Page() {
  const [params] = useSearchParams();

  const { agentId, workspace, threadId, additionalProps } = useMemo(() => {
    const workspace = params.get("workspace") as Workspace | null;
    const agentId = params.get("agentId");
    const additionalProps = JSON.parse(params.get("additionalProps") ?? "{}");
    const threadId = crypto.randomUUID();

    if (!workspace || !agentId) {
      throw new Error("Missing required params, workspace, agentId, threadId");
    }

    return { workspace, agentId, threadId, additionalProps };
  }, [params]);

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  return (
    <ErrorBoundary
      fallback={
        <EmptyState
          icon="robot_2"
          title="This agent is no longer available"
          description="The agent you’re trying to access is no longer publicly available. Its visibility may have changed or it might have been removed."
          buttonProps={{
            variant: "outline",
            children: "Create your agent at deco.chat",
            onClick: () => {
              location.href = "https://deco.chat";
            },
          }}
        />
      }
      shouldCatch={(e) => e instanceof UnauthorizedError}
    >
      <Suspense
        // This make the react render fallback when changin agent+threadid, instead of hang the whole navigation while the subtree isn't changed
        key={chatKey}
        fallback={
          <div className="h-full w-full flex items-center justify-center">
            <Spinner />
          </div>
        }
      >
        <SDKProvider workspace={workspace}>
          <ChatProvider
            agentId={agentId}
            threadId={threadId}
            additionalProps={additionalProps}
            uiOptions={{
              showThreadTools: false,
              showModelSelector: false,
              showThreadMessages: false,
              showAgentVisibility: false,
              showEditAgent: false,
            }}
          >
            <SidebarProvider
              style={{
                "--sidebar-width": "16rem",
                "--sidebar-width-mobile": "14rem",
              } as Record<string, string>}
            >
              <SidebarInset>
                <PageLayout tabs={TABS} breadcrumb={<ChatHeader />} />
              </SidebarInset>
            </SidebarProvider>
          </ChatProvider>
        </SDKProvider>
      </Suspense>
    </ErrorBoundary>
  );
}

export default Page;
