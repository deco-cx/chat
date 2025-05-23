import { type Integration, useIntegrations } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import { Markdown } from "tiptap-markdown";
import {
  Mention,
  type MentionItem,
  useMentionSuggestion,
} from "./extensions/Mention.ts";
import { NoNewLine } from "./extensions/NoNewLine.ts";

interface RichTextAreaProps {
  value: string;
  onChange: (markdown: string, mentions: MentionItem[] | null) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: React.ClipboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  integrations?: Integration[];
}

export function RichTextArea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled = false,
  placeholder,
  className,
}: RichTextAreaProps) {
  const { data: integrations } = useIntegrations();
  const suggestion = useMentionSuggestion({ integrations });

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown.configure({
        html: true,
      }),
      NoNewLine,
      Mention(suggestion),
      Placeholder.configure({
        placeholder: placeholder ?? "Type a message...",
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown({
        html: true,
      });

      const mentions = editor.getJSON().content?.flatMap((node) =>
        node.content?.filter((child) => child.type === "mention")
          .map((child) => child.attrs) || []
      ).filter(Boolean) as MentionItem[];

      onChange(markdown, mentions);
    },
    editorProps: {
      attributes: {
        class: cn(
          "w-full outline-none min-h-[48px] max-h-[164px] overflow-y-auto p-4  leading-[1.2] rounded-t-2xl",
          disabled && "opacity-100 text-muted-foreground",
          className,
        ),
      },
    },
  });

  useEffect(() => {
    if (editor && editor.storage.markdown.getMarkdown() !== value) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <EditorContent
      editor={editor}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPaste={onPaste}
    />
  );
}
