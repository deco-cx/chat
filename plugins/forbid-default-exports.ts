const plugin: Deno.lint.Plugin = {
  name: "forbid-default-exports",
  rules: {
    "no-default-export": {
      create(context) {
        return {
          ExportDefaultDeclaration(node) {
            // Skip the rule if the file is in the plugins folder
            if (context.filename && context.filename.includes("plugins/")) {
              return;
            }

            context.report({
              node,
              message:
                "Default exports are not allowed. Use named exports instead (e.g., 'export { myFunction }' or 'export function myFunction() {}').",
            });
          },
        };
      },
    },
  },
};

export default plugin;
