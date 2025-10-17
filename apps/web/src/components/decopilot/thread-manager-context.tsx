import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { emitThreadContextUpdate } from "./thread-events.ts";

/**
 * Simplified thread data - only stores ID and route association
 */
export interface ThreadData {
  id: string;
  route: string;
  createdAt: number;
}

interface ThreadManagerContextValue {
  threads: Map<string, ThreadData>;
  activeThreadId: string | null;
  getThreadForRoute: (route: string) => ThreadData | null;
  getActiveThread: () => ThreadData | null;
}

const ThreadManagerContext = createContext<ThreadManagerContextValue | null>(null);

interface ThreadManagerProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = "decopilot-thread-routes";

export function ThreadManagerProvider({ children }: ThreadManagerProviderProps) {
  const location = useLocation();
  
  // Load threads from localStorage
  const [threads, setThreads] = useState<Map<string, ThreadData>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return new Map(Object.entries(parsed));
      }
    } catch (error) {
      console.error("[ThreadManager] Failed to load threads:", error);
    }
    return new Map();
  });

  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);

  // Persist threads to localStorage
  useEffect(() => {
    try {
      const obj = Object.fromEntries(threads);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (error) {
      console.error("[ThreadManager] Failed to persist threads:", error);
    }
  }, [threads]);

  // Get thread for a route
  const getThreadForRoute = useCallback((route: string): ThreadData | null => {
    for (const thread of threads.values()) {
      if (thread.route === route) {
        return thread;
      }
    }
    return null;
  }, [threads]);

  // Get active thread
  const getActiveThread = useCallback((): ThreadData | null => {
    if (!activeThreadId) return null;
    return threads.get(activeThreadId) || null;
  }, [activeThreadId, threads]);

  // Auto-create/activate thread for current route
  useEffect(() => {
    const currentRoute = location.pathname;
    
    // Find existing thread for this route
    const existingThread = getThreadForRoute(currentRoute);
    
    if (existingThread) {
      // Activate if not already active
      if (activeThreadId !== existingThread.id) {
        setActiveThreadId(existingThread.id);
      }
    } else {
      // Create new thread for this route
      const newId = crypto.randomUUID();
      
      const newThread: ThreadData = {
        id: newId,
        route: currentRoute,
        createdAt: Date.now(),
      };

      setThreads(prev => new Map(prev).set(newId, newThread));
      setActiveThreadId(newId);
    }
  }, [location.pathname, getThreadForRoute, activeThreadId]);

  const value: ThreadManagerContextValue = {
    threads,
    activeThreadId,
    getThreadForRoute,
    getActiveThread,
  };

  return (
    <ThreadManagerContext.Provider value={value}>
      {children}
    </ThreadManagerContext.Provider>
  );
}

export function useThreadManager(): ThreadManagerContextValue {
  const context = useContext(ThreadManagerContext);
  if (!context) {
    throw new Error("useThreadManager must be used within ThreadManagerProvider");
  }
  return context;
}

/**
 * Hook for resource pages to emit context updates for the current route's thread
 */
export function useThreadContext(context?: {
  rules?: string[];
  tools?: Record<string, string[]>;
}) {
  const location = useLocation();
  const { getThreadForRoute } = useThreadManager();
  const prevContextRef = useRef<string>('');

  useEffect(() => {
    if (!context) return;

    const currentRoute = location.pathname;
    const thread = getThreadForRoute(currentRoute);

    if (!thread) {
      return;
    }

    // Only emit if context actually changed (deep comparison via JSON)
    const contextStr = JSON.stringify(context);
    if (prevContextRef.current === contextStr) {
      return;
    }
    prevContextRef.current = contextStr;

    // Delay emission to ensure listeners are subscribed
    const timer = setTimeout(() => {
      emitThreadContextUpdate({
        threadId: thread.id,
        rules: context.rules,
        tools: context.tools,
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [context, location.pathname, getThreadForRoute]);
}
