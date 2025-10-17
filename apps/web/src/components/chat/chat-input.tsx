import { UIMessage } from "@ai-sdk/react";
import type { Integration } from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useAgentSettingsToolsSet } from "../../hooks/use-agent-settings-tools-set.ts";
import { useFileUpload } from "../../hooks/use-file-upload.ts";
import { useUserPreferences } from "../../hooks/use-user-preferences.ts";
import { ContextResources } from "../chat/context-resources.tsx";
import { useAgenticChat } from "./provider.tsx";
import type { ToolsetContextItem } from "./types.ts";
import { SelectConnectionDialog } from "../integrations/select-connection-dialog.tsx";
import { AudioButton } from "./audio-button.tsx";
import { ModelSelector } from "./model-selector.tsx";
import { RichTextArea, type RichTextAreaHandle } from "./rich-text.tsx";
export function ChatInput({
  disabled,
  rightNode,
}: {
  disabled?: boolean;
  rightNode?: ReactNode;
} = {}) {
  const {
    chat,
    input,
    setInput,
    agent,
    contextItems,
    sendMessage,
    addContextItem,
    isLoading,
    showModelSelector,
    showContextResources,
  } = useAgenticChat();
  const { stop } = chat;
  const { preferences, setPreferences } = useUserPreferences();
  const { enableAllTools } = useAgentSettingsToolsSet();
  const model = preferences.defaultModel;
  const richTextRef = useRef<RichTextAreaHandle>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectDialogTriggerRef = useRef<HTMLButtonElement>(null);

  // Use ref to avoid recreating callback on every preferences change
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const {
    uploadedFiles,
    isDragging,
    fileInputRef,
    handleFileChange,
    removeFile,
    clearFiles,
    openFileDialog,
  } = useFileUpload({ maxFiles: 5 });

  const enableFileUpload = true;

  // Check if there are any context resources to display
  const hasContextResources = useMemo(() => {
    const hasFiles = uploadedFiles.length > 0;
    const hasContextItems = contextItems.length > 0;
    const hasTools =
      agent?.tools_set && Object.keys(agent.tools_set).length > 0;
    return hasFiles || hasContextItems || hasTools;
  }, [uploadedFiles, contextItems, agent?.tools_set]);

  const canSubmit =
    !isLoading &&
    input?.trim() &&
    !uploadedFiles.some((uf) => uf.status === "uploading");

  const handleRichTextChange = (markdown: string) => {
    setInput(markdown);
  };

  const handleModelChange = useCallback(
    (modelToSelect: string) => {
      setPreferences({
        ...preferencesRef.current,
        defaultModel: modelToSelect,
      });
    },
    [setPreferences],
  );

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

  const handleAddIntegration = useCallback(
    (integration: Integration) => {
      // Use the enableAllTools function from useAgentSettingsToolsSet
      enableAllTools(integration.id);
      // Add context item for the integration
      addContextItem({
        type: "toolset",
        integrationId: integration.id,
        enabledTools: integration.tools?.map(t => t.name) || [],
      } as Omit<ToolsetContextItem, "id">);
    },
    [enableAllTools, addContextItem],
  );

  const handleOpenSelectDialog = useCallback(() => {
    setIsDropdownOpen(false);
    // Use setTimeout to ensure dropdown closes before dialog opens
    setTimeout(() => {
      selectDialogTriggerRef.current?.click();
    }, 0);
  }, []);

  const handleOpenFileDialog = useCallback(() => {
    setIsDropdownOpen(false);
    openFileDialog();
  }, [openFileDialog]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!input.trim() || isLoading) return;

    const doneFiles = uploadedFiles.filter(
      (uf) => uf.status === "done" && !!uf.url,
    );

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
        url: uf.url!, // ensured by filter above
      }));

      message.parts.push(...fileParts);
    }

    // Clear input immediately before sending
    setInput("");
    clearFiles();

    try {
      await sendMessage(message);
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="w-full mx-auto relative">
      {/* Hidden file input for file uploads */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,application/pdf,text/*"
        className="hidden"
        aria-hidden="true"
      />
      
      {/* File Drop Overlay - extends above the input */}
      {enableFileUpload && isDragging && (
        <div
          className={cn(
            "absolute left-0 right-0 bottom-0 rounded-xl overflow-hidden z-[60]",
            "pointer-events-none",
            "animate-in fade-in duration-200",
          )}
          style={{ height: "400px" }}
        >
          <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-xl flex items-center justify-center">
            <div className="text-center">
              <Icon name="upload_file" className="w-16 h-16 text-primary mx-auto mb-3" />
              <p className="text-lg font-medium text-foreground mb-1">Drop files here</p>
              <p className="text-sm text-muted-foreground">
                Upload images, PDFs, or text files
              </p>
            </div>
          </div>
        </div>
      )}
      
      <form
        onSubmit={onSubmit}
        className={cn(
          "relative",
          disabled && "pointer-events-none opacity-50 cursor-not-allowed",
        )}
      >
        <div className="w-full">
          <div className="relative rounded-xl border border-border bg-background w-full mx-auto">
            <div className="relative flex flex-col gap-2 p-2.5">
              {/* Context Resources */}
              {showContextResources && hasContextResources && (
                <ContextResources
                  uploadedFiles={uploadedFiles}
                  isDragging={isDragging}
                  removeFile={removeFile}
                  enableFileUpload={enableFileUpload}
                />
              )}

              {/* Input Area */}
              <div
                className="overflow-y-auto relative"
                style={{ maxHeight: "164px" }}
              >
                <RichTextArea
                  ref={richTextRef}
                  value={input}
                  onChange={handleRichTextChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything or @ for context"
                  className="placeholder:text-muted-foreground resize-none focus-visible:ring-0 border-0 px-2.5 py-2 text-sm min-h-[20px] rounded-none"
                  disabled={isLoading || disabled}
                  allowNewLine={isMobile}
                  enableToolMentions
                />
              </div>

              {/* Bottom Actions Row */}
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <DropdownMenu
                    modal={false}
                    open={isDropdownOpen}
                    onOpenChange={setIsDropdownOpen}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex size-8 items-center justify-center rounded-full p-1 hover:bg-transparent transition-colors group cursor-pointer"
                        title="Add context"
                      >
                        <Icon
                          name="add"
                          size={20}
                          className="text-muted-foreground group-hover:text-foreground transition-colors"
                        />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top">
                      <DropdownMenuItem onSelect={handleOpenFileDialog}>
                        <Icon name="attach_file" className="size-4" />
                        Add photos & files
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={handleOpenSelectDialog}>
                        <Icon name="alternate_email" className="size-4" />
                        Add context
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-1">
                  {rightNode}
                  {showModelSelector && (
                    <ModelSelector
                      model={model}
                      onModelChange={handleModelChange}
                      className="!p-0 hover:bg-transparent"
                    />
                  )}
                  <AudioButton
                    onMessage={handleRichTextChange}
                    className="hover:bg-transparent hover:text-foreground"
                  />
                  <Button
                    type={isLoading ? "button" : "submit"}
                    onClick={
                      isLoading
                        ? () => {
                            stop();
                          }
                        : undefined
                    }
                    variant={canSubmit || isLoading ? "special" : "ghost"}
                    size="icon"
                    disabled={!canSubmit && !isLoading}
                    className={cn(
                      "size-8 rounded-full transition-all",
                      !canSubmit && !isLoading && "bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground cursor-not-allowed"
                    )}
                    title={
                      isLoading ? "Stop generating" : "Send message (Enter)"
                    }
                  >
                    <Icon
                      name={isLoading ? "stop" : "arrow_upward"}
                      size={20}
                      filled={isLoading}
                    />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Separate SelectConnectionDialog to avoid mounting/unmounting on dropdown open */}
      <SelectConnectionDialog
        title="Add context"
        onSelect={handleAddIntegration}
        trigger={
          <button
            ref={selectDialogTriggerRef}
            type="button"
            className="hidden"
            aria-hidden="true"
          />
        }
      />
    </div>
  );
}
