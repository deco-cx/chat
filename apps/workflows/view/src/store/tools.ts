import { create } from "zustand";

interface State {
  searchQuery: string;
}

interface Actions {
  setSearchQuery: (searchQuery: string) => void;
}

interface Store extends State {
  actions: Actions;
}

const toolsStore = create<Store>((set) => ({
  actions: {
    setSearchQuery: (searchQuery) => set({ searchQuery }),
  },
  searchQuery: "",
}));

export const useToolsStoreActions = () => {
  return toolsStore.getState().actions;
};

export const useToolsStoreSearchQuery = () => {
  return toolsStore((state) => state.searchQuery);
};
