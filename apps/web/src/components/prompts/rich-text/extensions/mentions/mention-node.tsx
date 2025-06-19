import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { useNavigateWorkspace } from "../../../../../hooks/use-navigate-workspace.ts";

export default function MentionNode(
  { node, extension }: ReactNodeViewProps<HTMLSpanElement>,
) {
  const navigateWorkspace = useNavigateWorkspace();

  const label = node.attrs.label;
  const id = node.attrs.id;

  const items = extension.options.suggestion?.items?.({ query: label })
    ?.flatMap(
      (item: { options: { id: string }[] }) => item?.options,
    );
  const prompt = items?.find((item: { id: string }) => item?.id === id) as
    | { id: string; icon: string; label: string; tooltip: string }
    | undefined;

  return (
    <NodeViewWrapper
      as="span"
      data-id={id}
      data-type="mention"
    >
      <Tooltip>
        <TooltipTrigger className="inline-flex items-center rounded-md bg-purple-light/20 transition-colors duration-300 hover:bg-purple-light/70 px-2 py-0.5 font-medium border border-purple-light text-xs group relative text-purple-dark">
          {prompt?.icon && <Icon name={prompt.icon} size={12} />}
          <span className="ml-1">
            {prompt?.label || "Prompt not found"}
          </span>
        </TooltipTrigger>
        {prompt && (
          <TooltipContent
            side="bottom"
            className="max-w-xs space-y-2 bg-background text-background-foreground shadow-2xs border [&>span>svg]:!bg-background [&>span>svg]:!fill-background"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-base flex items-center gap-2">
                {prompt.icon &&
                  (
                    <div className="bg-secondary rounded-md p-1 flex justify-center items-center border">
                      <Icon name={prompt.icon} size={18} />
                    </div>
                  )}
                <span className="line-clamp-2">{prompt.label}</span>
              </p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigateWorkspace(`/prompt/${prompt.id}`);
                }}
              >
                <Icon name="edit" size={16} />
              </Button>
            </div>
            <div className="bg-secondary rounded-md p-2 border">
              <span className="line-clamp-3">
                {prompt.tooltip || "Prompt not found"}
              </span>
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </NodeViewWrapper>
  );
}
