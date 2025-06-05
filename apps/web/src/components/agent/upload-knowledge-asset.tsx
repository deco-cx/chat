import { useMemo, useRef, useState } from "react";
import {
  useAddFileToKnowledgeBase,
  useDeleteFile,
  useFiles,
  useReadFile,
  useWriteFile,
} from "@deco/sdk";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  FormDescription,
  FormItem,
  FormLabel,
} from "@deco/ui/components/form.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useAgentSettingsForm } from "./edit.tsx";

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

function KnowledgeBaseFileList(
  { files, title, agentId }: {
    agentId: string;
    title: string;
    files: {
      name: string;
      type: string;
      uploading?: boolean;
      size?: number;
      file_url?: string;
    }[];
  },
) {
  const prefix = agentKnowledgeBasePath(agentId);
  const removeFile = useDeleteFile();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        {title} ({files.length})
      </p>
      <div className="space-y-2 max-h-40 overflow-y-auto">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                {file.uploading
                  ? (
                    <Icon
                      name="hourglass_empty"
                      size={16}
                      className="text-primary animate-spin"
                    />
                  )
                  : (
                    <Icon
                      name={file.type.includes("pdf") ||
                          file.name.endsWith(".pdf")
                        ? "picture_as_pdf"
                        : file.name.endsWith(".csv")
                        ? "table_chart"
                        : file.name.endsWith(".json")
                        ? "code"
                        : file.name.endsWith(".md") ||
                            file.name.endsWith(".txt")
                        ? "description"
                        : "insert_drive_file"}
                      size={16}
                      className="text-primary"
                    />
                  )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {file.name}
                </p>
                <div className="flex items-center gap-2">
                  {file.size && (
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  )}
                  {file.uploading && (
                    <span className="text-xs text-primary">
                      Uploading...
                    </span>
                  )}
                  {file.file_url && file.uploading === false && (
                    <span className="text-xs text-muted-foreground">
                      ✓ Uploaded
                    </span>
                  )}
                </div>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                file.file_url &&
                removeFile.mutateAsync({ root: prefix, path: file.file_url })}
              className="flex-shrink-0 h-8 w-8 p-0"
              disabled={!file.file_url}
            >
              <Icon name="close" size={16} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgentKnowledgeBaseFileList({ agentId }: { agentId: string }) {
  const prefix = agentKnowledgeBasePath(agentId);
  const { data: files } = useFiles({ root: prefix });
  const formatedFiles = useMemo(() =>
    files
      ? files.map((file) => ({
        file_url: file.file_url,
        name: file.file_url.replace(prefix, ""),
        type: file.metadata?.type ?? "",
      }))
      : [], [prefix, files]);

  return (
    <KnowledgeBaseFileList
      agentId={agentId}
      files={formatedFiles}
      title="Current Files"
    />
  );
}

const agentKnowledgeBasePath = (agentId: string) =>
  `agent/${agentId}/knowledge`;
const agentKnowledgeBaseFilepath = (agentId: string, path: string) =>
  `${agentKnowledgeBasePath(agentId)}/${path}`;

export default function UploadKnowledgeBaseAsset() {
  const { agent } = useAgentSettingsForm();
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    { file: File; file_url?: string; uploading?: boolean }[]
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const knowledgeFileInputRef = useRef<HTMLInputElement>(null);
  const writeFileMutation = useWriteFile();
  const addFileToKnowledgeBase = useAddFileToKnowledgeBase();
  const readFile = useReadFile();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
  };

  const handleFiles = async (files: File[]) => {
    // Filter for supported file types - only pdf, txt, md, csv, json
    const supportedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "text/csv",
      "application/json",
    ];

    const validFiles = files.filter((file) => {
      const isValidType = supportedTypes.includes(file.type);
      const isValidExtension = file.name.endsWith(".pdf") ||
        file.name.endsWith(".txt") ||
        file.name.endsWith(".md") ||
        file.name.endsWith(".csv") ||
        file.name.endsWith(".json");
      return isValidType || isValidExtension;
    });

    if (validFiles.length !== files.length) {
      alert(
        "Some files were skipped. Only PDF, TXT, MD, CSV, and JSON files are supported.",
      );
    }

    if (validFiles.length > 0) {
      // Add files to state with uploading status
      const fileObjects = validFiles.map((file) => ({ file, uploading: true }));
      setUploadedFiles((prev) => [...prev, ...fileObjects]);

      // Upload files
      await uploadKnowledgeFiles(validFiles);
    }
  };

  const uploadKnowledgeFiles = async (files: File[]) => {
    setIsUploading(true);

    try {
      // Upload each file using the writeFileMutation
      const uploadPromises = files.map(async (file) => {
        try {
          const filename = file.name;
          const path = agentKnowledgeBaseFilepath(agent.id, filename);
          const buffer = await file.arrayBuffer();

          // add metadata
          const savedResponse = await writeFileMutation.mutateAsync({
            path,
            contentType: file.type || "application/octet-stream",
            content: new Uint8Array(buffer),
            metadata: {
              agentId: agent.id,
              type: file.type,
            },
          });

          if (!savedResponse.ok) {
            // TODO: handle erro
            return;
          }

          const fileUrl = await readFile(
            path,
          );

          if (!fileUrl) {
            // TODO delete file
            return;
          }

          // TODO: get knowledge based by id like `agent-${id}` or create
          const content = await addFileToKnowledgeBase.mutateAsync({
            fileUrl,
            metadata: {
              internalFs: "true",
              path,
              fileUrl: "",
            },
          });

          // Update the file object with the URL and remove uploading status
          setUploadedFiles((prev) =>
            prev.map((fileObj) => {
              if (fileObj.file === file) {
                return {
                  ...fileObj,
                  file_url: path,
                  uploading: false,
                  content,
                };
              }
              return fileObj;
            })
          );

          console.log(`Successfully uploaded: ${file.name} to ${path}`);
          return { file, url: path };
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);

          // Remove failed upload from the list
          setUploadedFiles((prev) =>
            prev.filter((fileObj) => fileObj.file !== file)
          );

          throw error;
        }
      });

      await Promise.all(uploadPromises);
      console.log("All files uploaded successfully");
    } catch (error) {
      console.error("Failed to upload some knowledge files:", error);
      alert("Failed to upload some files. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const triggerFileInput = () => {
    knowledgeFileInputRef.current?.click();
  };

  return (
    <FormItem>
      <FormLabel>Knowledge Files</FormLabel>
      <FormDescription className="text-xs text-muted-foreground">
        Upload documents to enhance your agent's knowledge base. Supports PDF,
        TXT, MD, CSV, and JSON files.
      </FormDescription>

      <AgentKnowledgeBaseFileList agentId={agent.id} />

      <div className="space-y-4">
        {/* Drag and Drop Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
            isDragOver
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50",
            isUploading && "opacity-50 pointer-events-none",
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <input
            type="file"
            ref={knowledgeFileInputRef}
            multiple
            accept=".pdf,.txt,.md,.csv,.json"
            className="hidden"
            onChange={handleFileInputChange}
          />

          <div className="flex flex-col items-center gap-3">
            <div
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                isDragOver ? "bg-primary text-primary-foreground" : "bg-muted",
              )}
            >
              <Icon
                name={isUploading ? "hourglass_empty" : "upload"}
                size={24}
                className={isUploading ? "animate-spin" : ""}
              />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium">
                {isUploading
                  ? "Uploading files..."
                  : isDragOver
                  ? "Drop files here"
                  : "Drag and drop files here"}
              </p>
              <p className="text-xs text-muted-foreground">
                or click to browse files
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Supports: PDF, TXT, MD, CSV, JSON
            </p>
          </div>
        </div>

        {/* Uploaded Files List */}
        <KnowledgeBaseFileList
          title="Uploaded Files"
          agentId={agent.id}
          files={uploadedFiles.map(({ file, uploading, file_url }) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            file_url: file_url,
            uploading,
          }))}
        />
      </div>
    </FormItem>
  );
}
