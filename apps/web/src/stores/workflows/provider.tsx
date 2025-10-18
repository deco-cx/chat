import { StoreApi, useStore } from "zustand";
import { createWorkflowStore, type Store } from "./store";
import { createContext, useContext, useState } from "react";
import type { WorkflowDefinition } from "@deco/sdk";

const WorkflowStoreContext = createContext<StoreApi<Store> | null>(null);

export function WorkflowStoreProvider({
  children,
  workflow,
}: {
  children: React.ReactNode;
  workflow: WorkflowDefinition;
}) {
  const [store] = useState(() => createWorkflowStore({ workflow }));

  return (
    <WorkflowStoreContext.Provider value={store}>
      {children}
    </WorkflowStoreContext.Provider>
  );
}

export function useWorkflowStore<T>(selector: (state: Store) => T): T {
  const store = useContext(WorkflowStoreContext);
  if (!store) {
    throw new Error(
      "Missing WorkflowStoreProvider - refresh the page. If the error persists, please contact support.",
    );
  }
  return useStore(store, selector);
}
