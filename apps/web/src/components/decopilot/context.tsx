import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

export interface DecopilotContextValue {
  additionalTools?: Record<string, string[]>;
  rules?: string[];
  onToolCall?: (toolCall: { toolName: string }) => void;
  // Methods to update the context
  setAdditionalTools?: (tools: Record<string, string[]>) => void;
  setRules?: (rules: string[]) => void;
}

const DecopilotContext = createContext<DecopilotContextValue | undefined>(
  undefined,
);

export interface DecopilotProviderProps {
  children: ReactNode;
  value?: DecopilotContextValue;
}

export function DecopilotProvider({ children, value: initialValue }: DecopilotProviderProps) {
  const [additionalTools, setAdditionalTools] = useState<Record<string, string[]>>(
    initialValue?.additionalTools || {},
  );
  const [rules, setRules] = useState<string[]>(initialValue?.rules || []);
  
  const contextValue: DecopilotContextValue = {
    additionalTools,
    rules,
    onToolCall: initialValue?.onToolCall,
    setAdditionalTools: useCallback((tools: Record<string, string[]>) => {
      setAdditionalTools(tools);
    }, []),
    setRules: useCallback((newRules: string[]) => {
      setRules(newRules);
    }, []),
  };

  return (
    <DecopilotContext.Provider value={contextValue}>
      {children}
    </DecopilotContext.Provider>
  );
}

export function useDecopilotContext(): DecopilotContextValue {
  const context = useContext(DecopilotContext);
  return context || {};
}
