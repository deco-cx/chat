import { useMemo, useRef, useState } from "react";
import {
  type Integration,
  useDeleteFile,
  useKnowledgeDeleteFile,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { extname } from "@std/path/posix";
import {
  type FileExt,
  formatFileSize,
  isAllowedContentType,
  isAllowedFileExt,
} from "@deco/sdk/utils";
import { agentKnowledgeBasePath } from "./hooks/use-agent-knowledge.ts";

function FileIcon({ filename }: { filename: string }) {
  const ext = useMemo<FileExt>(() => extname(filename) as FileExt, [filename]);
  const color = useMemo(() => {
    switch (ext) {
      case ".txt":
      case ".md":
        return "text-blue-600";
      case ".csv":
        return "text-green-600";
      case ".pdf":
        return "text-red-600";
      case ".json":
        return "text-yellow-600";
    }
  }, [ext]);

  return (
    <span className="relative w-6 flex items-center justify-center">
      <svg width={24} height={24}>
        <use href="/img/sheet.svg" />
      </svg>
      <span className={cn("mt-2 absolute uppercase text-[6px] spacing", color)}>
        {ext}
      </span>
    </span>
  );
}

export interface KnowledgeFile {
  fileSize?: number;
  fileType?: ".pdf" | ".txt" | ".md" | ".csv" | ".json";
  path?: string | undefined;
  agentId?: string | undefined;
  docIds?: string[];
  filename?: string;
  fileUrl: string;
  name: string;
  metadata?: Record<string, unknown>;
  status?: string;
  uploading?: boolean;
}

interface KnowledgeBaseFileListProps {
  integration?: Integration;
  agentId: string;
  files: KnowledgeFile[];
}

export function KnowledgeBaseFileList({
  files,
  agentId,
  integration,
}: KnowledgeBaseFileListProps) {
  const prefix = agentKnowledgeBasePath(agentId);
  const removeFile = useDeleteFile();
  const knowledgeDeleteFile = useKnowledgeDeleteFile();

  if (files.length === 0) return null;

  return (
    <div className="max-h-40 overflow-y-auto border rounded-xl divide-y">
      {files.map((file) => (
        <div
          key={file.name ?? file.fileUrl}
          className="flex items-center gap-3 justify-between p-2 h-14"
        >
          {/* icon */}
          <div className="w-10 h-10 p-2 rounded-xl bg-primary/10 flex-shrink-0">
            <FileIcon filename={file.name ?? file.fileUrl} />
          </div>

          {/* name */}
          <div className="flex-1 min-w-0">
            <span className="text-sm font-medium truncate">
              {(file.status === "processing" ||
                file.status === "failed" ||
                file.uploading) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={cn(
                          // deno-lint-ignore ensure-tailwind-design-system-tokens/ensure-tailwind-design-system-tokens
                          "text-xs bg-gray-400 w-2 h-2 rounded-full inline-block mr-2",
                          file.status === "processing" && "bg-yellow-600",
                          file.status === "failed" && "bg-red-600",
                          file.uploading && "bg-blue-600",
                        )}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {file.uploading
                        ? "Uploading"
                        : file.status === "processing"
                          ? "Processing"
                          : file.status === "failed"
                            ? "Failed"
                            : "Unknown status"}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              {file.name}
            </span>
            <div className="flex items-center gap-2">
              {file.fileSize && (
                <span className="text-xs text-muted-foreground">
                  {formatFileSize(file.fileSize)}
                </span>
              )}
              {file.uploading && (
                <span className="text-xs text-primary">Uploading...</span>
              )}

              {knowledgeDeleteFile.isPending &&
                knowledgeDeleteFile.variables.fileUrl === file.fileUrl && (
                  <span className="text-xs text-primary">removing...</span>
                )}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-shrink-0 h-8 w-8 p-0"
                disabled={!file.fileUrl}
              >
                <Icon name="more_horiz" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={
                  removeFile.isPending &&
                  removeFile.variables.path === file.fileUrl
                }
                onClick={() => {
                  if (knowledgeDeleteFile.isPending) return;
                  file.path &&
                    removeFile.mutateAsync({
                      root: prefix,
                      path: file.path,
                    });
                  file.fileUrl &&
                    knowledgeDeleteFile.mutateAsync({
                      fileUrl: file.fileUrl,
                      connection: integration?.connection,
                    });
                }}
                className="text-destructive focus:text-destructive"
              >
                <Icon name="delete" size={16} className="mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ))}
    </div>
  );
}

interface AddFileToKnowledgeProps {
  disabled?: boolean;
  uploadKnowledgeFiles: (files: File[]) => Promise<void>;
}

export function AddFileToKnowledgeButton({
  uploadKnowledgeFiles,
  disabled = false,
}: AddFileToKnowledgeProps) {
  const [isUploading, setIsUploading] = useState(false);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileInput = () => {
    knowledgeFileInputRef.current?.click();
  };

  const handleFiles = async (files: File[]) => {
    const validFiles = files.filter((file) => {
      const isValidType = isAllowedContentType(file.type);
      const isValidExtension = isAllowedFileExt(extname(file.name));
      return isValidType || isValidExtension;
    });

    if (validFiles.length > 0) {
      setIsUploading(true);
      await uploadKnowledgeFiles(validFiles);
      setIsUploading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };
  return (
    <div>
      <input
        type="file"
        ref={knowledgeFileInputRef}
        multiple
        accept=".pdf,.txt,.md,.csv,.json"
        className="hidden"
        onChange={handleFileInputChange}
      />

      <Button
        type="button"
        variant="outline"
        onClick={triggerFileInput}
        disabled={isUploading || disabled}
      >
        <Icon name="add" size={16} />
        Add file
      </Button>
    </div>
  );
}
