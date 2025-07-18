import type { Prompt } from "@deco/sdk";
import { toMention } from "@deco/sdk/utils";
import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { suggestion } from "../suggestions/suggestions.ts";
import MentionNode from "./mention-node.tsx";

export const mentions = (prompts: Prompt[]) => {
  const promptMap = new Map<string, Prompt>(
    prompts.map((prompt) => [prompt.id, prompt]),
  );

  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(MentionNode);
    },
    addAttributes() {
      return {
        type: { default: "mention" },
        id: { default: "" },
        label: { default: "" },
        mentionType: { default: "prompt" },
      };
    },
    parseHTML() {
      return [
        {
          tag: 'span[data-type="mention"]',
          getAttrs: (node) => {
            if (!(node instanceof HTMLElement)) return false;

            const id = node.getAttribute("data-id");
            if (!id) return false;

            return {
              id,
              mentionType: node.getAttribute("data-mention-type"),
              label: promptMap.get(id)?.name,
            };
          },
        },
      ];
    },
    renderHTML({ node }) {
      return [
        "span",
        {
          "data-type": "mention",
          "data-id": node.attrs.id,
          "data-mention-type": node.attrs.mentionType,
        },
        `${node.attrs.label}`,
      ];
    },
  }).configure({
    suggestion: suggestion(prompts ?? []),
    renderText({ node }) {
      const prompt = promptMap.get(node.attrs.id) || node.attrs.id;
      return toMention(prompt.id, "prompt");
    },
  });
};
