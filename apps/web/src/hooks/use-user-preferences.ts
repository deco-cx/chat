import { DEFAULT_MEMORY_LAST_MESSAGES, DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./use-local-storage.ts";

export interface UserPreferences {
  useOpenRouter: boolean;
  smoothStream: boolean;
  sendReasoning: boolean;
  defaultModel: string;
  lastMessages: number;
  activityPageSize: number;
}

const USER_PREFERENCES_KEY = "user-preferences";

export function useUserPreferences() {
  const {
    value: preferences,
    update: setPreferences,
  } = useLocalStorage<UserPreferences>({
    key: USER_PREFERENCES_KEY,
    defaultValue: {
      defaultModel: DEFAULT_MODEL.id,
      lastMessages: DEFAULT_MEMORY_LAST_MESSAGES,
      useOpenRouter: true,
      smoothStream: true,
      sendReasoning: true,
      activityPageSize: 20,
    },
  });

  return {
    preferences,
    setPreferences,
  };
}
