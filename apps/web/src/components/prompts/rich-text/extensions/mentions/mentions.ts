import type { Prompt } from "@deco/sdk";
import { toMention } from "@deco/sdk/utils";
import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import MentionNode from "./mention-node.tsx";
import { suggestion } from "../suggestions/suggestions.ts";

export const mentions = (
  prompts: Prompt[],
) => {
  const promptMap = new Map<string, Prompt>(
    prompts.map((prompt) => [prompt.id, prompt]),
  );

  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(MentionNode);
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
