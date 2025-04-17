import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, PropsWithChildren, use } from "react";

interface State {
  /** The context of the account, i.e. users/123 or shared/teamId */
  context: string;
}

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

const Context = createContext<State | null>(null);

export function SDKProvider(
  { children, ...props }: PropsWithChildren<State>,
) {
  return (
    <QueryClientProvider client={client}>
      <Context.Provider value={props}>
        {children}
      </Context.Provider>
    </QueryClientProvider>
  );
}

export function useSDK() {
  const context = use(Context);

  if (!context) {
    throw new Error("useSDK must be used within a SDKProvider");
  }

  return context;
}
