import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type ReactNode, useState } from "react";

export function CodeBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof children === "string") {
      navigator.clipboard.writeText(children);
    } else {
      // If children is not a string, attempt to convert it to a string
      const text = String(children);
      navigator.clipboard.writeText(text);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="relative group">
      <pre
        className={cn(
          "rounded-md bg-muted p-2 text-xs font-mono whitespace-pre-wrap pr-10",
          className,
        )}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-0 right-0 p-2 cursor-pointer"
        aria-label="Copy to clipboard"
      >
        <Icon name={copied ? "check" : "content_copy"} />
      </button>
    </div>
  );
}
