import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@deco/ui/components/select.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { MODELS } from "@deco/sdk";
import { useEffect, useRef, useState } from "react";
import { RichTextArea } from "./RichText.tsx";

// Helper function to map legacy model IDs to new ones
const mapLegacyModelId = (modelId: string): string => {
  const model = MODELS.find((m) => m.legacyId === modelId);
  return model ? model.id : modelId;
};

interface ChatInputProps {
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (
    e: React.FormEvent<HTMLFormElement>,
    options?: {
      experimental_attachments?: FileList;
      abort?: boolean;
    },
  ) => void;
  isLoading?: boolean;
  stop?: () => void;
  disabled?: boolean;
  model?: string;
  onModelChange?: (model: string) => Promise<void>;
}

export function ChatInput({
  isLoading = false,
  disabled = false,
  input,
  handleInputChange,
  handleSubmit,
  stop,
  model = "anthropic:claude-3-7-sonnet-20250219",
  onModelChange,
}: ChatInputProps) {
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modelLoading, setModelLoading] = useState(false);

  const selectedModel = MODELS.find((m) => m.id === model);

  const getAcceptedFileTypes = () => {
    const acceptTypes = [];
    if (selectedModel?.capabilities.includes("image-upload")) {
      acceptTypes.push("image/jpeg", "image/png", "image/gif", "image/webp");
    }
    if (selectedModel?.capabilities.includes("file-upload")) {
      acceptTypes.push("text/*", "application/pdf");
    }
    return acceptTypes.join(",");
  };

  const handleRichTextChange = (markdown: string) => {
    handleInputChange(
      { target: { value: markdown } } as React.ChangeEvent<HTMLTextAreaElement>,
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
      // Limit to 5 files
      const fileList = Array.from(e.target.files).slice(0, 5);
      const dataTransfer = new DataTransfer();
      fileList.forEach((file) => dataTransfer.items.add(file));
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

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    handleSubmit(e, {
      experimental_attachments: files,
    });

    setFiles(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <form
      onSubmit={onSubmit}
      className={cn(
        "relative flex items-center gap-2 p-4 pt-0",
        disabled && "pointer-events-none opacity-50 cursor-not-allowed",
      )}
    >
      <div className="w-full px-2">
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
                {selectedModel &&
                  (selectedModel.capabilities.includes("file-upload") ||
                    selectedModel.capabilities.includes("image-upload")) &&
                  (
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
                  )}
                {onModelChange && (
                  <Select
                    value={mapLegacyModelId(model)}
                    onValueChange={(value) => {
                      setModelLoading(true);
                      onModelChange(value).finally(() => {
                        setModelLoading(false);
                      });
                    }}
                    disabled={modelLoading}
                  >
                    <SelectTrigger
                      className={cn(
                        "!h-8 text-xs border hover:bg-slate-100 py-0 rounded-full px-2 shadow-none",
                        modelLoading && "opacity-50 cursor-not-allowed",
                      )}
                    >
                      <SelectValue placeholder="Select model">
                        {selectedModel && (
                          <div className="flex items-center gap-1.5">
                            <img src={selectedModel.logo} className="w-3 h-3" />
                            <span className="text-xs">
                              {selectedModel.name}
                            </span>
                          </div>
                        )}
                      </SelectValue>
                      {modelLoading && <Spinner size="xs" />}
                    </SelectTrigger>
                    <SelectContent className="min-w-[400px]">
                      {MODELS.map((model) => (
                        <SelectItem
                          hideCheck
                          key={model.id}
                          value={model.id}
                          className={cn(
                            "p-0 focus:bg-slate-100 focus:text-foreground",
                            model.id === selectedModel?.id && "bg-slate-50",
                          )}
                        >
                          <div className="p-2 w-[400px] flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2">
                              <img src={model.logo} className="w-5 h-5" />
                              <span className="text-normal">{model.name}</span>
                            </div>
                            <div className="flex items-center gap-2 ml-auto">
                              {model.capabilities.map((capability) => {
                                const iconMap = {
                                  "reasoning": "neurology",
                                  "image-upload": "image",
                                  "file-upload": "description",
                                  "web-search": "search",
                                };

                                const colorMap = {
                                  "reasoning": {
                                    bg: "bg-purple-100",
                                    text: "text-purple-700",
                                  },
                                  "image-upload": {
                                    bg: "bg-teal-100",
                                    text: "text-teal-700",
                                  },
                                  "file-upload": {
                                    bg: "bg-blue-100",
                                    text: "text-blue-700",
                                  },
                                  "web-search": {
                                    bg: "bg-amber-100",
                                    text: "text-amber-700",
                                  },
                                };

                                const labelMap = {
                                  "reasoning": "Reasoning",
                                  "image-upload": "Can analyze images",
                                  "file-upload": "Can analyze files",
                                  "web-search":
                                    "Can search the web to answer questions",
                                };

                                const colors = colorMap[capability] ||
                                  {
                                    bg: "bg-slate-200",
                                    text: "text-slate-700",
                                  };

                                return (
                                  <Tooltip key={capability}>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={`flex items-center justify-center h-6 w-6 rounded-sm ${colors.bg}`}
                                      >
                                        <Icon
                                          name={iconMap[capability] || "check"}
                                          className={colors.text}
                                        />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>
                                        {labelMap[capability] || capability}
                                      </p>
                                    </TooltipContent>
                                  </Tooltip>
                                );
                              })}
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                  type={isLoading ? "button" : "submit"}
                  size="icon"
                  disabled={!isLoading && (!input.trim() && !files)}
                  onClick={isLoading ? stop : undefined}
                  className="h-8 w-8 transition-all hover:opacity-70"
                  title={isLoading ? "Stop generating" : "Send message (Enter)"}
                >
                  <Icon
                    className="text-sm"
                    name={isLoading ? "stop" : "send"}
                    filled
                  />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {files && files.length > 0 && (
          <div className="w-fit absolute z-20 bottom-full mb-2 left-6 flex flex-wrap gap-2">
            {Array.from(files).map((file, index) => (
              <div
                key={index}
                className="relative group flex items-center gap-2 p-2 bg-slate-50 rounded-xl transition-colors border border-slate-200"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute -top-2 -right-2 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-sm bg-slate-700 text-slate-50 hover:bg-slate-600 hover:text-slate-50"
                  onClick={() => {
                    const newFiles = Array.from(files).filter((_, i) =>
                      i !== index
                    );
                    const dataTransfer = new DataTransfer();
                    newFiles.forEach((file) => dataTransfer.items.add(file));
                    setFiles(dataTransfer.files);
                  }}
                  title="Remove file"
                >
                  <Icon name="close" className="text-sm" />
                </Button>
                {file.type.startsWith("image/")
                  ? (
                    <div className="h-8 w-8 rounded overflow-hidden">
                      <img
                        src={URL.createObjectURL(file)}
                        alt=""
                        className="h-full w-full object-cover"
                        onLoad={(e) => URL.revokeObjectURL(e.currentTarget.src)}
                      />
                    </div>
                  )
                  : (
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-slate-500">
                      <Icon name="draft" className="text-slate-50" />
                    </div>
                  )}
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-slate-700 font-medium truncate max-w-[200px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-slate-400">
                    {(file.size / 1024).toFixed(1)}KB
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </form>
  );
}
