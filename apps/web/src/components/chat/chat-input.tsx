import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";

import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { AudioButton } from "./audio-button.tsx";
import { ContextResources, UploadedFile } from "./context-resources.tsx";
import { useAgent } from "../agent/provider.tsx";
import { ModelSelector } from "./model-selector.tsx";
import { RichTextArea } from "./rich-text.tsx";
import ToolsButton from "./tools-button.tsx";

export function ChatInput({ disabled }: { disabled?: boolean } = {}) {
  const { chat, uiOptions, isPublic } = useAgent();
  const { stop, input, handleInputChange, handleSubmit, status } = chat;
  const { showModelSelector, showThreadTools } = uiOptions;
  const isLoading = status === "submitted" || status === "streaming";
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const { preferences, setPreferences } = useUserPreferences();
  const model = preferences.defaultModel;

  const canSubmit =
    !isLoading &&
    input.trim() &&
    !uploadedFiles.some((uf) => uf.status === "uploading");

  const handleRichTextChange = (markdown: string) => {
    handleInputChange({
      target: { value: markdown },
    } as ChangeEvent<HTMLTextAreaElement>);
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

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const doneFiles = uploadedFiles.filter((uf) => uf.status === "done");
    if (doneFiles.length === 0) {
      handleSubmit(e);
      return;
    }
    const experimentalAttachments = doneFiles.map((uf) => ({
      name: uf.file.name,
      type: uf.file.type,
      contentType: uf.file.type,
      size: uf.file.size,
      url: uf.url || URL.createObjectURL(uf.file),
    }));
    handleSubmit(e, {
      experimental_attachments: experimentalAttachments as unknown as FileList,
      // @ts-expect-error not yet on typings
      fileData: doneFiles.map((uf) => ({
        name: uf.file.name,
        contentType: uf.file.type,
        url: uf.url,
      })),
    });
    setUploadedFiles([]);
  };

  return (
    <div className="w-full mx-auto">
      {!isPublic && (
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
                  {showThreadTools && <ToolsButton />}
                  <AudioButton onMessage={handleRichTextChange} />
                  <Button
                    type={isLoading ? "button" : "submit"}
                    size="icon"
                    disabled={!canSubmit}
                    onClick={isLoading ? stop : undefined}
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
