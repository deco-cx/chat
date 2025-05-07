import {
  AgentNotFoundError,
  LEGACY_API_SERVER_URL,
  MODELS,
  useAgent,
  useWriteFile,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useUserPreferences } from "../../hooks/useUserPreferences.ts";
import { useChatContext } from "./context.tsx";
import type { MentionItem } from "./extensions/Mention.ts";
import { ModelSelector } from "./ModelSelector.tsx";
import { RichTextArea } from "./RichText.tsx";
import ToolsButton from "./ToolsButton.tsx";

export function ChatInput({ withoutTools }: { withoutTools?: boolean }) {
  return (
    <ErrorBoundary
      fallback={<ChatInput.UI disabled withoutTools={withoutTools} />}
      shouldCatch={(e) => e instanceof AgentNotFoundError}
    >
      <Suspense
        fallback={<ChatInput.UI disabled withoutTools={withoutTools} />}
      >
        <ChatInput.Suspense withoutTools={withoutTools} />
      </Suspense>
    </ErrorBoundary>
  );
}

ChatInput.Suspense = ({ withoutTools }: { withoutTools?: boolean }) => {
  const { agentId } = useChatContext();
  const { data: _agent } = useAgent(agentId);

  return <ChatInput.UI disabled={false} withoutTools={withoutTools} />;
};

ChatInput.UI = (
  { disabled, withoutTools }: { disabled?: boolean; withoutTools?: boolean },
) => {
  const {
    agentRoot,
    chat: { stop, input, handleInputChange, handleSubmit, status },
    setMentions,
  } = useChatContext();
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = status === "submitted" || status === "streaming";
  const { preferences, setPreferences } = useUserPreferences();
  const model = preferences.defaultModel;

  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];

  const isLoadingOrUploading = isLoading || isUploading;

  const getAcceptedFileTypes = () => {
    const acceptTypes = [];
    if (selectedModel.capabilities.includes("image-upload")) {
      acceptTypes.push("image/jpeg", "image/png", "image/gif", "image/webp");
    }
    if (selectedModel.capabilities.includes("file-upload")) {
      acceptTypes.push("text/*", "application/pdf");
    }
    return acceptTypes.join(",");
  };

  const writeFileMutation = useWriteFile();

  const handleRichTextChange = (
    markdown: string,
    mentions: MentionItem[] | null,
  ) => {
    handleInputChange(
      { target: { value: markdown } } as React.ChangeEvent<HTMLTextAreaElement>,
    );
    setMentions(mentions);
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey) {
        return; // Allow new lines with Shift+Enter
      }

      if (!isLoading && (input.trim() || files)) {
        e.preventDefault();
        const formEvent = new Event("submit", {
          bubbles: true,
          cancelable: true,
        });
        e.currentTarget.closest("form")?.dispatchEvent(formEvent);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const existingFiles = files ? Array.from(files) : [];
      const newFiles = Array.from(e.target.files);
      //limit to 5 files
      const combinedFiles = [...existingFiles, ...newFiles].slice(
        0,
        5,
      ) as File[];
      const dataTransfer = new DataTransfer();
      combinedFiles.forEach((file) => dataTransfer.items.add(file));

      setFiles(dataTransfer.files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles = Array.from(items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);

    if (imageFiles.length > 0) {
      const dataTransfer = new DataTransfer();
      imageFiles.forEach((file) => dataTransfer.items.add(file));
      setFiles(dataTransfer.files);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fileList = Array.from(files || []);

    if (fileList.length === 0) {
      handleSubmit(e);
      return;
    }

    setIsUploading(true);
    const withUrlFiles = fileList.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      await writeFileMutation.mutateAsync({
        path: `${agentRoot}/${file.name}`,
        content: uint8Array,
      });

      const url = `${LEGACY_API_SERVER_URL}${agentRoot}/${file.name}`;
      return {
        name: file.name,
        contentType: file.type,
        url: url,
      };
    });
    const uploadedFiles = await Promise.all(withUrlFiles);
    setIsUploading(false);

    const experimentalAttachments = files
      ? Array.from(files).map((file, index) => {
        const uploadedFile = uploadedFiles[index];
        return {
          name: file.name,
          type: file.type,
          contentType: file.type,
          size: file.size,
          url: uploadedFile?.url || URL.createObjectURL(file),
        };
      })
      : [];

    handleSubmit(e, {
      experimental_attachments: experimentalAttachments as unknown as FileList,
      // @ts-expect-error not yet on typings
      fileData: uploadedFiles,
    });

    setFiles(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full max-w-[640px] mx-auto">
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
                  onPaste={handlePaste}
                  placeholder="Type a message..."
                  className="border border-b-0 placeholder:text-muted-foreground resize-none focus-visible:ring-0"
                  disabled={isLoadingOrUploading || disabled}
                />
              </div>

              <div className="flex items-center justify-between h-12 border border-t-0 rounded-b-2xl px-2">
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    multiple
                    className="hidden"
                    accept={getAcceptedFileTypes()}
                  />
                  {selectedModel.capabilities.includes("file-upload") ||
                      selectedModel.capabilities.includes("image-upload")
                    ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        className="h-8 w-8 border hover:bg-slate-100"
                        title="Attach files"
                      >
                        <Icon className="text-sm" name="attach_file" />
                      </Button>
                    )
                    : null}
                  <ModelSelector
                    model={model}
                    onModelChange={(modelToSelect) =>
                      setPreferences({
                        ...preferences,
                        defaultModel: modelToSelect,
                      })}
                  />
                  {!withoutTools && <ToolsButton />}
                </div>
                <div className="flex items-center gap-4">
                  {input && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-background border rounded-md">
                        shift
                      </kbd>
                      <span>+</span>
                      <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-background border rounded-md">
                        return
                      </kbd>
                      <span className="opacity-75">for new line</span>
                    </span>
                  )}
                  <Button
                    type={isLoadingOrUploading ? "button" : "submit"}
                    size="icon"
                    disabled={!isLoadingOrUploading &&
                      (!input.trim() && !files)}
                    onClick={isLoadingOrUploading ? stop : undefined}
                    className="h-8 w-8 transition-all hover:opacity-70"
                    title={isLoadingOrUploading
                      ? "Stop generating"
                      : "Send message (Enter)"}
                  >
                    <Icon
                      name={isLoadingOrUploading ? "stop" : "send"}
                      filled
                    />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {files && files.length > 0 && (
            <div className="w-fit absolute z-20 bottom-full mb-2 left-6 flex flex-wrap gap-2">
              {Array.from(files).map((file, index) => {
                const currentFile = file;
                return (
                  <div
                    key={index}
                    className="relative group flex items-center gap-2 p-2 bg-slate-50 rounded-xl transition-colors border border-slate-200"
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute -top-2 -right-2 h-5 w-5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm bg-slate-700 text-slate-50 hover:bg-slate-600 hover:text-slate-50"
                      onClick={() => {
                        const dataTransfer = new DataTransfer();
                        Array.from(files || []).forEach((f, i) => {
                          if (i !== index) {
                            dataTransfer.items.add(f);
                          }
                        });
                        setFiles(dataTransfer.files);
                      }}
                      title="Remove file"
                    >
                      <Icon name="close" />
                    </Button>
                    {currentFile.type.startsWith("image/")
                      ? (
                        <div className="h-8 w-8 rounded overflow-hidden">
                          <img
                            src={URL.createObjectURL(currentFile)}
                            alt=""
                            className="h-full w-full object-cover"
                            onLoad={(e) =>
                              URL.revokeObjectURL(e.currentTarget.src)}
                          />
                        </div>
                      )
                      : (
                        <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-500">
                          <Icon name="draft" />
                        </div>
                      )}
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-slate-700 font-medium truncate max-w-[200px]">
                        {currentFile.name}
                      </span>
                      <span className="text-xs text-slate-400">
                        {(currentFile.size / 1024).toFixed(1)}KB
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};
