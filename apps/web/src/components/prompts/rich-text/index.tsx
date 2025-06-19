import { usePrompts } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import { mentionToTag, tagToMention } from "./common.ts";
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
      extensions.push(
        mentions(prompts ?? []),
      );
    }

    return extensions;
  }, [enableMentions, placeholder, prompts]);

  const editor = useEditor({
    extensions,
    content: mentionToTag(value),
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const markdown = tagToMention(editor.storage.markdown.getMarkdown());

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
          "h-full border-border border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 field-sizing-content w-full rounded-xl border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm prose leading-7",
          disabled && "opacity-100 text-muted-foreground",
          className,
        ),
      },
    },
  });

  // sync external value changes to the editor
  useEffect(() => {
    if (!editor) return;

    const parsedValue = mentionToTag(value);
    if (parsedValue !== editor.storage.markdown.getMarkdown()) {
      editor.commands.setContent(parsedValue, false);
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="h-full flex flex-col">
      {enableMentions && (
        <div className="rounded-full flex gap-1 bg-muted text-muted-foreground border px-2 py-1 mb-2 select-none">
          <Icon name="info" className="size-4" />
          <p className="text-xs font-normal">
            Type <span className="font-bold">/</span> to insert a prompt.
          </p>
        </div>
      )}
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
