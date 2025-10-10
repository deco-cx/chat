import { cn } from "@deco/ui/lib/utils.ts";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import TextAlign from "@tiptap/extension-text-align";
import TextStyle from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef } from "react";
import { Markdown } from "tiptap-markdown";
import { DocumentBubbleMenu } from "./extensions/bubble-menu.tsx";
import { createCombinedMentions, type Tool } from "./extensions/mentions.tsx";
import { createSlashCommands } from "../editor/slash-commands.tsx";
import type { ProjectLocator } from "@deco/sdk";
import { useIntegrations } from "@deco/sdk";

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
  const { data: integrations = [] } = useIntegrations();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Build tools array from integrations (like chat does)
  const tools: Tool[] = useMemo(() => {
    return integrations.flatMap((integration) =>
      (integration.tools || []).map(
        (tool: { name: string; description?: string }) => ({
          id: `${integration.id}-${tool.name}`,
          name: tool.name,
          description: tool.description,
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
          },
        }),
      ),
    );
  }, [integrations]);

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
        emptyNodeClass: "is-empty",
        showOnlyWhenEditable: true,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: "task-item",
        },
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: {
          class:
            "text-blue-500 hover:underline underline-offset-2 cursor-pointer transition-colors",
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      TextStyle,
      Color,
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      createSlashCommands({
        includeFormatting: true,
      }),
      createCombinedMentions(tools),
    ];
  }, [placeholder, locator, tools]);

  const editor = useEditor({
    extensions,
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-lg max-w-none w-full outline-none pb-20 break-words overflow-wrap-anywhere",
          className,
        ),
      },
    },
    onUpdate: ({ editor }) => {
      // Debounce all changes to prevent expensive markdown conversions on every keystroke
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        const markdown = editor.storage.markdown.getMarkdown();
        onChange(markdown);
      }, 300);
    },
  });

  // Store locator in editor storage for extensions
  useEffect(() => {
    if (editor) {
      (editor.storage as Record<string, unknown>).locator = locator;
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

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={cn("bg-background w-full max-w-full", className)}>
      <style>{`
        /* ProseMirror wrapping */
        .ProseMirror {
          width: 100%;
          max-width: 100%;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: pre-wrap;
        }

        /* Links - make them blue and clickable */
        .ProseMirror a {
          color: rgb(59 130 246) !important;
          text-decoration: underline;
          text-underline-offset: 2px;
          cursor: pointer !important;
          transition: color 0.15s ease;
        }
        
        .ProseMirror a:hover {
          text-decoration: none;
        }

        /* Base placeholder for all empty nodes */
        .ProseMirror p.is-empty::before {
          content: '${placeholder}';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        /* Heading placeholders */
        .ProseMirror h1.is-empty::before {
          content: 'Heading 1';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        .ProseMirror h2.is-empty::before {
          content: 'Heading 2';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        .ProseMirror h3.is-empty::before {
          content: 'Heading 3';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }
        
        /* List item placeholders */
        .ProseMirror li p.is-empty::before {
          content: 'List item';
          opacity: 0.5;
        }
        
        /* Blockquote placeholder */
        .ProseMirror blockquote p.is-empty::before {
          content: 'Quote';
          opacity: 0.5;
        }
        
        /* Code block placeholder */
        .ProseMirror pre code.is-empty::before {
          content: 'Code block';
          color: var(--muted-foreground);
          opacity: 0.5;
          pointer-events: none;
          float: left;
          height: 0;
        }

        /* Slash command placeholder */
        .ProseMirror .slash-command-placeholder {
          color: var(--muted-foreground);
          pointer-events: none;
          user-select: none;
        }

        /* Show "Filter..." after typing / */
        .ProseMirror .ProseMirror-widget-suggestion::after {
          content: 'Filter...';
          color: var(--muted-foreground);
          pointer-events: none;
          user-select: none;
        }
      `}</style>
      <DocumentBubbleMenu editor={editor} />
      <div className="w-full max-w-full overflow-hidden">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
