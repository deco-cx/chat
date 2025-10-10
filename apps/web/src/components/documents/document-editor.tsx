import { cn } from "@deco/ui/lib/utils.ts";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { Markdown } from "tiptap-markdown";
import { DocumentBubbleMenu } from "./extensions/bubble-menu.tsx";
import { createCombinedMentions } from "./extensions/mentions.tsx";
import { SlashCommands } from "./extensions/slash-commands.tsx";
import type { ProjectLocator } from "@deco/sdk";

interface DocumentEditorProps {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  locator: ProjectLocator;
}

export function DocumentEditor({
  value,
  onChange,
  placeholder = "Write, type / for commands or @ for tools...",
  className,
  disabled = false,
  locator,
}: DocumentEditorProps) {
  const extensions: Extensions = useMemo(() => {
    return [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      Placeholder.configure({
        placeholder,
        emptyNodeClass: 'is-empty',
        showOnlyWhenEditable: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-2 hover:text-primary/80",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      Highlight.configure({
        multicolor: true,
      }),
      SlashCommands,
      createCombinedMentions(),
    ];
  }, [placeholder]);

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none min-h-[500px] outline-none px-8 py-6",
          "prose-headings:font-bold prose-headings:tracking-tight",
          "prose-h1:text-4xl prose-h1:mt-8 prose-h1:mb-4",
          "prose-h2:text-3xl prose-h2:mt-6 prose-h2:mb-3",
          "prose-h3:text-2xl prose-h3:mt-4 prose-h3:mb-2",
          "prose-p:my-3 prose-p:leading-7",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic",
          "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
          "prose-pre:bg-muted prose-pre:p-4 prose-pre:rounded-lg",
          "prose-ul:my-4 prose-ul:list-disc prose-ul:pl-6",
          "prose-ol:my-4 prose-ol:list-decimal prose-ol:pl-6",
          "prose-li:my-1",
          "[&_ul[data-type='taskList']]:list-none [&_ul[data-type='taskList']]:pl-0",
          "[&_li[data-type='taskItem']]:flex [&_li[data-type='taskItem']]:items-start [&_li[data-type='taskItem']]:gap-2",
          className,
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.storage.markdown.getMarkdown();
      onChange(markdown);
    },
  });

  // Store locator in editor storage for extensions
  useEffect(() => {
    if (editor) {
      (editor.storage as any).locator = locator;
    }
  }, [editor, locator]);

  // Sync editor content with value prop changes
  useEffect(() => {
    if (!editor) return;

    const currentContent = editor.storage.markdown.getMarkdown();
    if (value !== currentContent) {
      try {
        editor.commands.setContent(value, false);
      } catch (error) {
        console.error("Failed to set editor content:", error);
      }
    }
  }, [value, editor]);

  // Sync editable state
  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className={cn("w-full bg-background", className)}>
      <style>{`
        /* Base placeholder for all empty nodes */
        .ProseMirror p.is-empty::before {
          content: '${placeholder}';
          color: var(--muted-foreground, #9ca3af);
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        /* Heading placeholders */
        .ProseMirror h1.is-empty::before {
          content: 'Heading 1';
          color: var(--muted-foreground, #9ca3af);
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        .ProseMirror h2.is-empty::before {
          content: 'Heading 2';
          color: var(--muted-foreground, #9ca3af);
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        .ProseMirror h3.is-empty::before {
          content: 'Heading 3';
          color: var(--muted-foreground, #9ca3af);
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        /* List item placeholders */
        .ProseMirror li p.is-empty::before {
          content: 'List item';
        }
        
        /* Blockquote placeholder */
        .ProseMirror blockquote p.is-empty::before {
          content: 'Quote';
        }
        
        /* Code block placeholder */
        .ProseMirror pre code.is-empty::before {
          content: 'Code block';
          color: var(--muted-foreground, #9ca3af);
          pointer-events: none;
          float: left;
          height: 0;
        }
      `}</style>
      <DocumentBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

