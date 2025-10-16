import { useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@deco/ui/components/dialog.tsx";

interface CustomViewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewCode: string;
  outputData: unknown;
  stepName: string;
}

export function CustomViewModal({
  open,
  onOpenChange,
  viewCode,
  outputData,
  stepName,
}: CustomViewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Pre-inject data into viewCode SYNCHRONOUSLY (useMemo runs during render)
  const viewCodeWithData = useMemo(() => {
    if (!viewCode) return "";

    // Inject data directly into the HTML before the iframe loads it
    const dataScript = `
      <script>
        window.viewData = ${JSON.stringify(outputData)};
        console.log('✅ [CustomViewModal] Data pre-injected:', window.viewData);
      </script>
    `;

    // Insert data script right after opening <div> or at the start
    if (viewCode.includes("<div")) {
      // Insert after first opening div tag
      return viewCode.replace(/(<div[^>]*>)/, `$1${dataScript}`);
    }
    // Prepend if no div found
    return dataScript + viewCode;
  }, [viewCode, outputData]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{stepName} - Output View</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          <iframe
            ref={iframeRef}
            srcDoc={viewCodeWithData}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              background: "transparent",
            }}
            sandbox="allow-scripts allow-same-origin"
            title="Custom Output View (Expanded)"
            className="rounded-lg"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
