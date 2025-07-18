import type { Prompt } from "@deco/sdk";
import { createContext, useContext as useContextReact } from "react";
import type { UseFormReturn } from "react-hook-form";

export interface IContext {
  form: UseFormReturn<Prompt>;
  prompt: Prompt;
  setSelectedPrompt: (prompt: Prompt) => void;
  promptVersion: string | null;
  setPromptVersion: (version: string | null) => void;
  onSubmit: (data: Prompt) => void;
}

export const Context = createContext<IContext | null>(null);

export const useFormContext = () => {
  const context = useContextReact(Context);

  if (!context) {
    throw new Error("useFormContext must be used within a FormProvider");
  }

  return context;
};
