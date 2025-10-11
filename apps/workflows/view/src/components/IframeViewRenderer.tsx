/**
 * IFRAME VIEW RENDERER
 *
 * Renders custom views (HTML + JS) in isolated iframe
 * Data passed via window.viewData
 * Message passing for input views
 */

import { useEffect, useRef } from "react";

interface IframeViewRendererProps {
  html: string;
  data: Record<string, unknown>;
  onSubmit?: (data: Record<string, unknown>) => void;
  height?: string;
}

export function IframeViewRenderer({
  html,
  data,
  onSubmit,
  height = "300px",
}: IframeViewRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  console.log("🖼️ [IframeView] Rendering iframe view");
  console.log("🖼️ [IframeView] HTML length:", html.length);
  console.log("🖼️ [IframeView] Data:", data);

  useEffect(() => {
    console.log("🔄 [IframeView] useEffect triggered");

    if (!iframeRef.current) {
      console.warn("⚠️ [IframeView] No iframe ref");
      return;
    }

    const iframe = iframeRef.current;

    // Wait for iframe to load
    const handleLoad = () => {
      console.log("📥 [IframeView] Iframe loaded");

      if (!iframe.contentWindow) {
        console.warn("⚠️ [IframeView] No contentWindow");
        return;
      }

      // Inject data into iframe
      console.log("💉 [IframeView] Injecting data via postMessage");
      iframe.contentWindow.postMessage({ type: "viewData", data }, "*");

      // Also set as global (for simpler access in scripts)
      try {
        (iframe.contentWindow as any).viewData = data;
        console.log("✅ [IframeView] window.viewData set successfully");
      } catch (e) {
        console.warn(
          "⚠️ [IframeView] Could not set window.viewData (cross-origin?)",
        );
      }
    };

    iframe.addEventListener("load", handleLoad);

    // Listen for messages from iframe (input views)
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;

      console.log("📨 [IframeView] Message from iframe:", event.data);

      if (
        (event.data.type === "submit" ||
          event.data.type === "inputViewSubmit") &&
        onSubmit
      ) {
        console.log(
          "📨 [IframeView] Form submitted from iframe:",
          event.data.data,
        );
        onSubmit(event.data.data);
      }
    };

    globalThis.addEventListener("message", handleMessage);

    return () => {
      console.log("🧹 [IframeView] Cleaning up listeners");
      iframe.removeEventListener("load", handleLoad);
      globalThis.removeEventListener("message", handleMessage);
    };
  }, [html, data, onSubmit]);

  // Inject data directly in <head> (synchronous, runs before any user scripts)
  // Escape data properly for safe injection
  const dataJson = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  const htmlWithData = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <script>
    // ✅ Data injected FIRST (synchronous, in <head>)
    window.viewData = ${dataJson};
    console.log('📦 [ViewData] Pre-loaded in <head>:', window.viewData);
    console.log('📦 [ViewData] Keys:', Object.keys(window.viewData));
  </script>
</head>
<body>
  ${html}
</body>
</html>`;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={htmlWithData}
      sandbox="allow-scripts allow-same-origin"
      className="w-full border-none rounded-xl bg-background"
      style={{ height }}
      title="Custom View"
    />
  );
}
