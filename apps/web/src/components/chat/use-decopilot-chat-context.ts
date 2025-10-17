import { useEffect } from "react";
import { useDecopilotContext } from "../decopilot/context.tsx";

/**
 * Hook to dynamically inject context items (rules and toolsets) into the Decopilot chat.
 * 
 * This is used by pages that need to provide page-specific context to the chat without
 * causing re-renders. The chat is hoisted up the React tree, so pages can't directly
 * pass props to it.
 * 
 * Usage:
 * ```tsx
 * const contextValue = useMemo(() => ({
 *   rules: ["Rule 1", "Rule 2"],
 *   additionalTools: { "integration-id": ["tool1", "tool2"] },
 * }), [dependencies]);
 * 
 * useDecopilotChatContextEffect(contextValue);
 * ```
 * 
 * @param contextValue - The context to inject (rules and/or additionalTools)
 */
export function useDecopilotChatContextEffect(contextValue?: {
  rules?: string[];
  additionalTools?: Record<string, string[]>;
}) {
  const decopilotContext = useDecopilotContext();
  const { setAdditionalTools, setRules } = decopilotContext;

  useEffect(() => {
    if (!setAdditionalTools || !setRules) {
      return;
    }

    if (!contextValue) {
      setRules([]);
      setAdditionalTools({});
      return;
    }

    // Update the Decopilot context with the new rules and tools
    if (contextValue.rules && contextValue.rules.length > 0) {
      setRules(contextValue.rules);
    } else {
      setRules([]);
    }

    if (contextValue.additionalTools && Object.keys(contextValue.additionalTools).length > 0) {
      setAdditionalTools(contextValue.additionalTools);
    } else {
      setAdditionalTools({});
    }

    // Cleanup: reset context when component unmounts
    return () => {
      setRules([]);
      setAdditionalTools({});
    };
  }, [contextValue, setAdditionalTools, setRules]);
}
