import type { Prompt } from "@deco/sdk";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance, type Props } from "tippy.js";
import MentionDropdown, { type Option } from "./dropdown.tsx";

export const suggestion: (
  items: Prompt[],
) => Partial<SuggestionOptions<Option>> = (items) => {
  return {
    char: "/",
    items: (props) => {
      const { query } = props;

      return [
        {
          id: "references",
          type: "category",
          label: "References",
          children: [
            {
              id: "prompts",
              type: "category",
              label: "Prompts",
              icon: "text_snippet",
              children: items
                .filter((prompt) =>
                  prompt.name.toLowerCase().includes(query?.toLowerCase()),
                )
                .map(
                  (prompt): Option => ({
                    id: prompt.id,
                    type: "option",
                    label: prompt.name,
                    icon: "text_snippet",
                    tooltip: prompt.content,
                    handle: ({ command }) =>
                      command({ id: prompt.id, label: prompt.name }),
                  }),
                )
                .slice(0, 10),
            },
            // {
            //   id: "tools",
            //   type: "category",
            //   label: "Tools",
            //   icon: "build",
            // },
            // {
            //   id: "tool_placeholder",
            //   type: "category",
            //   label: "Tool placeholder",
            //   icon: "build",
            // },
          ],
        },
      ];
    },
    render: () => {
      let component: ReactRenderer | null = null;
      let popup: Instance<Props>[] | null = null;

      return {
        onStart: (props) => {
          if (component) {
            component.destroy();
          }

          component = new ReactRenderer(MentionDropdown, {
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
  };
};
