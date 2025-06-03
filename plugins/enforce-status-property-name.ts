const plugin: Deno.lint.Plugin = {
  name: "enforce-status-property-name",
  rules: {
    "status-property-name": {
      create(context) {
        return {
          Identifier(node) {
            // Skip if this is a property access (e.g. toast.success)
            if (
              node.parent?.type === "MemberExpression" &&
              node.parent.property === node
            ) {
              return;
            }

            if (node.name === "success") {
              context.report({
                node,
                message:
                  "Status property name should be called 'ok' instead of 'success'",
                fix: (fixer) => fixer.replaceText(node, "ok"),
              });
            }
          },
        };
      },
    },
  },
};
export default plugin;
