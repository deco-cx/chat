const BANNED_CLASS_NAMES_CONTAIN_VALUES = [
  "50",
  "100",
  "200",
  "300",
  "400",
  "500",
  "600",
  "700",
  "800",
  "900",
];

const CATEGORIES = [
  "bg",
  "text",
  "border",
  "ring",
  "shadow",
  "outline",
  "ring-offset",
];

// Helper function to check if a class uses design system tokens
function isValidDesignSystemToken(className: string): boolean {
  const withoutPrefix = className.split(":").at(-1);

  if (!withoutPrefix) {
    return true;
  }

  const parts = withoutPrefix.split("-");
  const category = parts[0];
  const value = parts.at(-1);

  if (!CATEGORIES.includes(category) || !value || value.length === 0) {
    return true;
  }

  return !BANNED_CLASS_NAMES_CONTAIN_VALUES.includes(value);
}

function handleLiteral({
  context,
  value,
  range,
}: {
  context: Deno.lint.RuleContext;
  value: string;
  range: Deno.lint.Range;
}) {
  const classes = value.split(" ");
  for (const className of classes) {
    if (!isValidDesignSystemToken(className)) {
      context.report({
        range,
        message: `Class "${className}" does not use design system tokens. Please use tokens from the design system.`,
      });
    }
  }
}

// Create the lint rule
const ensureTailwindDesignSystemTokens: Deno.lint.Plugin = {
  name: "ensure-tailwind-design-system-tokens",
  rules: {
    "ensure-tailwind-design-system-tokens": {
      create(context) {
        return {
          // Check JSX elements for className attributes
          JSXAttribute(node) {
            if (node.name.name === "className") {
              if (node.value?.type === "Literal") {
                handleLiteral({
                  context,
                  value: String(node.value.value),
                  range: node.value.range,
                });
              }

              if (node.value?.type === "JSXExpressionContainer") {
                if (node.value.expression.type === "CallExpression") {
                  const args = node.value.expression.arguments;
                  for (const arg of args) {
                    if (arg.type === "Literal") {
                      handleLiteral({
                        context,
                        value: String(arg.value),
                        range: arg.range,
                      });
                    }
                  }
                }
              }
            }
          },
        };
      },
    },
  },
};

export default ensureTailwindDesignSystemTokens;
