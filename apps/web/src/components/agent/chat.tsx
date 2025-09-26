import { ScrollArea } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Suspense, useMemo } from "react";
import { useParams } from "react-router";
import { useFile, WELL_KNOWN_AGENT_IDS } from "@deco/sdk";
import { useDocumentMetadata } from "../../hooks/use-document-metadata.ts";
import { isFilePath } from "../../utils/path.ts";
import { ChatInput } from "../chat/chat-input.tsx";
import { ChatMessages } from "../chat/chat-messages.tsx";
import { AgentProvider, useAgent } from "./provider.tsx";

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
        <MainChat />
      </AgentProvider>
    </Suspense>
  );
}

export default Page;
