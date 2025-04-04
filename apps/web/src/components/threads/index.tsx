import { Agent } from "@deco/sdk";
import { useAgent } from "@deco/sdk/hooks";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { useEffect, useState } from "react";
import { stub } from "../../utils/stub.ts";
import { useAgentRoot, useFocusAgent } from "../agents/hooks.ts";
import { useGlobalState } from "../../stores/global.tsx";

interface Thread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, string>;
}

interface GroupedThreads {
  today: Thread[];
  yesterday: Thread[];
  older: { [key: string]: Thread[] };
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

const groupThreadsByDate = (threads: Thread[]): GroupedThreads => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return threads.reduce((groups, thread) => {
    const threadDate = new Date(thread.createdAt);
    threadDate.setHours(0, 0, 0, 0);

    if (threadDate.getTime() === today.getTime()) {
      if (!groups.today) groups.today = [];
      groups.today.push(thread);
    } else if (threadDate.getTime() === yesterday.getTime()) {
      if (!groups.yesterday) groups.yesterday = [];
      groups.yesterday.push(thread);
    } else {
      const dateKey = formatDate(threadDate);
      if (!groups.older[dateKey]) groups.older[dateKey] = [];
      groups.older[dateKey].push(thread);
    }
    return groups;
  }, { today: [], yesterday: [], older: {} } as GroupedThreads);
};

function ThreadItem(
  { agentId, agent, thread }: { agentId: string; agent: Agent; thread: Thread },
) {
  const { state: { user } } = useGlobalState();
  const navigate = useFocusAgent();
  return (
    <button
      type="button"
      onClick={() =>
        navigate(agentId, agent, thread.id.replace(`${user?.id ?? ""}-`, ""))}
      className="w-full text-left p-3 hover:bg-slate-100 rounded-lg transition-colors"
    >
      <h2 className="text-sm">{thread.title}</h2>
    </button>
  );
}

const useThreads = (
  agentId: string,
  agentRoot: string | null,
) => {
  const [data, setThreads] = useState<Thread[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;

    if (!agentId || !agentRoot) return;

    const init = async () => {
      try {
        setLoading(true);

        // TODO: I guess we can improve this and have proper typings
        // deno-lint-ignore no-explicit-any
        const agentStub = stub<any>("AIAgent")
          .new(agentRoot);

        const threads = await agentStub.listThreads();

        if (cancel) return;

        setThreads(threads);
      } catch (err) {
        if (cancel) return;

        console.error(err);
        setThreads([]);
      } finally {
        setLoading(false);
      }
    };

    init().catch(console.error);

    return () => {
      cancel = true;
    };
  }, [agentId, agentRoot]);

  return { data, loading };
};

function App({ agentId }: { agentId: string }) {
  const { data: agent, error, loading } = useAgent(agentId);
  const agentRoot = useAgentRoot(agentId);
  const {
    data: threads,
    loading: threadsLoading,
  } = useThreads(agentId, agentRoot);

  if (loading || !agent || threadsLoading) {
    return (
      <div className="h-full bg-background flex flex-col items-center justify-center">
        <div className="relative">
          <Spinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        Error loading agent: {typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error)}
      </div>
    );
  }

  const groupedThreads = threads
    ? groupThreadsByDate(threads)
    : { today: [], yesterday: [], older: {} };
  const olderDates = Object.keys(groupedThreads.older).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const hasNoThreads = groupedThreads.today.length === 0 &&
    groupedThreads.yesterday.length === 0 &&
    olderDates.length === 0;

  return (
    <div className="p-6 text-slate-700 pb-20">
      <div className="max-w-2xl mx-auto space-y-6">
        {hasNoThreads
          ? (
            <div className="text-center py-12">
              <h2 className="text-lg font-medium text-slate-700 mb-2">
                No conversations yet
              </h2>
              <p className="text-sm text-slate-500">
                Start a new conversation to begin chatting with this agent.
              </p>
            </div>
          )
          : (
            <>
              {groupedThreads.today.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-slate-500">Today</h2>
                  {groupedThreads.today.map((thread) => (
                    <ThreadItem
                      key={thread.id}
                      agentId={agentId}
                      agent={agent}
                      thread={thread}
                    />
                  ))}
                </div>
              )}

              {groupedThreads.yesterday.length > 0 && (
                <div className="space-y-2">
                  <h2 className="text-sm font-medium text-slate-500">
                    Yesterday
                  </h2>
                  {groupedThreads.yesterday.map((thread) => (
                    <ThreadItem
                      key={thread.id}
                      agentId={agentId}
                      agent={agent}
                      thread={thread}
                    />
                  ))}
                </div>
              )}

              {olderDates.map((date) => (
                <div key={date} className="space-y-2">
                  <h2 className="text-sm font-medium text-slate-500">{date}</h2>
                  {groupedThreads.older[date].map((thread) => (
                    <ThreadItem
                      key={thread.id}
                      agentId={agentId}
                      agent={agent}
                      thread={thread}
                    />
                  ))}
                </div>
              ))}
            </>
          )}
      </div>
    </div>
  );
}

export default App;
