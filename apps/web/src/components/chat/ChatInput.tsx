import {
  MODELS,
  NotFoundError,
  readFile,
  useAgent,
  useSDK,
  useWriteFile,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import { ErrorBoundary } from "../../ErrorBoundary.tsx";
import { useUserPreferences } from "../../hooks/useUserPreferences.ts";
import { AudioButton } from "./AudioButton.tsx";
import { useChatContext } from "./context.tsx";
import { ModelSelector } from "./ModelSelector.tsx";
import { RichTextArea } from "./RichText.tsx";
import ToolsButton from "./ToolsButton.tsx";
import { useIsMobile } from "@deco/ui/hooks/use-mobile.ts";

export function ChatInput() {
  return (
    <ErrorBoundary
      fallback={<ChatInput.UI disabled />}
      shouldCatch={(e) => e instanceof NotFoundError}
    >
      <Suspense
        fallback={<ChatInput.UI disabled />}
      >
        <ChatInput.Suspense />
      </Suspense>
    </ErrorBoundary>
  );
}

ChatInput.Suspense = () => {
  const { agentId } = useChatContext();
  const { data: _agent } = useAgent(agentId);

  return <ChatInput.UI disabled={false} />;
};

interface UploadedFile {
  file: File;
  url?: string;
  status: "uploading" | "done" | "error";
  error?: string;
}

const useGlobalDrop = (handleFileDrop: (e: DragEvent) => void) => {
  const [isDragging, setIsDragging] = useState(false);

  /** Global file drop handler */
  useEffect(() => {
    /**
     * These drag events conflict with the ones from dockview.
     * This variable is drue when dragging elements from dockview, preventing
     * us setting the dragging state to true.
     */
    let skip = false;

    function handleDrop(e: Event) {
      setIsDragging(false);
      skip = false;
      const dragEvent = e as unknown as DragEvent;
      handleFileDrop(dragEvent);
    }
    function handleDragOver(e: Event) {
      if (skip) {
        return;
      }
      e.preventDefault();
      setIsDragging(true);
    }
    function handleDragEnd() {
      skip = false;
      setIsDragging(false);
    }
    /**
     * This is fired when dragging elements from dockview. Dragging files
     * do not fire this event
     */
    function handleDrag() {
      skip = true;
    }

    globalThis.addEventListener("drop", handleDrop);
    globalThis.addEventListener("drag", handleDrag);
    globalThis.addEventListener("dragover", handleDragOver);
    globalThis.addEventListener("dragend", handleDragEnd);

    return () => {
      globalThis.removeEventListener("drop", handleDrop);
      globalThis.removeEventListener("drag", handleDrag);
      globalThis.removeEventListener("dragover", handleDragOver);
      globalThis.removeEventListener("dragend", handleDragEnd);
    };
  }, [handleFileDrop]);

  return isDragging;
};

ChatInput.UI = (
  { disabled }: { disabled?: boolean },
) => {
  const { workspace } = useSDK();
  const {
    chat: { stop, input, handleInputChange, handleSubmit, status },
    uiOptions: { showModelSelector, showThreadTools },
  } = useChatContext();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = status === "submitted" || status === "streaming";
  const isUploading = uploadedFiles.some((f) => f.status === "uploading");
  const { preferences, setPreferences } = useUserPreferences();
  const model = preferences.defaultModel;

  const isMobile = useIsMobile();

  const selectedModel = MODELS.find((m) => m.id === model) || MODELS[0];

  const getAcceptedFileTypes = () => {
    const acceptTypes: string[] = [];
    if (selectedModel.capabilities.includes("image-upload")) {
      acceptTypes.push("image/jpeg", "image/png", "image/gif", "image/webp");
    }
    if (selectedModel.capabilities.includes("file-upload")) {
      acceptTypes.push("text/*", "application/pdf");
    }
    return acceptTypes.join(",");
  };

  const writeFileMutation = useWriteFile();

  const handleRichTextChange = (markdown: string) => {
    handleInputChange(
      { target: { value: markdown } } as ChangeEvent<HTMLTextAreaElement>,
    );
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

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      if (e.shiftKey || isMobile) {
        return;
      }

      if (!isLoading && (input.trim() || uploadedFiles.length > 0)) {
        e.preventDefault();
        const formEvent = new Event("submit", {
          bubbles: true,
          cancelable: true,
        });
        e.currentTarget.closest("form")?.dispatchEvent(formEvent);
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;

    if (fileList?.length) {
      uploadFileList(fileList);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePaste = (e: ClipboardEvent) => {
    const fileList = e.clipboardData.files;

    if (fileList?.length) {
      uploadFileList(fileList);
    }
  };

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();

    const fileList = e.dataTransfer?.files;
    if (fileList?.length) {
      uploadFileList(fileList);
    }
  }

  async function uploadFileList(fileList: FileList) {
    const newFiles = Array.from(fileList);

    // Prevent duplicates and limit to 5 files
    const allFiles = [
      ...uploadedFiles.map((uf) => uf.file),
      ...newFiles,
    ].slice(0, 5);

    const uniqueFiles = Array.from(
      new Map(allFiles.map((f) => [f.name + f.size, f])).values(),
    );

    const filesToUpload = uniqueFiles
      .filter((file) =>
        !uploadedFiles.some((uf) =>
          uf.file.name === file.name && uf.file.size === file.size
        )
      )
      .map((file): UploadedFile => ({ file, status: "uploading" }));

    setUploadedFiles((prev) => [...prev, ...filesToUpload]);
    await Promise.all(filesToUpload.map(({ file }) => uploadFile(file)));
  }

  async function uploadFile(file: File) {
    try {
      const path = `uploads/${file.name}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });

      const url = await readFile({ workspace, path });

      setUploadedFiles((prev) =>
        prev.map((uf) =>
          uf.file === file
            ? { ...uf, url: url || undefined, status: "done" }
            : uf
        )
      );
    } catch (error) {
      setUploadedFiles((prev) =>
        prev.map((uf) =>
          uf.file === file
            ? {
              ...uf,
              status: "error",
              error: error instanceof Error ? error.message : "Upload failed",
            }
            : uf
        )
      );
    }
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (isUploading) {
      return;
    }

    // Only use files that are done uploading
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isDragging = useGlobalDrop(handleFileDrop);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <FileDropOverlay display={isDragging} />
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
                  disabled={isLoading || disabled}
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
                        <Icon className="text-sm" name="add" />
                      </Button>
                    )
                    : null}
                </div>
                <div className="flex items-center gap-2">
                  {showModelSelector && (
                    <ModelSelector
                      model={model}
                      onModelChange={(modelToSelect) =>
                        setPreferences({
                          ...preferences,
                          defaultModel: modelToSelect,
                        })}
                    />
                  )}
                  {showThreadTools && <ToolsButton />}
                  <AudioButton onMessage={handleRichTextChange} />
                  <Button
                    type={isLoading ? "button" : "submit"}
                    size="icon"
                    disabled={isUploading || (!isLoading && !input.trim())}
                    onClick={isLoading ? stop : undefined}
                    className="h-8 w-8 transition-all hover:opacity-70"
                    title={isLoading
                      ? "Stop generating"
                      : "Send message (Enter)"}
                  >
                    <Icon
                      filled
                      name={isLoading ? "stop" : "send"}
                    />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {uploadedFiles.length > 0 && (
            <div className="w-fit absolute z-50 bottom-full mb-2 left-0 flex flex-wrap gap-2">
              {uploadedFiles.map((uf, index) => (
                <FilePreviewItem
                  key={uf.file.name + uf.file.size}
                  uploadedFile={uf}
                  removeFile={() => {
                    setUploadedFiles((prev) =>
                      prev.filter((_, i) => i !== index)
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

function FileDropOverlay({ display }: { display: boolean }) {
  if (!display) {
    return null;
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "absolute bottom-2 left-0 right-0 z-50",
          "flex flex-col items-center justify-center gap-2",
          "pointer-events-none animate-fade-in",
          "p-8 shadow-2xl rounded-2xl border border-slate-200 bg-background/95",
        )}
      >
        <Icon name="upload" size={48} className="text-foreground" />
        <span className="text-lg font-semibold text-foreground">
          Drop files to upload
        </span>
        <span className="text-sm text-muted-foreground">
          (Max 5 files, images or PDFs)
        </span>
      </div>
    </div>
  );
}

interface FilePreviewItemProps {
  uploadedFile: UploadedFile;
  removeFile: () => void;
}

function FilePreviewItem(
  { uploadedFile, removeFile }: FilePreviewItemProps,
) {
  const { file, status, error, url } = uploadedFile;

  return (
    <div className="relative group">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute -top-2 -right-2 h-5 w-5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm bg-slate-700 text-slate-50 hover:bg-slate-600 hover:text-slate-50"
        onClick={removeFile}
        title="Remove file"
      >
        <Icon name="close" />
      </Button>

      <div className="flex items-center justify-center size-16 rounded-xl group-hover:ring ring-offset-2 ring-slate-300 overflow-hidden bg-slate-100">
        {status === "uploading"
          ? <Spinner size="xs" />
          : status === "error"
          ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Icon name="error" size={32} className="text-red-500" />
              </TooltipTrigger>
              <TooltipContent className="flex flex-col items-center">
                Error uploading file {error?.toString()}
              </TooltipContent>
            </Tooltip>
          )
          : (
            <Tooltip>
              <TooltipTrigger asChild>
                {file.type.startsWith("image/") && url
                  ? <img src={url} className="h-full w-full object-cover" />
                  : <Icon name="draft" size={32} />}
              </TooltipTrigger>
              <TooltipContent className="flex flex-col items-center">
                <span>{file.name}</span>
                <span>{(file.size / 1024).toFixed(1)}KB</span>
              </TooltipContent>
            </Tooltip>
          )}
      </div>
    </div>
  );
}
