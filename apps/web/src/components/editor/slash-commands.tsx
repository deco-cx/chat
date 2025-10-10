import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance, type Props } from "tippy.js";
import SlashCommandsDropdown, {
  type SlashCommandOption,
} from "./slash-commands-dropdown.tsx";

export interface SlashCommandsConfig {
  includeFormatting?: boolean;
}

export function createSlashCommands(config: SlashCommandsConfig = {}) {
  const {
    includeFormatting = true,
  } = config;

  return Extension.create({
    name: "slashCommands",

    addProseMirrorPlugins() {
      return [
        // @ts-ignore - Partial options are valid for Suggestion
        Suggestion({
          editor: this.editor,
          char: "/",
          pluginKey: new PluginKey("slashCommands"),
          allow: ({ state, range }) => {
            const $from = state.doc.resolve(range.from);
            const type = state.schema.nodes.paragraph;
            
            // Only allow slash commands at the start of a line or after whitespace
            const isAtStart = $from.parent.type === type && $from.parent.textContent.charAt(range.from - $from.start() - 1) === '';
            return isAtStart || $from.parent.textContent.charAt(range.from - $from.start() - 1) === ' ';
          },
          items: ({ query }) => {
            const categories: SlashCommandOption[] = [];

            // Formatting category
            if (includeFormatting) {
              categories.push({
                id: "formatting",
                type: "category",
                label: "Formatting",
                children: [
                  {
                    icon: "format_h1",
                    id: "heading-1",
                    type: "option",
                    label: "Heading 1",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .setHeading({ level: 1 })
                        .run();
                    },
                  },
                  {
                    icon: "format_h2",
                    id: "heading-2",
                    type: "option",
                    label: "Heading 2",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .setHeading({ level: 2 })
                        .run();
                    },
                  },
                  {
                    icon: "format_h3",
                    id: "heading-3",
                    type: "option",
                    label: "Heading 3",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .setHeading({ level: 3 })
                        .run();
                    },
                  },
                  {
                    icon: "format_list_bulleted",
                    id: "bullet-list",
                    type: "option",
                    label: "Bullet List",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .toggleBulletList()
                        .run();
                    },
                  },
                  {
                    icon: "format_list_numbered",
                    id: "numbered-list",
                    type: "option",
                    label: "Numbered List",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .toggleOrderedList()
                        .run();
                    },
                  },
                  {
                    icon: "checklist",
                    id: "task-list",
                    type: "option",
                    label: "Task List",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .toggleTaskList()
                        .run();
                    },
                  },
                  {
                    icon: "format_quote",
                    id: "blockquote",
                    type: "option",
                    label: "Blockquote",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .toggleBlockquote()
                        .run();
                    },
                  },
                  {
                    icon: "code",
                    id: "code-block",
                    type: "option",
                    label: "Code Block",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .setCodeBlock()
                        .run();
                    },
                  },
                  {
                    icon: "horizontal_rule",
                    id: "divider",
                    type: "option",
                    label: "Divider",
                    handle: ({ editor, range }) => {
                      editor
                        .chain()
                        .focus()
                        .deleteRange(range)
                        .setHorizontalRule()
                        .run();
                    },
                  },
                ],
              });
            }

            return categories;
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: Instance<Props>[] | null = null;

            return {
              onStart: (props) => {
                if (component) {
                  component.destroy();
                }

                component = new ReactRenderer(SlashCommandsDropdown, {
                  props,
                  editor: props.editor,
                });

                if (!props.clientRect) {
                  return;
                }

                // @ts-expect-error - tippy is not well typed
                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component?.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                });
              },

              onUpdate(props) {
                component?.updateProps(props);

                popup?.[0]?.setProps({
                  // @ts-expect-error - tippy is not well typed
                  getReferenceClientRect: props.clientRect,
                });
              },

              onKeyDown(props) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }

                // @ts-expect-error - component.ref is not typed
                return component?.ref?.onKeyDown(props);
              },

              onExit() {
                popup?.[0]?.destroy?.();
                component?.destroy?.();
              },
            };
          },
        } as Partial<SuggestionOptions>),
      ];
    },
  });
}

