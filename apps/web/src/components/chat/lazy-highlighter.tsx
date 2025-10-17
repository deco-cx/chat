import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
// @ts-ignore - correct
import { tomorrow } from "react-syntax-highlighter/dist/esm/styles/prism/index.js";

interface LazyHighlighterProps {
  language: string;
  content: string;
  fillHeight?: boolean;
}

function LazyHighlighter({
  language,
  content,
  fillHeight = false,
}: LazyHighlighterProps) {
  return (
    <SyntaxHighlighter
      language={language || "text"}
      style={tomorrow}
      customStyle={{
        margin: 0,
        padding: "1rem",
        fontSize: "0.8rem",
        borderRadius: "0.5rem",
        background: "#263238",
        position: "relative",
        overflowX: "hidden",
        overflowY: "visible",
        width: "100%",
        maxWidth: "100%",
        display: "block",
        wordBreak: "break-word",
        overflowWrap: "break-word",
        ...(fillHeight ? { height: "100%", minHeight: "100%" } : {}),
      }}
      codeTagProps={{
        className: "font-mono",
        style: {
          wordBreak: "break-word",
          overflowWrap: "break-word",
          whiteSpace: "pre-wrap",
        },
      }}
      wrapLongLines
    >
      {content}
    </SyntaxHighlighter>
  );
}

export default LazyHighlighter;
