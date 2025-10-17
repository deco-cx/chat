import type { UIMessage } from "@ai-sdk/react";
import { useFile } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { toast } from "@deco/ui/components/sonner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { FileUIPart, ToolUIPart } from "ai";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { MemoizedMarkdown } from "./chat-markdown.tsx";
import { ReasoningPart } from "./reasoning-part.tsx";
import { ToolMessage } from "./tool-message.tsx";

interface ChatMessageProps {
  message: UIMessage;
  isLastMessage?: boolean;
}

interface MessageAttachment {
  contentType?: string;
  url: string;
  name?: string;
}

interface ImagePart {
  type: "image";
  image: string;
}

interface ReasoningPart {
  type: "reasoning";
  text: string;
  state?: "streaming" | "done";
}

const isToolPart = (part: UIMessage["parts"][number]): part is ToolUIPart => {
  return part.type.startsWith("tool-") && "toolCallId" in part;
};

export const ChatMessage = memo(function ChatMessage({
  message,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const createdAt =
    (message.metadata as { createdAt?: string })?.createdAt ?? Date.now();

  const timestamp = useMemo(
    () =>
      new Date(createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    [createdAt],
  );

  const attachments = useMemo(
    () =>
      message.parts
        ?.filter((part) => part.type === "file")
        .map((part) => ({
          contentType: part.mediaType,
          url: part.url,
          name: part.filename,
        })) as MessageAttachment[] | undefined,
    [message.parts],
  );

  const handleCopy = useCallback(async () => {
    const content = message.parts
      ? message.parts
          .filter((part) => part.type === "text" && "text" in part)
          .map((part) =>
            part.type === "text" && "text" in part ? part.text : "",
          )
          .join("\n")
      : "content" in message && typeof message.content === "string"
        ? message.content
        : "";
    await navigator.clipboard.writeText(content);
    toast("Copied to clipboard");
  }, [message.parts, message]);

  const hasTextContent = useMemo(() => {
    return (
      message.parts?.some((part) => part.type === "text") ||
      ("content" in message && typeof message.content === "string")
    );
  }, [message.parts, message]);

  return (
    <div
      className={cn(
        "w-full min-w-0 group relative flex items-start gap-4 px-4 z-20 text-foreground group",
        isUser ? "flex-row-reverse py-4" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-2 min-w-0",
          isUser ? "items-end max-w-[70%]" : "w-full items-start",
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timestamp}</span>
        </div>

        <div
          className={cn(
            "w-full min-w-0 not-only:rounded-2xl text-[0.9375rem] break-words overflow-wrap-anywhere",
            isUser ? "bg-muted px-4 py-3" : "bg-transparent",
          )}
        >
          {message.parts ? (
            <div className="space-y-3 w-full">
              {message.parts.map((part, index) => {
                if (part.type === "reasoning") {
                  return (
                    <ReasoningPart
                      key={index}
                      part={part}
                      messageId={message.id}
                      index={index}
                    />
                  );
                } else if (part.type === "text") {
                  return (
                    <MemoizedMarkdown
                      key={index}
                      part={part}
                      messageId={message.id}
                    />
                  );
                } else if (
                  part.type === "file" &&
                  "mediaType" in part &&
                  part.mediaType?.startsWith("image/")
                ) {
                  // Handle image files
                  return <ImagePart part={part} key={index} />;
                } else if (part.type === "step-start") {
                  // Step start parts are typically not rendered visually
                  return null;
                } else if (isToolPart(part)) {
                  // Handle individual tool parts
                  return <ToolMessage key={index} part={part} />;
                }
                return null;
              })}
            </div>
          ) : (
            <MemoizedMarkdown
              messageId={message.id}
              part={{
                type: "text",
                text:
                  "content" in message && typeof message.content === "string"
                    ? message.content || ""
                    : "",
              }}
            />
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
});

function ImagePart({ part }: { part: FileUIPart }) {
  const { data: fileUrl } = useFile(part.url);

  if (!fileUrl) return null;

  return (
    <img
      src={fileUrl}
      alt={part.filename || "Uploaded image"}
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
