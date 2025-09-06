import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, type PropsWithChildren, use } from "react";

export type Workspace = `users/${string}` | `shared/${string}`;

interface State {
  /** The context of the account, i.e. users/123 or shared/teamId */
  workspace: Workspace;
}

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000, // 5 minutes in milliseconds
      networkMode: "offlineFirst",
    },
  },
});

const Context = createContext<State | null>(null);

export function DecoQueryClientProvider({ children }: PropsWithChildren) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

export function SDKProvider({ children, ...props }: PropsWithChildren<State>) {
  return (
    <DecoQueryClientProvider>
      <Context.Provider value={props}>{children}</Context.Provider>
    </DecoQueryClientProvider>
  );
}

export function useSDK() {
  const context = use(Context);

  if (!context) {
    throw new Error("useSDK must be used within a SDKProvider");
  }

  return context;
}
