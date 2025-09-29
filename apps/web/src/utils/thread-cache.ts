/**
 * Simple localStorage cache for thread data with 7-day expiration
 */

import type { ThreadDetails } from "@deco/sdk";
import type { UIMessage } from "ai";

interface CachedThreadData {
  threadDetail: ThreadDetails;
  messages: { messages: UIMessage[] };
  timestamp: number;
  expires: number;
}

const CACHE_PREFIX = "deco_thread_cache_";
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

class ThreadCache {
  private isSupported(): boolean {
    try {
      const test = "__localStorage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  private getCacheKey(threadId: string): string {
    return `${CACHE_PREFIX}${threadId}`;
  }

  private isExpired(expires: number): boolean {
    return Date.now() > expires;
  }

  private cleanupExpired(): void {
    if (!this.isSupported()) return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          try {
            const data = JSON.parse(localStorage.getItem(key) || "{}");
            if (this.isExpired(data.expires)) {
              keysToRemove.push(key);
            }
          } catch {
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn("Failed to cleanup expired thread cache:", error);
    }
  }

  set(
    threadId: string,
    threadDetail: ThreadDetails,
    messages: { messages: UIMessage[] },
  ): void {
    if (!this.isSupported()) return;

    try {
      const now = Date.now();
      const cacheData: CachedThreadData = {
        threadDetail,
        messages,
        timestamp: now,
        expires: now + CACHE_DURATION,
      };

      const cacheKey = this.getCacheKey(threadId);
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));

      // Cleanup expired entries occasionally (10% chance)
      if (Math.random() < 0.1) {
        this.cleanupExpired();
      }
    } catch (error) {
      // Storage might be full, try to cleanup and retry once
      try {
        this.cleanupExpired();
        localStorage.setItem(
          this.getCacheKey(threadId),
          JSON.stringify({
            threadDetail,
            messages,
            timestamp: Date.now(),
            expires: Date.now() + CACHE_DURATION,
          }),
        );
      } catch {
        console.warn("Failed to cache thread data:", error);
      }
    }
  }

  get(threadId: string): {
    threadDetail: ThreadDetails;
    messages: { messages: UIMessage[] };
  } | null {
    if (!this.isSupported()) return null;

    try {
      const cacheKey = this.getCacheKey(threadId);
      const cached = localStorage.getItem(cacheKey);
      if (!cached) {
        return null;
      }

      const data: CachedThreadData = JSON.parse(cached);

      if (this.isExpired(data.expires)) {
        localStorage.removeItem(cacheKey);
        return null;
      }

      return {
        threadDetail: data.threadDetail,
        messages: data.messages,
      };
    } catch (error) {
      console.warn("Failed to read thread cache:", error);
      return null;
    }
  }

  remove(threadId: string): void {
    if (!this.isSupported()) return;

    try {
      localStorage.removeItem(this.getCacheKey(threadId));
    } catch (error) {
      console.warn("Failed to remove thread from cache:", error);
    }
  }

  clear(): void {
    if (!this.isSupported()) return;

    try {
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => localStorage.removeItem(key));
    } catch (error) {
      console.warn("Failed to clear thread cache:", error);
    }
  }

  // Debug method to see all cached threads
  listCached(): string[] {
    if (!this.isSupported()) return [];

    const cachedThreads: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(CACHE_PREFIX)) {
          const threadId = key.replace(CACHE_PREFIX, "");
          cachedThreads.push(threadId);
        }
      }
    } catch (error) {
      console.warn("Failed to list cached threads:", error);
    }
    return cachedThreads;
  }
}

export const threadCache = new ThreadCache();
