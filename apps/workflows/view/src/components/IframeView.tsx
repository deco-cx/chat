/**
 * Iframe View Renderer - Minimal Implementation
 *
 * Renders HTML in isolated iframe with XSS warnings
 */

import { useEffect, useRef, useState } from "react";

interface IframeViewProps {
  html: string;
  allowSandbox?: boolean; // Default: true
}

export function IframeView({ html, allowSandbox = true }: IframeViewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [xssWarning, setXssWarning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("🖼️ [IframeView] Rendering:", {
      htmlLength: html.length,
      allowSandbox,
      hasScriptTag: html.includes("<script"),
    });

    // XSS Detection
    if (
      html.includes("<script") ||
      html.includes("onerror=") ||
      html.includes("onclick=")
    ) {
      console.warn(
        "⚠️ [IframeView] XSS Warning: HTML contains potentially unsafe content",
      );
      setXssWarning(true);
    }

    try {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const iframeDoc =
        iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        throw new Error("Cannot access iframe document");
      }

      // Inject HTML
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      console.log("✅ [IframeView] HTML injected");

      // Auto-resize
      const resizeIframe = () => {
        if (iframeDoc.body) {
          const height = iframeDoc.body.scrollHeight;
          iframe.style.height = `${height + 20}px`;
        }
      };

      // Initial resize
      setTimeout(resizeIframe, 100);

      // Resize on content changes
      const observer = new MutationObserver(resizeIframe);
      if (iframeDoc.body) {
        observer.observe(iframeDoc.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });
      }

      return () => observer.disconnect();
    } catch (err) {
      console.error("❌ [IframeView] Error:", err);
      setError(String(err));
    }
  }, [html, allowSandbox]);

  return (
    <div>
      {/* XSS Warning Banner */}
      {xssWarning && (
        <div className="p-3 bg-warning/10 border border-warning/50 rounded-lg mb-3 flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-warning m-0">
              XSS Warning
            </p>
            <p className="text-xs text-warning-foreground m-0">
              This view contains potentially unsafe HTML. Review before using in
              production.
            </p>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive">
          <p className="font-semibold mb-2">Failed to render view</p>
          <pre className="text-xs overflow-auto">{error}</pre>
        </div>
      )}

      {/* Iframe */}
      {!error && (
        <iframe
          ref={iframeRef}
          sandbox={allowSandbox ? "allow-same-origin" : undefined}
          className="w-full border border-border rounded-lg min-h-[200px] bg-background"
          title="Custom View"
        />
      )}
    </div>
  );
}
