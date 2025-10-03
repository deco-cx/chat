import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { type FormEvent, type KeyboardEvent, useEffect, useState } from "react";

import { UIMessage } from "@ai-sdk/react";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { useAgent } from "../agent/provider.tsx";
import { AudioButton } from "./audio-button.tsx";
import { ContextResources, UploadedFile } from "./context-resources.tsx";
import { ModelSelector } from "./model-selector.tsx";
import { RichTextArea } from "./rich-text.tsx";

export function ChatInput({ disabled }: { disabled?: boolean } = {}) {
  const { chat, uiOptions, input, setInput, isLoading, setIsLoading } =
    useAgent();
  const { stop, sendMessage } = chat;
  const { showModelSelector, showContextResources } = uiOptions;
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { preferences, setPreferences } = useUserPreferences();
  const model = preferences.defaultModel;

  const canSubmit =
    !isLoading &&
    input?.trim() &&
    !uploadedFiles.some((uf) => uf.status === "uploading");

  const handleRichTextChange = (markdown: string) => {
    setInput(markdown);
  };

  // Auto-focus when loading state changes from true to false
  useEffect(() => {
    if (!isLoading) {
      const editor = document.querySelector(".ProseMirror") as HTMLElement;
      if (editor) {
        editor.focus();
      }
    }
  }, [isLoading]);

  const isMobile =
    typeof window !== "undefined" &&
    ("ontouchstart" in window ||
      navigator.userAgent.toLowerCase().includes("mobile"));

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isMobile) {
      if (canSubmit) {
        e.preventDefault();
        const formEvent = new Event("submit", {
          bubbles: true,
          cancelable: true,
        });
        e.currentTarget.closest("form")?.dispatchEvent(formEvent);
      }
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    setIsLoading(true);

    try {
      const doneFiles = uploadedFiles.filter((uf) => uf.status === "done");

      // Prepare message with attachments if any
      const message: UIMessage = {
        id: crypto.randomUUID(),
        role: "user",
        parts: [
          {
            type: "text",
            text: input,
          },
        ],
      };

      if (doneFiles.length > 0) {
        // Add file attachments as parts
        const fileParts = doneFiles.map((uf) => ({
          type: "file" as const,
          name: uf.file.name,
          contentType: uf.file.type,
          mediaType: uf.file.type,
          size: uf.file.size,
          url: uf.url || URL.createObjectURL(uf.file),
        }));

        message.parts.push(...fileParts);
      }

      await sendMessage(message);
      setInput("");
      setUploadedFiles([]);
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full mx-auto">
      {showContextResources && (
        <ContextResources
          uploadedFiles={uploadedFiles}
          setUploadedFiles={setUploadedFiles}
        />
      )}
      <form
        onSubmit={onSubmit}
        className={cn(
          "relative flex items-center gap-2 pt-0",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
        )}
      >
        <div className="w-full">
          <div className="relative rounded-md w-full mx-auto">
            <div className="relative flex flex-col">
              <div
                className="overflow-y-auto relative"
                style={{ maxHeight: "164px" }}
              >
                <RichTextArea
                  value={input}
                  onChange={handleRichTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="border border-b-0 placeholder:text-muted-foreground resize-none focus-visible:ring-0"
                  disabled={isLoading || disabled}
                  allowNewLine={isMobile}
                  enableToolMentions
                />
              </div>

              <div className="flex items-center justify-between h-12 border border-t-0 rounded-b-2xl px-2">
                <div className="flex items-center gap-2">
                  {/* File upload is now handled by ContextResources */}
                </div>
                <div className="flex items-center gap-2">
                  {showModelSelector && (
                    <ModelSelector
                      model={model}
                      onModelChange={(modelToSelect) =>
                        setPreferences({
                          ...preferences,
                          defaultModel: modelToSelect,
                        })
                      }
                    />
                  )}
                  <AudioButton onMessage={handleRichTextChange} />
                  <Button
                    type={isLoading ? "button" : "submit"}
                    size="icon"
                    disabled={isLoading ? false : !canSubmit}
                    onClick={
                      isLoading
                        ? () => {
                            stop();
                            setIsLoading(false);
                          }
                        : undefined
                    }
                    className="h-8 w-8 transition-all hover:opacity-70"
                    title={
                      isLoading ? "Stop generating" : "Send message (Enter)"
                    }
                  >
                    <Icon filled name={isLoading ? "stop" : "send"} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
