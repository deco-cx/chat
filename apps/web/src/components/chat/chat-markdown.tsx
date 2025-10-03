import { marked } from "marked";
import { memo, Suspense, useCallback, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { lazy, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

const LazyHighlighter = lazy(() => import("./lazy-highlighter.tsx"));

function LazyHighlighterFallback() {
  const lines = [85, 70];

  return (
    <div
      className="p-4 font-mono text-sm"
      style={{
        background: "#2d2d2d",
        borderRadius: "0 0 0.5rem 0.5rem",
        overflow: "auto",
        minHeight: "4rem",
      }}
    >
      {lines.map((width, i) => (
        <div key={i} className="flex gap-2 items-center my-1">
          {i > 2 && i < 7 && (
            <div
              className="w-4 h-4 rounded-sm opacity-40 animate-pulse"
              style={{
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.1}s`,
              }}
            />
          )}

          {i % 4 === 0 && (
            <div
              className="h-4 rounded animate-pulse"
              style={{
                width: "3rem",
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.12}s`,
              }}
            />
          )}

          {i % 3 === 1 && (
            <div
              className="h-4 rounded animate-pulse"
              style={{
                width: "2.5rem",
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.14}s`,
              }}
            />
          )}

          <div
            className="h-4 rounded animate-pulse"
            style={{
              width: `${width}%`,
              background: "rgba(255, 255, 255, 0.1)",
              animationDelay: `${i * 0.1}s`,
            }}
          />

          {i % 5 === 2 && (
            <div
              className="h-4 rounded animate-pulse"
              style={{
                width: "4rem",
                background: "rgba(128, 128, 128, 0.3)",
                animationDelay: `${i * 0.16}s`,
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Table(props: React.HTMLAttributes<HTMLTableElement>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tableToCsv = useCallback((table: HTMLTableElement | null): string => {
    if (!table) return "";
    const rows = Array.from(table.querySelectorAll("tr"));
    return rows
      .map((row) =>
        Array.from(row.querySelectorAll("th,td"))
          .map((cell) => {
            let text = cell.textContent || "";
            text = text.replace(/"/g, '""');
            if (text.search(/([",\n])/g) >= 0) {
              text = `"${text}"`;
            }
            return text;
          })
          .join(","),
      )
      .join("\n");
  }, []);

  const handleCopyCsv = useCallback(async () => {
    const csv = tableToCsv(tableRef.current);
    await navigator.clipboard.writeText(csv);
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1200);
  }, [tableToCsv]);

  return (
    <>
      <div className="flex justify-end items-center">
        <Button
          variant="ghost"
          onClick={handleCopyCsv}
          aria-label="Copy as CSV"
          className="text-muted-foreground hover:text-foreground h-6 text-[10px]"
          type="button"
        >
          Copy as CSV
          <Icon name={copied ? "check" : "content_copy"} size={12} />
        </Button>
      </div>
      <div className="overflow-x-auto mb-4 rounded-lg border border-border">
        <table
          ref={tableRef}
          {...props}
          className="min-w-full border-collapse text-sm"
        >
          {props.children}
        </table>
      </div>
    </>
  );
}

const MemoizedMarkdownBlock = memo(
  ({ content }: { content: string }) => {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          p: (props) => <p {...props} className="leading-relaxed" />,
          strong: (props) => <strong {...props} className="font-bold" />,
          em: (props) => <em {...props} className="italic" />,
          a: (props) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline break-all"
            />
          ),
          ul: (props) => (
            <ul {...props} className="list-disc ml-6 my-4 space-y-2" />
          ),
          ol: (props) => (
            <ol {...props} className="list-decimal ml-6 my-4 space-y-2" />
          ),
          li: (props) => <li {...props} className="leading-relaxed" />,
          code: (props) => (
            <code
              {...props}
              className="px-1 py-0.5 bg-muted rounded text-sm font-mono break-all"
            />
          ),
          pre: (props) => (
            <pre
              {...props}
              className="flex max-w-[calc(640px-64px)] my-4 bg-muted rounded"
            >
              <code className="flex-1 min-w-0 p-4 text-sm font-mono whitespace-pre overflow-x-auto">
                {props.children}
              </code>
            </pre>
          ),
          table: (props) => <Table {...props} />,
          thead: (props) => (
            <thead {...props} className="bg-muted">
              {props.children}
            </thead>
          ),
          tr: (props) => (
            <tr
              {...props}
              className="even:bg-muted/50 border-b border-border last:border-0"
            />
          ),
          th: (props) => (
            <th
              {...props}
              className="px-4 py-2 text-left font-semibold text-muted-foreground border-b border-border"
            />
          ),
          td: (props) => (
            <td {...props} className="px-4 py-2 border-b border-border" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    );
  },
  (prevProps, nextProps) => prevProps.content === nextProps.content,
);

function CodeBlock({
  language,
  content,
}: {
  language: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    timeoutRef.current && clearTimeout(timeoutRef.current);
    // @ts-ignore - setTimeout returns number in browser
    timeoutRef.current = setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="my-4 rounded-lg bg-muted overflow-hidden border border-border grid">
      <div className="flex items-center justify-between p-1 pl-4 bg-muted border-b border-border">
        <span className="text-xs font-mono uppercase text-muted-foreground tracking-widest select-none">
          {language ? language : "text"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={handleCopy}
          aria-label="Copy code"
          className="text-muted-foreground hover:text-foreground rounded-lg h-8 w-8"
        >
          <Icon name={copied ? "check" : "content_copy"} size={14} />
        </Button>
      </div>

      <Suspense fallback={<LazyHighlighterFallback />}>
        <LazyHighlighter language={language} content={content} />
      </Suspense>
    </div>
  );
}

MemoizedMarkdownBlock.displayName = "MemoizedMarkdownBlock";

export const MemoizedMarkdown = ({
  messageId: id,
  part,
}: {
  messageId: string;
  part: {
    type: "text";
    text: string;
    state?: "streaming" | "done";
  };
}) => {
  const { text: content = "" } = part;
  const blocks = useMemo(() => marked.lexer(content), [content]);

  return blocks.map((block, index) => {
    if (block.type === "code") {
      return (
        <CodeBlock
          language={block.lang}
          content={block.text}
          key={`${id}-block_${index}`}
        />
      );
    }

    return (
      <MemoizedMarkdownBlock content={block.raw} key={`${id}-block_${index}`} />
    );
  });
};

MemoizedMarkdown.displayName = "MemoizedMarkdown";
