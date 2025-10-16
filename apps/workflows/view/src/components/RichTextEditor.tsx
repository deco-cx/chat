/**
 * Rich Text Editor with @ Mentions (Tiptap)
 * Minimal implementation
 */
import {
  useEditor,
  EditorContent,
  ReactNodeViewRenderer,
  ReactRenderer,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import tippy, { Instance as TippyInstance } from "tippy.js";
import { MentionNode } from "./MentionNode";
import { useMentionItems, type MentionItem } from "@/hooks/useMentionItems";
import { useStepEditorActions, useStepEditorPrompt } from "@/store/step-editor";
import { useRef, useEffect, useCallback, useMemo } from "react";
import WorkflowMentionDropdown from "./WorkflowMentionDropdown";

interface RichTextEditorProps {
  minHeight?: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function RichTextEditor({
  minHeight = "120px",
  placeholder = "Type @ to mention...",
  value,
  onChange,
}: RichTextEditorProps) {
  const mentions = useMentionItems();
  const { setPrompt } = useStepEditorActions();
  const globalPrompt = useStepEditorPrompt();

  // PERFORMANCE: Memoize initial content to prevent unnecessary recalculations
  const initialContent = useMemo(
    () => (value !== undefined ? value : globalPrompt),
    [], // Empty deps - only calculate once on mount
  );

  // Use ref to store mentions so they're accessible in closure without recreating editor
  const mentionsRef = useRef<MentionItem[]>(mentions);

  // PERFORMANCE: Debounce timer ref to prevent store updates on every keystroke
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Store onChange and setPrompt in refs to prevent editor recreation
  const onChangeRef = useRef(onChange);
  const setPromptRef = useRef(setPrompt);

  // Update ref when mentions change
  useEffect(() => {
    mentionsRef.current = mentions;
  }, [mentions]);

  // Update refs when props change (without causing editor recreation)
  useEffect(() => {
    onChangeRef.current = onChange;
    setPromptRef.current = setPrompt;
  }, [onChange, setPrompt]);

  // PERFORMANCE: Debounced onChange handler
  // Stores updates are expensive - batch them with 300ms delay
  // Using refs to keep this function stable and prevent editor recreation
  const debouncedOnChange = useCallback((text: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      if (onChangeRef.current) {
        onChangeRef.current(text);
      } else {
        setPromptRef.current(text);
      }
    }, 300); // 300ms debounce - good balance between UX and performance
  }, []); // Empty deps - stable function that uses refs

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // PERFORMANCE: Memoize editor extensions to prevent recreation on every render
  // Creating new extensions causes the entire editor to remount, which is very expensive
  const extensions = useMemo(
    () => [
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
            const currentMentions = mentionsRef.current;
            const filtered = currentMentions
              .filter((item) =>
                item.label.toLowerCase().includes(query.toLowerCase()),
              )
              // Sort to keep steps first, then tools
              .sort((a, b) => {
                if (a.type === "step" && b.type !== "step") return -1;
                if (a.type !== "step" && b.type === "step") return 1;
                return 0;
              })
              .slice(0, 20);
            return filtered;
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

                return (
                  (
                    component?.ref as { onKeyDown?: (props: any) => boolean }
                  )?.onKeyDown?.(props) || false
                );
              },
              command: ({ editor, range, props }: any) => {
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
    [placeholder],
  ); // Only recreate extensions if placeholder changes

  // PERFORMANCE: Memoize style object to prevent re-renders
  const editorStyle = useMemo(() => ({ minHeight }), [minHeight]);

  // PERFORMANCE: Track last internal value to detect external changes
  // This is more reliable than a boolean flag
  const lastInternalValueRef = useRef<string>("");

  const editor = useEditor(
    {
      extensions,
      onUpdate: ({ editor }) => {
        const text = editor.getText();
        // Track the internal value so we can detect external changes
        lastInternalValueRef.current = text;
        // PERFORMANCE: Use debounced handler to batch store updates
        debouncedOnChange(text);
      },
      content: initialContent, // Use memoized initial content
    },
    [extensions, initialContent],
  ); // Removed debouncedOnChange from deps since it's stable with empty deps

  // PERFORMANCE: Only update editor when value changes externally (not from typing)
  useEffect(() => {
    if (!editor || value === undefined) return;

    const currentText = editor.getText();

    // CRITICAL: Don't update if the text is already the same
    // This is the most important check - prevents ALL unnecessary updates
    if (currentText === value) return;

    // CRITICAL: Don't update if this matches our last internal value
    // This means the value prop change came from our own typing
    if (lastInternalValueRef.current === value) return;

    // Value changed externally (e.g., from undo/redo, external edit, etc.)
    // Update the editor content
    editor.commands.setContent(value);
    lastInternalValueRef.current = value;
  }, [editor, value]);

  return (
    <div className="relative">
      <EditorContent
        editor={editor}
        style={editorStyle}
        className="tiptap-editor p-4 bg-card border border-border rounded-xl text-foreground text-base leading-relaxed"
      />
    </div>
  );
}
