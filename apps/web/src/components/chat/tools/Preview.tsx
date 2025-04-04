import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useEffect, useState } from "react";
import { togglePanel } from "../../agent/index.tsx";

interface PreviewProps {
  type: "url" | "html";
  title?: string;
  content: string;
  className?: string;
}

const wrapHtmlContent = (content: string) =>
  `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
      :root { zoom: 0.8; }
      body { margin: 0; }
    </style>
  </head>
  <body>${content}</body>
</html>`.trim();

type FileType = "image" | "video" | "audio" | "pdf" | "text" | "other";

interface FetchResult {
  blobUrl: string | null;
  fileType: FileType | null;
  blob?: Blob | null;
  isDone: boolean;
}

const RETRY_CONFIG = {
  maxAttempts: 20,
  maxDelay: 10000, // 10 seconds
};

async function fetchWithRetry(
  url: string,
  attempt = 1,
): Promise<FetchResult> {
  try {
    const res = await fetch(url);
    const contentType = res.headers.get("content-type");

    if (contentType?.includes("image")) {
      const blob = await res.blob();

      if (blob.size > 0) {
        return {
          blobUrl: URL.createObjectURL(blob),
          fileType: "image",
          blob: blob,
          isDone: true,
        };
      }
    }

    if (attempt < RETRY_CONFIG.maxAttempts) {
      const delay = Math.min(
        1000 * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, attempt + 1);
    }

    return { blobUrl: null, fileType: null, blob: null, isDone: true };
  } catch (_error) {
    if (attempt < RETRY_CONFIG.maxAttempts) {
      const delay = Math.min(
        1000 * Math.pow(2, attempt - 1),
        RETRY_CONFIG.maxDelay,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, attempt + 1);
    }
    return { blobUrl: null, fileType: null, blob: null, isDone: true };
  }
}

interface PreviewState {
  blobUrl: string | null;
  fileType: FileType | null;
  loading: boolean;
}

export function Preview({ type, content, title, className }: PreviewProps) {
  const [previewState, setPreviewState] = useState<PreviewState>({
    blobUrl: null,
    fileType: null,
    loading: true,
  });

  const iframeProps = type === "url"
    ? { src: content }
    : { srcDoc: wrapHtmlContent(content) };

  const handleExpand = () => {
    togglePanel({
      id: `preview-${title?.toLowerCase().replace(/\s+/g, "-")}`,
      component: "preview",
      title: title || "Preview",
      params: iframeProps,
      position: { direction: "right" },
      initialWidth: 400,
    });
  };

  useEffect(() => {
    let isMounted = true;

    const loadPreview = async () => {
      if (type === "url") {
        const result = await fetchWithRetry(content);
        if (isMounted) {
          setPreviewState((prev: PreviewState) => ({
            ...prev,
            ...result,
            loading: !result.isDone,
          }));
        }
      } else {
        if (isMounted) {
          setPreviewState((prev: PreviewState) => ({
            ...prev,
            loading: false,
          }));
        }
      }
    };

    loadPreview();

    return () => {
      isMounted = false;
      if (previewState.blobUrl) {
        URL.revokeObjectURL(previewState.blobUrl);
      }
    };
  }, [content, type]);

  return (
    <div
      className={cn(
        "relative w-max flex flex-col rounded-lg mb-4 p-1",
        className,
      )}
    >
      <div className="flex items-center justify-between p-2 pr-0">
        <div className="flex items-center gap-2">
          <Icon name="draft" className="text-sm text-muted-foreground" />
          <p className="text-sm font-medium tracking-tight">
            {title || "Preview"}
          </p>
        </div>
        <Button
          onClick={handleExpand}
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-full hover:bg-muted"
          aria-label="Expand preview"
        >
          <Icon
            name="expand_content"
            className="text-sm text-muted-foreground"
          />
        </Button>
      </div>

      <div className="w-max relative h-[420px] min-h-0 aspect-[4/5]">
        {previewState.fileType && previewState.fileType !== "image" && (
          <iframe
            {...iframeProps}
            className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
            sandbox="allow-scripts"
            title={title || "Preview content"}
            onLoad={() =>
              setPreviewState((prev) => ({ ...prev, loading: false }))}
          />
        )}

        {previewState.fileType === "image" && previewState.blobUrl && (
          <img
            src={previewState.blobUrl}
            alt={title || "Preview"}
            className="absolute inset-0 w-full h-full rounded-2xl shadow-lg"
          />
        )}

        {previewState.loading && (
          <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-opacity-80 bg-white rounded-lg">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}
