import { useCreatePrompt } from "@deco/sdk";
import { toMention } from "@deco/sdk/utils";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { BubbleMenu as TiptapBubbleMenu } from "@tiptap/extension-bubble-menu";
import type { Editor } from "@tiptap/react";
import { mentionToTag } from "./common.ts";

interface Props {
  editor: Editor | null;
}

export default function BubbleMenu({ editor }: Props) {
  const { mutateAsync: createPrompt } = useCreatePrompt();

  const handleReplaceSelectionWithApiResult = async () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;

    if (from === to) {
      console.warn("No selection active.");
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, " ");

    try {
      const prompt = await createPrompt({
        name: `New Prompt ${new Date().toLocaleString()}`,
        content: selectedText,
      });

      editor
        .chain()
        .focus()
        .deleteRange({ from, to })
        .insertContentAt(from, mentionToTag(toMention(prompt.id, "prompt")))
        .run();
    } catch (error) {
      console.error("Failed to create prompt:", error);
    }
  };

  return (
    <TiptapBubbleMenu
      className="rounded-xl border bg-background shadow-md flex"
      editor={editor}
    >
      {/* <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 rounded-none"
      >
        <Icon name="edit" className="text-muted-foreground" size={16} />
        <span className="text-sm text-foreground font-medium">
          Edit in chat
        </span>
      </Button> */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2 border-l rounded-none"
        onClick={handleReplaceSelectionWithApiResult}
      >
        <Icon name="text_snippet" className="text-muted-foreground" size={16} />
        <span className="text-sm text-foreground font-medium">
          Save as prompt
        </span>
      </Button>
    </TiptapBubbleMenu>
  );
}
