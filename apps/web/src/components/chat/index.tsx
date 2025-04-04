import type { Message } from "@ai-sdk/react";
import { createAgent } from "@deco/sdk/crud";
import { useAgent } from "@deco/sdk/hooks";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useEffect, useState } from "react";
import { stub } from "../../utils/stub.ts";
import { useAgentRoot } from "../agents/hooks.ts";
import { Chat } from "./Chat.tsx";

// Extended agent type with locator
const useMessages = (
  agentId: string,
  threadId: string,
  agentRoot: string | null,
) => {
  const [messages, setMessages] = useState<Message[] | null>(null);

  useEffect(() => {
    let cancel = false;

    if (!agentId || !agentRoot) return;

    const init = async () => {
      try {
        // TODO: I guess we can improve this and have proper typings
        // deno-lint-ignore no-explicit-any
        const agentStub = stub<any>("AIAgent")
          .new(agentRoot)
          .withMetadata({ threadId });

        const messages = await agentStub.query({
          threadId,
        });

        if (cancel) return;

        setMessages(messages);
      } catch (err) {
        if (cancel) return;

        console.error(err);
        setMessages([]);
      }
    };

    init().catch(console.error);

    return () => {
      cancel = true;
    };
  }, [agentId, threadId, agentRoot]);

  return messages;
};

const TEAM_AGENT = {
  id: "teamAgent",
  name: "Deco Chat",
  avatar: "https://deco.chat/logos/team-agent.png",
  description: "I can help you with anything you need.",
  instructions: `
<system>
You are an assistant on a platform designed to help users accomplish their tasks. Your primary objective is to guide users toward completing what they want to do in the simplest and most helpful way possible.

<task_support>
When a user describes a goal that depends on third-party systems, check the platform’s marketplace for relevant integrations. Only suggest installing or enabling tools after getting the user's explicit confirmation. Once tools are installed, use them to identify which capabilities are available and assist the user accordingly.
</task_support>

<user_goal_handling>
Users can have two types of goals:
<one_time_task>When the user wants to do something once, help them complete the task directly. Do not suggest creating an agent unless the user implies the need for reuse.</one_time_task>
<repeatable_workflow>When the user wants to set up a solution that can be used repeatedly or by others (e.g., sending emails, analyzing data from spreadsheets), propose creating a specialized agent focused on that purpose. Only proceed after receiving explicit confirmation from the user.</repeatable_workflow>

If the user’s intent is unclear, default to handling the request as a one-time task.
NEVER perform actions without the user's explicit permission. Do not write/install/enable/create anything without the user's explicit permission.
</user_goal_handling>

<user_assumptions>
Assume users are non-technical and unfamiliar with the tools or systems needed to complete their goals. Avoid technical jargon. Ask simple, clarifying questions before suggesting a solution to ensure it fits the user’s actual need.
</user_assumptions>

<interaction_guidelines>
Offer only 1–2 options at a time to avoid overwhelming the user. Focus on one clear action at a time and always request explicit confirmation before proceeding.
</interaction_guidelines>

<user_consent_rule>
Never perform actions such as installing tools, enabling services, or creating agents without the user's explicit permission. Always ask for confirmation first.
</user_consent_rule>
</system>
`,
};

function App({ agentId, threadId }: { agentId: string; threadId: string }) {
  const { data: agent, update, error, loading } = useAgent(agentId);
  const agentRoot = useAgentRoot(agentId);
  const messages = useMessages(agentId, threadId, agentRoot);

  const notFound = error?.message === "No such file or directory";

  useEffect(() => {
    // Always update the team agent
    if (agentId === "teamAgent") {
      createAgent(TEAM_AGENT).catch(console.error);
    }

    if (!notFound) return;

    createAgent({ id: agentId }).catch(console.error);
  }, [notFound, agentId]);

  if (error && !notFound) {
    return (
      <div>
        Error loading agent:{" "}
        {error instanceof Error ? String(error) : JSON.stringify(error)}
      </div>
    );
  }

  if (loading || !agent || !messages || !agentRoot || notFound) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center">
        <div className="relative">
          <Spinner />
        </div>
      </div>
    );
  }

  return (
    <Chat
      initialMessages={messages}
      agent={agent}
      updateAgent={update}
      agentRoot={agentRoot}
      threadId={threadId}
    />
  );
}

export default App;
