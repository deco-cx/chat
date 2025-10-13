/**
 * Rich Text Editor with @ Mentions (Tiptap)
 * Minimal implementation
 */
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { ReactRenderer } from "@tiptap/react";
import MentionNode from "./MentionNode";
import WorkflowMentionDropdown from "./WorkflowMentionDropdown";
import type { MentionItem } from "../hooks/useMentionItems";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  mentions?: MentionItem[];
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Type @ to mention...",
  mentions = [],
  minHeight = "120px",
}: RichTextEditorProps) {
  console.log(
    "🎨 [RichTextEditor] Received mentions:",
    mentions.length,
    mentions,
  );

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      Mention.extend({
        addAttributes() {
          return {
            id: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-id"),
              renderHTML: (attributes) => ({ "data-id": attributes.id }),
            },
            label: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-label"),
              renderHTML: (attributes) => ({ "data-label": attributes.label }),
            },
            type: {
              default: "tool",
              parseHTML: (element) => element.getAttribute("data-type"),
              renderHTML: (attributes) => ({ "data-type": attributes.type }),
            },
            property: {
              default: null,
              parseHTML: (element) => element.getAttribute("data-property"),
              renderHTML: (attributes) => {
                return attributes.property
                  ? { "data-property": attributes.property }
                  : {};
              },
            },
            integration: {
              default: null,
              parseHTML: (element) => {
                const data = element.getAttribute("data-integration");
                return data ? JSON.parse(data) : null;
              },
              renderHTML: (attributes) => {
                return attributes.integration
                  ? {
                      "data-integration": JSON.stringify(
                        attributes.integration,
                      ),
                    }
                  : {};
              },
            },
          };
        },
        addNodeView() {
          return ReactNodeViewRenderer(MentionNode);
        },
      }).configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          items: ({ query }) => {
            console.log(
              "🔎 [Tiptap] Filtering mentions - Query:",
              query,
              "Available mentions:",
              mentions.length,
            );
            console.log("🔎 [Tiptap] All mentions:", mentions);
            console.log(
              "🔎 [Tiptap] Tools in mentions:",
              mentions
                .filter((m) => m.type === "tool")
                .map((m) => ({ id: m.id, label: m.label })),
            );
            console.log(
              "🔎 [Tiptap] Steps in mentions:",
              mentions
                .filter((m) => m.type === "step")
                .map((m) => ({ id: m.id, label: m.label })),
            );

            const filtered = mentions
              .filter((item) =>
                item.label.toLowerCase().includes(query.toLowerCase()),
              )
              .slice(0, 20);

            console.log(
              "🔎 [Tiptap] Filtered results:",
              filtered.length,
              filtered,
            );
            console.log(
              "🔎 [Tiptap] Filtered tools:",
              filtered.filter((f) => f.type === "tool").length,
            );
            console.log(
              "🔎 [Tiptap] Filtered steps:",
              filtered.filter((f) => f.type === "step").length,
            );

            const result = filtered.map((item) => ({
              ...item,
              // Ensure integration is available for tool mentions
              integration:
                item.type === "tool" && "integration" in item
                  ? item.integration
                  : undefined,
            }));

            console.log("🔎 [Tiptap] Returning items:", result);
            return result;
          },
          render: () => {
            let popup: TippyInstance | undefined;
            let component: ReactRenderer | null = null;

            return {
              onStart: (props: any) => {
                if (component) {
                  component.destroy();
                }

                component = new ReactRenderer(WorkflowMentionDropdown, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy(document.body, {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  maxWidth: 400,
                });
              },
              onUpdate: (props: any) => {
                component?.updateProps(props);
                popup?.setProps({
                  getReferenceClientRect: props.clientRect,
                });
              },
              onKeyDown: (props: any) => {
                if (props.event.key === "Escape") {
                  popup?.hide();
                  return true;
                }

                return component?.ref?.onKeyDown?.(props) || false;
              },
              command: ({ editor, range, props }: any) => {
                console.log("🔨 [Mention] Inserting mention:", props);

                editor
                  .chain()
                  .focus()
                  .deleteRange(range)
                  .insertContent({
                    type: "mention",
                    attrs: {
                      id: props.id,
                      label: props.label,
                      type: props.type,
                      property: props.property,
                      integration: props.integration,
                    },
                  })
                  .run();
              },
              onExit: () => {
                popup?.destroy();
                component?.destroy();
              },
            };
          },
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      // Serialize mentions to their IDs instead of labels
      const json = editor.getJSON();
      let text = "";

      function extractText(node: any): void {
        if (node.type === "text") {
          text += node.text || "";
        } else if (node.type === "mention") {
          // Use the mention ID (which includes @) plus property if present
          const id = node.attrs?.id || "";
          const property = node.attrs?.property;
          text += property ? `${id}.${property}` : id;
        } else if (node.content) {
          node.content.forEach(extractText);
        }
      }

      if (json.content) {
        json.content.forEach(extractText);
      }

      onChange(text);
    },
  }); // Removed dependencies to prevent recreation

  useEffect(() => {
    if (!editor) return;

    // Only update if the value prop differs from current editor state
    const currentText = editor.getText();
    if (value === currentText) return;

    // Parse @mentions from the value string and convert to Tiptap JSON structure
    // Match patterns like: @tool-name, @step_xxx, @step_xxx.output, @step_xxx.title, etc.
    const mentionRegex = /@([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_]+)?)/g;
    const parts: any[] = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(value)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          text: value.substring(lastIndex, match.index),
        });
      }

      const fullMatch = match[0]; // e.g., @step_xxx.output or @tool-name
      const withoutAt = match[1]; // e.g., step_xxx.output or tool-name

      // Check if it has a property accessor (e.g., step_xxx.output)
      const dotIndex = withoutAt.indexOf(".");
      const baseId =
        dotIndex > -1 ? withoutAt.substring(0, dotIndex) : withoutAt;
      const property = dotIndex > -1 ? withoutAt.substring(dotIndex + 1) : null;

      // Find the mention item from our mentions array (match by base ID with @)
      const mentionItem = mentions.find((m) => m.id === `@${baseId}`);

      if (mentionItem) {
        // Add as a proper mention node with the property path
        parts.push({
          type: "mention",
          attrs: {
            id: mentionItem.id,
            label: mentionItem.label,
            type: mentionItem.type,
            property: property, // e.g., "output", "title", etc.
            integration:
              mentionItem.type === "tool" && "integration" in mentionItem
                ? mentionItem.integration
                : undefined,
          },
        });
      } else {
        // If not found in mentions, still render as text (fallback)
        parts.push({
          type: "text",
          text: fullMatch,
        });
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push({
        type: "text",
        text: value.substring(lastIndex),
      });
    }

    // Set content as structured JSON if we found mentions, otherwise plain text
    if (parts.length > 0 && parts.some((p) => p.type === "mention")) {
      editor.commands.setContent({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: parts,
          },
        ],
      });
    } else {
      editor.commands.setContent(value);
    }
  }, [value, editor, mentions]);

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        style={{ minHeight }}
        className="tiptap-editor px-3 py-2 bg-background border border-input rounded-xl text-foreground text-base md:text-sm shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] outline-none"
      />
      <style>{`
        .tiptap-editor .ProseMirror {
          outline: none;
          min-height: ${minHeight};
        }
        .tiptap-editor .ProseMirror p.is-editor-empty:first-child::before {
          color: var(--color-muted-foreground);
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .tiptap-editor .ProseMirror p {
          margin: 0;
        }
      `}</style>
    </div>
  );
}
