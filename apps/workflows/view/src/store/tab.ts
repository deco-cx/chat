import { create } from "zustand";

export type Tab = "editor" | "code" | "input";

export const tabs = [
  { id: "editor", label: "Editor", icon: "edit" },
  // { id: "code", label: "Code", icon: "code" },
  // { id: "input", label: "Input", icon: "keyboard" },
];

interface State {
  tab: Tab;
}

interface Actions {
  setTab: (tab: Tab) => void;
}

interface Store extends State {
  actions: Actions;
}

const tabStore = create<Store>((set) => ({
  tab: "editor",
  actions: {
    setTab: (tab) => set({ tab }),
  },
}));

export const useActiveTab = () => {
  return tabStore((state) => state.tab);
};

export const useTabStoreActions = () => {
  return tabStore((state) => state.actions);
};
