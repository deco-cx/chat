import { usePrompts } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import BubbleMenu from "./bubble-menu.tsx";
import { mentionToTag, removeMarkdownCodeBlock } from "./common.ts";
import { Comment } from "./extensions/comment.tsx";
import { mentions } from "./extensions/mentions/mentions.ts";

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  onKeyDown?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onKeyUp?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onPaste?: (
    event: React.ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  enableMentions?: boolean;
  hideMentionsLabel?: boolean;
  excludeIds?: string[];
}

export default function RichTextArea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled = false,
  placeholder,
  className,
  enableMentions = false,
  hideMentionsLabel = false,
  excludeIds = [],
}: Props) {
  const hadUserInteraction = useRef(false);
  const { data: prompts } = usePrompts({ excludeIds });

  const extensions = useMemo(() => {
    const extensions: Extensions = [
      StarterKit,
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type a message...",
      }),
      Comment,
    ];

    if (enableMentions) {
      extensions.push(mentions(prompts ?? []));
    }

    return extensions;
  }, [enableMentions, placeholder, prompts]);

  const editor = useEditor(
    {
      extensions,
      content: mentionToTag(removeMarkdownCodeBlock(value), true),
      editable: !disabled,
      onUpdate: ({ editor }) => {
        const markdown = editor.storage.markdown.getMarkdown();

        if (!hadUserInteraction.current && editor.isFocused) {
          hadUserInteraction.current = true;
        }

        if (hadUserInteraction.current) {
          onChange(markdown);
        }
      },
      editorProps: {
        attributes: {
          class: cn(
            "h-full placeholder:text-muted-foreground field-sizing-content w-full bg-transparent text-base transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 prose whitespace-pre-wrap break-words wrap-anywhere",
            className,
          ),
        },
      },
    },
    [prompts],
  );

  // sync external value changes to the editor
  useEffect(() => {
    if (!editor) return;

    const _value = removeMarkdownCodeBlock(value);
    if (mentionToTag(_value) !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(mentionToTag(_value, true), false, {
        preserveWhitespace: "full",
      });
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="h-full flex flex-col">
      {enableMentions && !hideMentionsLabel && (
        <div className="rounded-full flex gap-1 bg-muted text-muted-foreground w-fit items-center px-1.5 py-0.5 mb-2.5 select-none">
          <Icon name="info" size={10} />
          <p className="text-xs font-medium">Type / to add tools and more</p>
        </div>
      )}
      <BubbleMenu editor={editor} />
      <EditorContent
        className="h-full"
        editor={editor}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPaste={onPaste}
      />
    </div>
  );
}
