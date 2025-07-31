export type BindingToolScope = `${string}${typeof SEPARATOR}${string}`;

export interface BindingTool {
  bindingName: string;
  toolName: string;
}

const SEPARATOR = "::";
export const parser = {
  fromBindingToolToScope: (
    { bindingName, toolName }: BindingTool,
  ): BindingToolScope => {
    const parts = [bindingName, toolName];
    if (parts.some((part) => part.includes(SEPARATOR))) {
      throw new Error(
        `binding name or tool name includes ${SEPARATOR} is not allowed`,
      );
    }
    return parts.join(SEPARATOR) as BindingToolScope;
  },
  fromScopeToBindingTool: (scope: BindingToolScope): BindingTool => {
    const [bindingName, toolName] = scope.split(SEPARATOR);

    return { bindingName, toolName };
  },
};
