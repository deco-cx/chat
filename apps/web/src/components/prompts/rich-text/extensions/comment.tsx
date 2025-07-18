import { InputRule, mergeAttributes, Node } from "@tiptap/react";

declare module "@tiptap/react" {
  interface Commands<ReturnType> {
    comment: {
      /**
       * Set a comment node
       * @param attributes The comment attributes
       * @example editor.commands.setComment({ content: "Hello" })
       */
      setComment: (attributes?: { content?: string }) => ReturnType;
    };
  }
}

export const Comment = Node.create({
  name: "comment",
  group: "block",
  marks: "",
  code: true,
  content: "text*",
  parseHTML() {
    return [
      {
        tag: "span",
        attrs: {
          "data-type": "comment",
        },
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-type": "comment",
      }),
      0,
    ];
  },
  renderText({ node }) {
    return `// ${node.textContent}`;
  },
  addCommands() {
    return {
      setComment:
        () =>
        ({ commands }) => {
          return commands.insertContent([
            {
              type: "comment",
              content: [{ type: "text", text: " " }],
            },
          ]);
        },
    };
  },
  addInputRules() {
    return [
      new InputRule({
        find: /^\/\/$/,
        handler: ({ range, commands }) => {
          commands.command(() => {
            commands.deleteRange(range);
            commands.insertContent([
              {
                type: "comment",
                content: [{ type: "text", text: " " }],
              },
            ]);
            return true;
          });
        },
      }),
    ];
  },
});
