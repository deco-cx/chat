import { DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./use-local-storage.ts";

export interface UserPreferences {
  useOpenRouter: boolean;
  smoothStream: boolean;
  sendReasoning: boolean;
  defaultModel: string;
  displayWorkflow: boolean;
}

const USER_PREFERENCES_KEY = "user-preferences";

export function useUserPreferences() {
  const { value: preferences, update: setPreferences } =
    useLocalStorage<UserPreferences>({
      key: USER_PREFERENCES_KEY,
      defaultValue: {
        defaultModel: DEFAULT_MODEL.id,
        useOpenRouter: true,
        smoothStream: true,
        sendReasoning: true,
        displayWorkflow: false,
      },
    });

  return {
    preferences,
    setPreferences,
  };
}
