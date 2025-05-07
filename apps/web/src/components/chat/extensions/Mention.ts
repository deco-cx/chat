import MentionExtension from "@tiptap/extension-mention";
import type { MentionOptions } from "@tiptap/extension-mention";
import { Editor } from "@tiptap/react";
import type { Integration } from "@deco/sdk";
import { ReactRenderer } from "@tiptap/react";
import type { Instance as TippyInstance } from "tippy.js";
import tippy from "tippy.js";
import {
  MentionList,
  type MentionListRef,
} from "../components/MentionList.tsx";

export type MentionItem = Integration;

export interface GroupedItems {
  [key: string]: MentionItem[];
}

export type Suggestion = MentionOptions["suggestion"];

export const Mention = (suggestion: Suggestion) =>
  MentionExtension.configure({
    HTMLAttributes: {
      class: "mention",
      "data-type": "mention",
    },
    renderText({ node }) {
      return `@${node.attrs.label || node.attrs.name}`;
    },
    renderHTML({ node }) {
      return [
        "span",
        {
          "data-type": "mention",
          class: "mention",
        },
        `@${node.attrs.label || node.attrs.name}`,
      ];
    },
    suggestion,
  }).extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        id: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-id"),
          renderHTML: (attributes) => {
            return { "data-id": attributes.id };
          },
        },
        label: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-label"),
          renderHTML: (attributes) => {
            return { "data-label": attributes.label };
          },
        },
        name: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-name"),
          renderHTML: (attributes) => {
            return { "data-name": attributes.name };
          },
        },
        description: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-description"),
          renderHTML: (attributes) => {
            return { "data-description": attributes.description };
          },
        },
        icon: {
          default: null,
          parseHTML: (element) => element.getAttribute("data-icon"),
          renderHTML: (attributes) => {
            return { "data-icon": attributes.icon };
          },
        },
        connection: {
          default: null,
          parseHTML: (element) => {
            const connection = element.getAttribute("data-connection");
            return connection ? JSON.parse(connection) : null;
          },
          renderHTML: (attributes) => {
            return { "data-connection": JSON.stringify(attributes.connection) };
          },
        },
      };
    },
  });

export interface UseMentionSuggestionProps {
  integrations?: Integration[];
}

export const useMentionSuggestion = (
  { integrations = [] }: UseMentionSuggestionProps = {},
): Suggestion => {
  return {
    items: ({ query }: { query: string; editor: Editor }) => {
      return integrations
        .filter((integration) =>
          integration.name.toLowerCase().includes(query.toLowerCase())
        )
        .map((integration) => ({
          id: integration.id,
          label: integration.name,
          name: integration.name,
          description: integration.description,
          icon: integration.icon,
          connection: integration.connection,
          type: "mention",
        }));
    },
    render: () => {
      let reactRenderer: ReactRenderer | null = null;
      let popup: TippyInstance[] | null = null;

      return {
        onStart: (props) => {
          if (!props.clientRect) {
            return;
          }

          reactRenderer = new ReactRenderer(MentionList, {
            props,
            editor: props.editor,
          });

          const element = document.createElement("div");
          document.body.appendChild(element);

          // @ts-ignore - tippy typing issue
          popup = tippy("body", {
            getReferenceClientRect: () => props.clientRect?.() || new DOMRect(),
            appendTo: () => document.body,
            content: reactRenderer.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
            theme: "light",
          });
        },

        onUpdate: (props) => {
          if (!props.clientRect || !reactRenderer || !popup) {
            return;
          }

          reactRenderer.updateProps(props);
          popup[0].setProps({
            getReferenceClientRect: () => props.clientRect?.() || new DOMRect(),
          });
        },

        onKeyDown: (props) => {
          if (!reactRenderer?.ref) {
            return false;
          }
          return (reactRenderer.ref as MentionListRef).onKeyDown(props);
        },

        onExit: () => {
          if (popup && reactRenderer) {
            popup[0].destroy();
            reactRenderer.destroy();
          }
        },
      };
    },
    char: "@",
    allowSpaces: true,
  };
};
