import type { Message } from "@ai-sdk/react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { MemoizedMarkdown } from "./Markdown.tsx";
import { ToolMessage } from "./ToolMessage.tsx";
import { useMemo } from "react";

interface ChatMessageProps {
  message: Message;
  handlePickerSelect: (
    toolCallId: string,
    selectedValue: string,
  ) => Promise<void>;
}

interface MessagePart {
  type: "text" | "tool-invocation-group";
  content?: string;
  toolInvocations?: NonNullable<Message["toolInvocations"]>;
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

type Part = TextPart | ToolPart;

function mergeParts(parts: Part[] | undefined): MessagePart[] {
  if (!parts) return [];

  const mergedParts: MessagePart[] = [];
  let currentToolGroup: NonNullable<Message["toolInvocations"]> = [];
  let currentTextContent: string[] = [];

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

  parts.forEach((part) => {
    if (part.type === "tool-invocation") {
      // If we have pending text content, flush it first
      flushTextContent();
      currentToolGroup.push(part.toolInvocation);
    } else if (part.type === "text") {
      // If we have pending tool invocations, flush them first
      flushToolGroup();
      // Only add non-empty text parts
      if (part.text.trim()) {
        currentTextContent.push(part.text);
      }
    }
  });

  flushToolGroup();
  flushTextContent();

  return mergedParts;
}

export function ChatMessage({ message, handlePickerSelect }: ChatMessageProps) {
  const isUser = message.role === "user";
  const timestamp = new Date(message.createdAt || Date.now())
    .toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  const attachments = message.experimental_attachments?.filter(
    (attachment: MessageAttachment) =>
      attachment?.contentType?.startsWith("image/") ||
      attachment?.contentType?.startsWith("application/pdf"),
  );

  const handleCopy = async () => {
    const content = message.parts
      ? (message.parts as Part[]).filter((part) => part.type === "text").map((
        part,
      ) => part.text).join("\n")
      : message.content;
    await navigator.clipboard.writeText(content);
  };

  const mergedParts = useMemo(() => mergeParts(message.parts as Part[]), [
    message.parts,
  ]);

  const hasTextContent = useMemo(() => {
    return (message.parts as Part[])?.some((part) => part.type === "text") ||
      message.content;
  }, [message.parts, message.content]);

  return (
    <div
      className={cn(
        "w-full group relative flex items-start gap-4 px-4 z-20 text-slate-700 group",
        isUser ? "flex-row-reverse py-4" : "flex-row",
      )}
    >
      <div
        className={cn(
          "flex flex-col gap-1",
          isUser ? "items-end max-w-[70%]" : "w-full items-start",
        )}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{timestamp}</span>
        </div>

        <div
          className={cn(
            "w-full not-only:rounded-2xl text-base",
            isUser ? "bg-slate-50 p-3" : "bg-transparent",
          )}
        >
          {message.parts
            ? (
              <div className="space-y-2 w-full">
                {mergedParts.map((part, index) => {
                  if (part.type === "text") {
                    return (
                      <MemoizedMarkdown
                        key={index}
                        id={`${message.id}-${index}`}
                        content={part.content || ""}
                      />
                    );
                  } else if (
                    part.type === "tool-invocation-group" &&
                    part.toolInvocations
                  ) {
                    return (
                      <ToolMessage
                        key={index}
                        toolInvocations={part.toolInvocations}
                        handlePickerSelect={handlePickerSelect}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            )
            : (
              <MemoizedMarkdown
                id={message.id}
                content={message.content}
              />
            )}

          {attachments && attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {attachments.map((
                attachment: MessageAttachment,
                index: number,
              ) => (
                <a
                  key={`${message.id}-${index}`}
                  href={attachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative group flex items-center gap-2 p-2 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors"
                >
                  {attachment.contentType?.startsWith("image/")
                    ? (
                      <div className="relative">
                        <img
                          src={attachment.url}
                          alt={attachment.name ?? `attachment-${index}`}
                          className="rounded-lg max-w-[300px] max-h-[300px] object-cover"
                        />
                      </div>
                    )
                    : attachment.contentType?.startsWith("application/pdf")
                    ? (
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-500">
                          <Icon
                            name="picture_as_pdf"
                            className="text-slate-50"
                          />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-slate-700 font-medium truncate max-w-[200px]">
                            {attachment.name ?? "PDF Document"}
                          </span>
                        </div>
                      </div>
                    )
                    : (
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-500">
                          <Icon name="draft" className="text-slate-50" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-slate-700 font-medium truncate max-w-[200px]">
                            {attachment.name ?? "Document"}
                          </span>
                        </div>
                      </div>
                    )}
                </a>
              ))}
            </div>
          )}

          {!isUser && hasTextContent && (
            <div className="mt-2 flex gap-2 items-center text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="flex gap-1">
                <Button
                  onClick={handleCopy}
                  variant="ghost"
                  size="sm"
                  className="text-slate-500 hover:text-foreground p-0 hover:bg-transparent"
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
