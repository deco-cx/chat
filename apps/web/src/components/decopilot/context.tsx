import { createContext, useContext, type ReactNode } from "react";

export interface DecopilotContextValue {
  additionalTools?: Record<string, string[]>;
  rules?: string[];
}

const DecopilotContext = createContext<DecopilotContextValue | undefined>(undefined);

export interface DecopilotProviderProps {
  children: ReactNode;
  value: DecopilotContextValue;
}

export function DecopilotProvider({ children, value }: DecopilotProviderProps) {
  return (
    <DecopilotContext.Provider value={value}>
      {children}
    </DecopilotContext.Provider>
  );
}

export function useDecopilotContext(): DecopilotContextValue {
  const context = useContext(DecopilotContext);
  return context || {};
}
