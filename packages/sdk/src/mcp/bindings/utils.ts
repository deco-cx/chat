import type { ToolBinder } from "../index.ts";

export const Binding = <TDefinition extends readonly ToolBinder[]>(
  binder: TDefinition,
) => {
  return {
    isImplementedBy: (tools: Pick<ToolBinder, "name">[]) => {
      return binder.every(
        (tool) => tool.opt || tools.some((t) => t.name === tool.name),
      );
    },
  };
};
