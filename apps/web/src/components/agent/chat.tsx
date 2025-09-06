import { useFile, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { useFocusChat } from "../agents/hooks.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { useAgent } from "./provider.tsx";
import { AgentProvider } from "./provider.tsx";
import { DefaultBreadcrumb, PageLayout } from "../layout/project.tsx";
import { AgentBreadcrumbSegment } from "./breadcrumb-segment.tsx";
import AgentPreview from "./preview.tsx";
import ThreadView from "./thread.tsx";
import { isFilePath } from "../../utils/path.ts";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";

export type WellKnownAgents =
  (typeof WELL_KNOWN_AGENT_IDS)[keyof typeof WELL_KNOWN_AGENT_IDS];

interface Props {
  agentId?: WellKnownAgents;
  threadId?: string;
  showThreadMessages?: boolean;
}

export const MainChat = () => {
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

function ActionsButtons() {
  const { agentId, chat } = useAgent();
  const focusChat = useFocusChat();
  const focusAgent = useFocusChat();

  const displaySettings = agentId !== WELL_KNOWN_AGENT_IDS.teamAgent;
  const displayNewChat = displaySettings && chat.messages.length !== 0;

  if (!displayNewChat && !displaySettings) {
    return null;
  }

  return (
    <div className="hidden md:flex items-center gap-2">
      {displayNewChat && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                focusChat(agentId, crypto.randomUUID(), {
                  history: false,
                })
              }
            >
              <Icon name="edit_square" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>New chat</TooltipContent>
        </Tooltip>
      )}
      {displaySettings && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() =>
                focusAgent(agentId, crypto.randomUUID(), {
                  history: false,
                })
              }
            >
              <Icon name="tune" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit agent</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

function Breadcrumb({ agentId }: { agentId: string }) {
  const { chat } = useAgent();
  const focusChat = useFocusChat();
  const focusAgent = useFocusChat();

  return (
    <DefaultBreadcrumb
      items={[
        {
          label: (
            <>
              <div className="hidden md:flex items-center gap-2">
                <AgentBreadcrumbSegment />
              </div>
              <div className="md:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center gap-2">
                    <AgentBreadcrumbSegment />
                    <Icon name="arrow_drop_down" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {chat.messages.length !== 0 && (
                      <DropdownMenuItem
                        className="flex items-center gap-4"
                        onClick={() =>
                          focusChat(agentId, crypto.randomUUID(), {
                            history: false,
                          })
                        }
                      >
                        <Icon name="edit_square" /> New chat
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="flex items-center gap-4"
                      onClick={() =>
                        focusAgent(agentId, crypto.randomUUID(), {
                          history: false,
                        })
                      }
                    >
                      <Icon name="tune" /> Edit agent
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ),
        },
      ]}
    />
  );
}

function AgentMetadataUpdater() {
  const { agent } = useAgent();
  const { data: resolvedAvatar } = useFile(
    agent?.avatar && isFilePath(agent.avatar) ? agent.avatar : "",
  );

  // Compute favicon href, favouring resolved file URLs for local files.
  const faviconHref = isFilePath(agent?.avatar)
    ? typeof resolvedAvatar === "string"
      ? resolvedAvatar
      : undefined
    : agent?.avatar;

  useDocumentMetadata({
    title: agent ? `${agent.name} | deco CMS` : undefined,
    favicon: faviconHref,
  });

  return null;
}

function Page(props: Props) {
  const params = useParams();
  const agentId = useMemo(
    () => props.agentId || params.id,
    [props.agentId, params.id],
  );

  if (!agentId) {
    return <div>Agent not found</div>;
  }

  const propThreadId = props.threadId || params.threadId;
  const threadId = useMemo(
    () => propThreadId || agentId,
    [propThreadId, agentId],
  );

  const chatKey = useMemo(() => `${agentId}-${threadId}`, [agentId, threadId]);

  // Use AgentProvider for all agents (including team agent)
  const isTeamAgent = agentId === WELL_KNOWN_AGENT_IDS.teamAgent;

  return (
    <Suspense
      // This make the react render fallback when changin agent+threadid, instead of hang the whole navigation while the subtree isn't changed
      key={chatKey}
      fallback={
        <div className="h-full w-full flex items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AgentProvider
        agentId={agentId}
        threadId={threadId}
        uiOptions={{
          showThreadTools: isTeamAgent,
          showThreadMessages: props.showThreadMessages ?? true,
        }}
      >
        <AgentMetadataUpdater />
        <PageLayout
          tabs={TABS}
          key={agentId}
          actionButtons={<ActionsButtons />}
          breadcrumb={
            agentId !== WELL_KNOWN_AGENT_IDS.teamAgent && (
              <Breadcrumb agentId={agentId} />
            )
          }
        />
      </AgentProvider>
    </Suspense>
  );
}

export default Page;
