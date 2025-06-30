import { type Thread } from "@deco/sdk";

export interface GroupedThreads {
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

export const groupThreadsByDate = (threads: Thread[]): GroupedThreads => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const sortedThreads = threads.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return sortedThreads.reduce((groups, thread) => {
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