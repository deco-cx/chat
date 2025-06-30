import { type Thread, useThreads } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import { useUser } from "../../hooks/use-user.ts";
import { useFocusChat } from "../agents/hooks.ts";
import { Skeleton } from "@deco/ui/components/skeleton.tsx";
import { groupThreadsByDate } from "../../utils/group-threads.ts";

function Item(
  { agentId, thread }: { agentId: string; thread: Thread },
) {
  const user = useUser();
  const focusChat = useFocusChat();
  return (
    <button
      className={cn(
        "block text-left w-full",
        "text-sm font-normal",
        "truncate rounded-lg px-2 py-1.5 hover:bg-muted",
        "cursor-pointer",
      )}
      type="button"
      onClick={() =>
        focusChat(agentId, thread.id.replace(`${user?.id ?? ""}-`, ""))}
    >
      {thread.title}
    </button>
  );
}

function Category({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold px-2 py-1.5">{children}</h2>;
}

export function Threads({ agentId }: { agentId: string }) {
  const user = useUser();
  const { data } = useThreads({ agentId, resourceId: user?.id ?? "" });

  const groupedThreads = groupThreadsByDate(data.threads ?? []);
  const olderDates = Object.keys(groupedThreads.older).sort((a, b) => {
    return new Date(b).getTime() - new Date(a).getTime();
  });

  const hasNoThreads = groupedThreads.today.length === 0 &&
    groupedThreads.yesterday.length === 0 &&
    olderDates.length === 0;

  return (
    <div>
      {hasNoThreads
        ? (
          <div className="text-center py-12">
            <h2 className="text-lg font-medium text-foreground mb-2">
              No conversations yet
            </h2>
            <p className="text-sm text-muted-foreground">
              Start a new conversation to begin chatting with this agent.
            </p>
          </div>
        )
        : (
          <>
            {groupedThreads.today.length > 0 && (
              <div className="flex flex-col items-start w-full">
                <Category>Today</Category>
                {groupedThreads.today.map((thread) => (
                  <Item
                    key={thread.id}
                    agentId={agentId}
                    thread={thread}
                  />
                ))}
              </div>
            )}

            {groupedThreads.yesterday.length > 0 && (
              <div className="flex flex-col items-start w-full">
                <Category>Yesterday</Category>
                {groupedThreads.yesterday.map((thread) => (
                  <Item
                    key={thread.id}
                    agentId={agentId}
                    thread={thread}
                  />
                ))}
              </div>
            )}

            {olderDates.map((date) => (
              <div key={date} className="flex flex-col items-start w-full">
                <Category>{date}</Category>
                {groupedThreads.older[date].map((thread) => (
                  <Item
                    key={thread.id}
                    agentId={agentId}
                    thread={thread}
                  />
                ))}
              </div>
            ))}
          </>
        )}
    </div>
  );
}

Threads.Skeleton = () => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div key={index} className="w-full h-10 px-2">
        <Skeleton className="h-full bg-muted rounded-sm" />
      </div>
    ))}
  </div>
);
