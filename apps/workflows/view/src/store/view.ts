import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  viewName: string;
  viewPurpose: string;
  activeView: string;
  inputValues: Record<string, string>;
  editingCode: boolean;
  editedCode: string;
  creatingView: boolean;
  newViewName: string;
}

interface Actions {
  setViewName: (viewName: string) => void;
  setViewPurpose: (viewPurpose: string) => void;
  setActiveView: (activeView: string) => void;
  setInputValues: (inputValues: Record<string, string>) => void;
  setEditingCode: (editingCode: boolean) => void;
  setEditedCode: (editedCode: string) => void;
  setCreatingView: (creatingView: boolean) => void;
  setNewViewName: (newViewName: string) => void;
}

interface Store extends State {
  actions: Actions;
}

const viewStore = create<Store>()(
  persist(
    (set) => ({
      inputValues: {},
      viewName: "",
      viewPurpose: "",
      activeView: "",
      editingCode: false,
      editedCode: "",
      creatingView: false,
      newViewName: "",
      actions: {
        setInputValues: (inputValues) => set({ inputValues }),
        setViewName: (viewName) => set({ viewName }),
        setViewPurpose: (viewPurpose) => set({ viewPurpose }),
        setActiveView: (activeView) => set({ activeView }),
        setEditingCode: (editingCode) => set({ editingCode }),
        setEditedCode: (editedCode) => set({ editedCode }),
        setCreatingView: (creatingView) => set({ creatingView }),
        setNewViewName: (newViewName) => set({ newViewName }),
      },
    }),
    {
      name: "view-store",
      partialize: (state) => ({
        viewName: state.viewName,
        viewPurpose: state.viewPurpose,
        activeView: state.activeView,
        editingCode: state.editingCode,
        editedCode: state.editedCode,
        creatingView: state.creatingView,
        newViewName: state.newViewName,
      }),
    },
  ),
);

export const useViewStoreViewName = () => {
  return viewStore((state) => state.viewName);
};

export const useViewStoreViewPurpose = () => {
  return viewStore((state) => state.viewPurpose);
};

export const useViewStoreActiveView = () => {
  return viewStore((state) => state.activeView);
};

export const useViewStoreInputValues = () => {
  return viewStore((state) => state.inputValues);
};

export const useViewStoreEditingCode = () => {
  return viewStore((state) => state.editingCode);
};

export const useViewStoreEditedCode = () => {
  return viewStore((state) => state.editedCode);
};

export const useViewStoreCreatingView = () => {
  return viewStore((state) => state.creatingView);
};

export const useViewStoreNewViewName = () => {
  return viewStore((state) => state.newViewName);
};

export const useViewStoreActions = () => {
  return viewStore((state) => state.actions);
};
