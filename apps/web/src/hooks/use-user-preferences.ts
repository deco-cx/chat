import { DEFAULT_MODEL } from "@deco/sdk";
import { useLocalStorage } from "./use-local-storage.ts";

export interface UserPreferences {
  useOpenRouter: boolean;
  sendReasoning: boolean;
  defaultModel: string;
  showDecopilot: boolean;
  pdfSummarization: boolean;
}

export const userPreferencesLabels = {
  useOpenRouter: {
    label: "Use OpenRouter",
    description: "Improve availability of AI responses.",
  },
  sendReasoning: {
    label: "Send Reasoning",
    description: "Send reasoning to the AI model.",
  },
};

const USER_PREFERENCES_KEY = "user-preferences";

export function useUserPreferences() {
  const { value: preferences, update: setPreferences } =
    useLocalStorage<UserPreferences>({
      key: USER_PREFERENCES_KEY,
      defaultValue: {
        defaultModel: DEFAULT_MODEL.id,
        useOpenRouter: true,
        sendReasoning: true,
        showDecopilot: false,
        pdfSummarization: true,
      },
    });

  return {
    preferences,
    setPreferences,
  };
}
