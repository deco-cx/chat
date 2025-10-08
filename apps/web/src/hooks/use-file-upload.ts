import { useSDK, useWriteFile } from "@deco/sdk";
import { Hosts } from "@deco/sdk/hosts";
import type { DragEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { formatFilename } from "../utils/format.ts";
import {
  onResourceError,
  onResourceLoaded,
  onResourceLoading,
} from "../utils/events.ts";

export interface UploadedFile {
  file: File;
  url?: string;
  status: "uploading" | "done" | "error";
  error?: string;
  clientId?: string;
}

interface UseFileUploadOptions {
  maxFiles?: number;
  acceptedTypes?: string;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { maxFiles = 5 } = options;
  const { locator } = useSDK();
  const writeFileMutation = useWriteFile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  async function uploadFile(file: File) {
    try {
      const path = `uploads/${formatFilename(file.name)}-${Date.now()}`;
      const buffer = await file.arrayBuffer();
      await writeFileMutation.mutateAsync({
        path,
        contentType: file.type,
        content: new Uint8Array(buffer),
      });

      const url = `https://${Hosts.API_LEGACY}/files/${locator}/${path}`; // does not work when running locally

      setUploadedFiles((prev) =>
        prev.map((uf) =>
          uf.file === file
            ? { ...uf, url: url || undefined, status: "done" }
            : uf,
        ),
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
            : uf,
        ),
      );
    }
  }

  async function uploadFileList(fileList: FileList) {
    const newFiles = Array.from(fileList);

    // Prevent duplicates and limit to max files
    const allFiles = [...uploadedFiles.map((uf) => uf.file), ...newFiles].slice(
      0,
      maxFiles,
    );

    const uniqueFiles = Array.from(
      new Map(allFiles.map((f) => [f.name + f.size, f])).values(),
    );

    const filesToUpload = uniqueFiles
      .filter(
        (file) =>
          !uploadedFiles.some(
            (uf) => uf.file.name === file.name && uf.file.size === file.size,
          ),
      )
      .map((file): UploadedFile => ({ file, status: "uploading" }));

    setUploadedFiles((prev) => [...prev, ...filesToUpload]);
    await Promise.all(filesToUpload.map(({ file }) => uploadFile(file)));
  }

  function handleFileDrop(e: DragEvent) {
    e.preventDefault();

    const fileList = e.dataTransfer?.files;
    if (fileList?.length) {
      uploadFileList(fileList);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;

    if (fileList?.length) {
      uploadFileList(fileList);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFile(index: number) {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function openFileDialog() {
    fileInputRef.current?.click();
  }

  function clearFiles() {
    setUploadedFiles([]);
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }

    if (files.length > 0) {
      // Create a FileList-like object
      const fileList = {
        length: files.length,
        item: (index: number) => files[index] || null,
        [Symbol.iterator]: function* () {
          for (const file of files) {
            yield file;
          }
        },
      } as FileList;

      uploadFileList(fileList);
    }
  }

  // Global file drop handler
  useEffect(() => {
    /**
     * These drag events conflict with the ones from dockview.
     * This variable is true when dragging elements from dockview, preventing
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

  // Listen for resource lifecycle events from mentions and manage uploadedFiles
  useEffect(() => {
    const offLoading = onResourceLoading(({ detail }) => {
      if (!detail?.clientId) return;
      const file = new File([new Blob()], detail.name || "resource", {
        type: detail.contentType || "application/octet-stream",
      });
      setUploadedFiles((prev) => [
        ...prev,
        { file, status: "uploading", clientId: detail.clientId },
      ]);
    });

    const offLoaded = onResourceLoaded(async ({ detail }) => {
      if (!detail?.clientId || !detail?.url) return;
      try {
        const res = await fetch(detail.url);
        const blob = await res.blob();
        const file = new File([blob], detail.name || "resource", {
          type: detail.contentType || blob.type || "application/octet-stream",
        });
        setUploadedFiles((prev) =>
          prev.map((uf) =>
            uf.clientId === detail.clientId
              ? { ...uf, file, url: detail.url, status: "done" }
              : uf,
          ),
        );
      } catch (err) {
        setUploadedFiles((prev) =>
          prev.map((uf) =>
            uf.clientId === detail.clientId
              ? {
                  ...uf,
                  status: "error",
                  error: err instanceof Error ? err.message : "Failed to load",
                }
              : uf,
          ),
        );
      }
    });

    const offError = onResourceError(({ detail }) => {
      if (!detail?.clientId) return;
      setUploadedFiles((prev) =>
        prev.map((uf) =>
          uf.clientId === detail.clientId
            ? {
                ...uf,
                status: "error",
                error: detail.error || "Failed to read",
              }
            : uf,
        ),
      );
    });

    return () => {
      offLoading();
      offLoaded();
      offError();
    };
  }, []);

  return {
    uploadedFiles,
    setUploadedFiles,
    isDragging,
    fileInputRef,
    handleFileChange,
    handlePaste,
    removeFile,
    openFileDialog,
    clearFiles,
  };
}
