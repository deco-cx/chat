import type { Message } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useMemo, useState } from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";
import { ToolMessage } from "./tool-message.tsx";
import { ReasoningPart } from "./reasoning-part.tsx";
import { useFile } from "@deco/sdk";
import { toast } from "@deco/ui/components/sonner.tsx";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
  isLastMessage?: boolean;
}

interface MessagePart {
  type: "text" | "tool-invocation-group" | "reasoning" | "image";
  content?: string;
  toolInvocations?: NonNullable<Message["toolInvocations"]>;
  reasoning?: string;
  image?: string;
}

interface MessageAttachment {
  contentType?: string;
  url: string;
  name?: string;
}

interface TextPart {
  type: "text";
  text: string;
}

interface ToolPart {
  type: "tool-invocation";
  toolInvocation: NonNullable<Message["toolInvocations"]>[0];
}

interface ImagePart {
  type: "image";
  image: string;
}

interface ReasoningPart {
  type: "reasoning";
  reasoning: string;
}

type Part = TextPart | ToolPart | ReasoningPart | ImagePart;

function mergeParts(parts: Part[] | undefined): MessagePart[] {
  if (!parts) return [];

  const mergedParts: MessagePart[] = [];
  let currentToolGroup: NonNullable<Message["toolInvocations"]> = [];
  let currentTextContent: string[] = [];
  let currentReasoning: string[] = [];
  let currentImage: string[] = [];
  const flushToolGroup = () => {
    if (currentToolGroup.length > 0) {
      mergedParts.push({
        type: "tool-invocation-group",
        toolInvocations: [...currentToolGroup],
      });
      currentToolGroup = [];
    }
  };

  const flushTextContent = () => {
    if (currentTextContent.length > 0) {
      mergedParts.push({
        type: "text",
        content: currentTextContent.join("\n").trim(),
      });
      currentTextContent = [];
    }
  };

  const flushReasoning = () => {
    if (currentReasoning.length > 0) {
      mergedParts.push({
        type: "reasoning",
        reasoning: currentReasoning.join("\n").trim(),
      });
      currentReasoning = [];
    }
  };

  const flushImage = () => {
    if (currentImage.length > 0) {
      mergedParts.push({
        type: "image",
        image: currentImage.join("\n").trim(),
      });
      currentImage = [];
    }
  };

  parts.forEach((part) => {
    if (part.type === "tool-invocation") {
      // If we have pending text content or reasoning, flush them first
      flushTextContent();
      flushReasoning();
      currentToolGroup.push(part.toolInvocation);
    } else if (part.type === "text") {
      // If we have pending tool invocations or reasoning, flush them first
      flushToolGroup();
      flushReasoning();
      // Only add non-empty text parts
      if (part.text.trim()) {
        currentTextContent.push(part.text);
      }
    } else if (part.type === "reasoning") {
      // If we have pending tool invocations, flush them first
      flushToolGroup();
      currentReasoning.push(part.reasoning);
    } else if (part.type === "image") {
      flushToolGroup();
      flushReasoning();
      flushTextContent();
      currentImage.push(part.image);
    }
  });

  // Flush any remaining content in the correct order: tools -> reasoning -> text
  flushToolGroup();
  flushReasoning();
  flushTextContent();
  flushImage();

  return mergedParts;
}

export function ChatMessage({
  message,
  isStreaming = false,
  isLastMessage = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const timestamp = new Date(
    message.createdAt || Date.now(),
  ).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const attachments = message.experimental_attachments as
    | MessageAttachment[]
    | undefined;

  const handleCopy = async () => {
    const content = message.parts
      ? (message.parts as Part[])
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n")
      : message.content;
    await navigator.clipboard.writeText(content);
    toast("Copied to clipboard");
  };

  const mergedParts = useMemo(
    () => mergeParts(message.parts as Part[]),
    [message.parts],
  );

  const hasTextContent = useMemo(() => {
    return (
      (message.parts as Part[])?.some((part) => part.type === "text") ||
      message.content
    );
  }, [message.parts, message.content]);

  const isReasoningStreaming = useMemo(() => {
    if (!isStreaming) return false;
    // If we have parts and the last part is reasoning, it's streaming
    if (message.parts && message.parts.length > 0) {
      const lastPart = message.parts[message.parts.length - 1];
      return lastPart.type === "reasoning";
    }
    return false;
  }, [message.parts, isStreaming]);

  const isResponseStreaming = useMemo(() => {
    if (!isStreaming) return false;
    // If we have parts and the last part is text, it's streaming
    if (message.parts && message.parts.length > 0) {
      const lastPart = message.parts[message.parts.length - 1];
      return lastPart.type === "text";
    }
    return false;
  }, [message.parts, isStreaming]);

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex items-start gap-4 px-4 z-20 text-foreground group",
        isUser ? "flex-row-reverse py-4" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-1 min-w-0",
          isUser ? "items-end max-w-[70%]" : "w-full items-start",
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timestamp}</span>
        </div>

        <div
          className={cn(
            "w-full min-w-0 not-only:rounded-2xl text-base break-words overflow-wrap-anywhere",
            isUser ? "bg-muted p-3" : "bg-transparent",
          )}
        >
          {message.parts ? (
            <div className="space-y-2 w-full min-w-0">
              {mergedParts.map((part, index) => {
                if (part.type === "reasoning") {
                  const isLastReasoningPart = mergedParts
                    .slice(index + 1)
                    .every((p) => p.type !== "reasoning");
                  return (
                    <ReasoningPart
                      key={index}
                      reasoning={part.reasoning || ""}
                      messageId={message.id}
                      index={index}
                      isStreaming={isLastReasoningPart && isReasoningStreaming}
                      isResponseStreaming={isResponseStreaming}
                    />
                  );
                } else if (part.type === "text") {
                  return (
                    <MemoizedMarkdown
                      key={index}
                      id={`${message.id}-${index}`}
                      content={part.content || ""}
                    />
                  );
                } else if (part.type === "image") {
                  if (!part.image) return null;
                  return <ImagePart image={part.image} key={index} />;
                } else if (
                  part.type === "tool-invocation-group" &&
                  part.toolInvocations
                ) {
                  return (
                    <ToolMessage
                      key={index}
                      toolInvocations={part.toolInvocations}
                      isLastMessage={isLastMessage}
                    />
                  );
                }
                return null;
              })}
            </div>
          ) : (
            <MemoizedMarkdown id={message.id} content={message.content} />
          )}

          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map(
                (attachment: MessageAttachment, index: number) => (
                  <AttachmentCard
                    key={`${message.id}-${index}`}
                    attachment={attachment}
                  />
                ),
              )}
            </div>
          )}

          {!isUser && hasTextContent && (
            <div className="mt-2 flex w-full min-h-[28px] items-center justify-end gap-2 text-xs text-muted-foreground opacity-0 pointer-events-none transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto">
              <div className="flex gap-1">
                <Button
                  onClick={handleCopy}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground px-2 py-1 h-auto whitespace-nowrap"
                >
                  <Icon name="content_copy" className="mr-1 text-sm" />
                  Copy message
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ImagePart({ image }: { image: string }) {
  const { data: fileUrl } = useFile(image);

  if (!fileUrl) return null;

  return (
    <img
      src={fileUrl}
      alt={image}
      className="rounded-lg max-h-[300px] object-cover"
    />
  );
}

function AttachmentCard({ attachment }: { attachment: MessageAttachment }) {
  const contentType =
    attachment.contentType ||
    (attachment.url.startsWith("data:")
      ? attachment.url.split(":")[1]?.split(";")[0]
      : undefined) ||
    "application/octet-stream";
  const isImage = contentType.startsWith("image/");
  const isPDF = contentType.startsWith("application/pdf");
  const isText =
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType.endsWith("+json") ||
    contentType.endsWith("+xml") ||
    contentType === "application/xml";

  if (isImage) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group flex items-center gap-2 p-2 bg-muted rounded-xl border border-border hover:bg-muted/50 transition-colors"
      >
        <div className="relative">
          <img
            src={attachment.url}
            alt={attachment.name ?? `attachment`}
            className="rounded-lg max-h-[300px] object-cover"
          />
        </div>
      </a>
    );
  }

  if (isPDF) {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative group flex items-center gap-2 p-2 bg-muted rounded-xl border border-border hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
            <Icon name="picture_as_pdf" className="text-muted-foreground" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-xs text-foreground font-medium truncate max-w-[220px]">
              {attachment.name ?? "PDF Document"}
            </span>
            <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
              {contentType}
            </span>
          </div>
        </div>
      </a>
    );
  }

  if (isText) {
    return (
      <TextPreviewCard attachment={attachment} contentType={contentType} />
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="relative group flex items-center gap-2 p-2 bg-muted rounded-xl border border-border hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted">
          <Icon name="attach_file" className="text-muted-foreground" />
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-foreground font-medium truncate max-w-[220px]">
            {attachment.name ?? "Document"}
          </span>
          <span className="text-[10px] text-muted-foreground truncate max-w-[220px]">
            {contentType}
          </span>
        </div>
      </div>
    </a>
  );
}

function TextPreviewCard({
  attachment,
  contentType,
}: {
  attachment: MessageAttachment;
  contentType: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!expanded || text !== null) {
      return () => {
        cancelled = true;
      };
    }
    fetch(attachment.url)
      .then((r) => r.text())
      .then((t) => {
        if (!cancelled) setText(t);
      })
      .catch(() => {
        if (!cancelled) setText(null);
      });
    return () => {
      cancelled = true;
    };
  }, [attachment.url, expanded, text]);

  async function handleCopy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast("Copied to clipboard");
    } catch {
      // ignore
    }
  }

  return (
    <div className="relative group p-2 bg-muted rounded-xl border border-border hover:bg-muted/50 transition-colors w-full max-w-[480px]">
      <div className="flex items-start gap-2">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-muted flex-shrink-0">
          <Icon name="description" className="text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-foreground font-medium truncate max-w-[260px]">
                {attachment.name ?? "Text file"}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[260px]">
                {contentType}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleCopy}
                title={copied ? "Copied" : "Copy content"}
              >
                <Icon name={copied ? "check" : "content_copy"} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setExpanded((v) => !v)}
                title={expanded ? "Hide content" : "Show content"}
              >
                <Icon name={expanded ? "expand_less" : "expand_more"} />
              </Button>
            </div>
          </div>
          {expanded && (
            <div
              className={cn(
                "mt-2 rounded-md border border-border bg-background p-2",
                !text && "text-muted-foreground",
              )}
            >
              {text ? (
                <pre
                  className={cn(
                    "text-xs whitespace-pre-wrap break-words overflow-auto",
                    "max-h-[500px]",
                  )}
                >
                  {text}
                </pre>
              ) : (
                <span className="text-xs">Loading preview…</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
