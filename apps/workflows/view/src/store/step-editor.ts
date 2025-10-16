import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  prompt: string;
}

interface Actions {
  setPrompt: (prompt: string) => void;
}

interface Store extends State {
  actions: Actions;
}

const stepEditorStore = create<Store>()(
  persist(
    (set) => ({
      actions: {
        setPrompt: (prompt) => set({ prompt }),
      },
      prompt: "",
    }),
    {
      name: "step-editor-store",
      partialize: (state) => ({
        prompt: state.prompt,
      }),
    },
  ),
);

export const useStepEditorPrompt = () => {
  return stepEditorStore((state) => state.prompt);
};

export const useStepEditorActions = () => {
  return stepEditorStore((state) => state.actions);
};
