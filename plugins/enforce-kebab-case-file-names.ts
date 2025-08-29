const plugin: Deno.lint.Plugin = {
  // The name of your plugin. Will be shown in error output
  name: "enforce-kebab-case-file-names",
  // Object with rules. The property name is the rule name and
  // will be shown in the error output as well.
  rules: {
    "kebab-case": {
      // Inside the `create(context)` method is where you'll put your logic.
      // It's called when a file is being linted.
      create(context) {
        // Return an AST visitor object
        return {
          Program(node) {
            if (context.filename) {
              // Get the filename without extension
              let filename = context.filename.split("/").pop()?.split(".")[0];

              // allow test files to be named with _test suffix
              if (filename?.endsWith("_test")) {
                filename = filename.slice(0, -5);
              }

              if (filename) {
                // Check if filename matches kebab-case pattern
                const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

                if (!kebabCasePattern.test(filename)) {
                  context.report({
                    node,
                    message: `Filename "${filename}" should be in kebab-case format (e.g., "my-component.tsx")`,
                  });
                }
              }
            }
          },
        };
      },
    },
  },
};

export default plugin;
