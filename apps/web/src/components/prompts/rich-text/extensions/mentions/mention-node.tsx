import { useUpdatePrompt } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { NodeViewWrapper, type ReactNodeViewProps } from "@tiptap/react";
import { mentionToTag } from "../../common.ts";
import type { SlashCommandOption } from "../../../../editor/slash-commands-dropdown.tsx";

export default function MentionNode({
  node,
  extension,
  editor,
  getPos,
}: ReactNodeViewProps<HTMLSpanElement>) {
  const label = node.attrs.label;
  const id = node.attrs.id;
  const { mutateAsync: updatePrompt } = useUpdatePrompt();

  const items =
    extension.options.suggestion
      ?.items?.({ query: label })
      ?.find((option: SlashCommandOption) => option.id === "references")
      ?.children?.flatMap((options: SlashCommandOption) => options.children) ||
    [];

  const prompt = items?.find((option: SlashCommandOption) => option?.id === id);

  const handleDetach = () => {
    const pos = getPos();

    editor
      .chain()
      .deleteRange({ from: pos, to: pos + node.nodeSize })
      .insertContentAt(pos, mentionToTag(prompt?.tooltip || ""))
      .run();
  };

  const handleChange = async (e: React.FocusEvent<HTMLParagraphElement>) => {
    const content = e.target.textContent;
    if (!content || !prompt || content === prompt.label) return;

    try {
      await updatePrompt({
        id: prompt.id,
        data: {
          name: content,
        },
      });
    } catch (error) {
      console.error("Failed to update prompt:", error);
    }
  };

  return (
    <NodeViewWrapper as="span" data-id={id} data-type="mention">
      <Tooltip>
        <TooltipTrigger
          type="button"
          className="inline-flex items-end rounded-md bg-muted px-1 group text-foreground gap-1 py-0.5 -mb-0.5"
        >
          {prompt?.icon && (
            <span className="bg-purple-light rounded-md p-0.5 text-foreground aspect-square flex">
              <Icon name={prompt.icon} size={12} />
            </span>
          )}
          <span className="leading-none">
            {prompt?.label || "Prompt not found"}
          </span>
        </TooltipTrigger>
        {prompt && (
          <TooltipContent
            side="bottom"
            className="max-w-sm bg-secondary text-secondary-foreground shadow-xl rounded-xl p-2 border [&>span>svg]:!bg-secondary [&>span>svg]:!fill-secondary"
          >
            <div className="flex items-center justify-between gap-2 text-muted-foreground">
              <p
                contentEditable={!!prompt}
                suppressContentEditableWarning
                onBlur={handleChange}
                className="font-medium text-xs line-clamp-1 px-3"
              >
                {prompt.label}
              </p>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDetach}
                type="button"
              >
                <Icon name="link_off" size={16} />
              </Button>
            </div>
            <div className="px-2.5 py-1.5 italic text-sm max-h-96 overflow-y-auto">
              {prompt.tooltip || "Prompt not found"}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </NodeViewWrapper>
  );
}
