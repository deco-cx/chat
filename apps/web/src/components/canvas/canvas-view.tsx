import React, { useCallback, useState } from "react";
import type { CanvasData } from "@deco/sdk";
import { createEmptyCanvas } from "@deco/sdk";
import { useChatContext } from "../chat/context.tsx";
import { SimpleCanvas } from "./simple-canvas.tsx";

export interface CanvasViewProps {
  /** Initial canvas data */
  initialData?: CanvasData;
  /** Callback when canvas data changes */
  onChange?: (data: CanvasData) => void;
  /** Whether the canvas is read-only */
  readOnly?: boolean;
  /** Callback when "Send to Chat" is clicked */
  onSendToChat?: () => void;
}

export function CanvasView({
  initialData,
  onChange,
  readOnly = false,
  onSendToChat,
}: CanvasViewProps) {
  const [canvasData, setCanvasData] = useState<CanvasData>(
    () => initialData || createEmptyCanvas(),
  );

  // Try to get chat context if available (will be undefined if not in chat context)
  let chatContext: ReturnType<typeof useChatContext> | null = null;
  try {
    chatContext = useChatContext();
  } catch {
    // Not in chat context, which is fine
  }

  const handleDataChange = useCallback((newData: CanvasData) => {
    setCanvasData(newData);
    onChange?.(newData);
  }, [onChange]);

  const handleSendToChat = useCallback(() => {
    if (onSendToChat) {
      onSendToChat();
    } else if (chatContext?.chat?.handleInputChange) {
      // Canvas data is now lightweight (no freehand), so it's safe to send directly
      const canvasJson = JSON.stringify(canvasData, null, 2);
      const message = `Here's my canvas:\n\n\`\`\`json\n${canvasJson}\n\`\`\``;
      chatContext.chat.handleInputChange({
        target: { value: message },
      } as React.ChangeEvent<HTMLTextAreaElement>);
    }
  }, [onSendToChat, canvasData, chatContext]);

  return (
    <SimpleCanvas
      data={canvasData}
      onChange={handleDataChange}
      readOnly={readOnly}
      onSendToChat={handleSendToChat}
      showToolbar
      className="h-full"
    />
  );
}
