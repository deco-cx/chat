import React, { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { CanvasData, CanvasTool } from "@deco/sdk";
import { createEmptyCanvas } from "@deco/sdk";

export interface SimpleCanvasProps {
  /** Canvas data */
  data?: CanvasData;
  /** Callback when canvas data changes */
  onChange?: (data: CanvasData) => void;
  /** Whether the canvas is read-only */
  readOnly?: boolean;
  /** Whether to show the toolbar */
  showToolbar?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Callback when "Send to Chat" is clicked */
  onSendToChat?: () => void;
}

interface DrawingElement {
  id: string;
  type: CanvasTool;
  x: number;
  y: number;
  width?: number;
  height?: number;
  points?: { x: number; y: number }[];
  text?: string;
  color: string;
  selected?: boolean;
}

interface SimpleCanvasState {
  tool: CanvasTool;
  isDrawing: boolean;
  isDragging: boolean;
  startPoint: { x: number; y: number } | null;
  dragOffset: { x: number; y: number } | null;
  elements: DrawingElement[];
  currentElement: DrawingElement | null;
  selectedElementId: string | null;
  editingTextId: string | null;
}

const TOOLS: { id: CanvasTool; icon: string; label: string }[] = [
  { id: "select", icon: "mouse", label: "Select" },
  { id: "text", icon: "text_fields", label: "Text" },
  { id: "rectangle", icon: "crop_din", label: "Rectangle" },
  { id: "circle", icon: "radio_button_unchecked", label: "Circle" },
  { id: "arrow", icon: "arrow_forward", label: "Arrow" },
];

export function SimpleCanvas({
  data = createEmptyCanvas(),
  onChange,
  readOnly = false,
  showToolbar = true,
  className,
  onSendToChat,
}: SimpleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const [canvasState, setCanvasState] = useState<SimpleCanvasState>({
    tool: "select",
    isDrawing: false,
    isDragging: false,
    startPoint: null,
    dragOffset: null,
    elements: [],
    currentElement: null,
    selectedElementId: null,
    editingTextId: null,
  });

  // Hit testing - find element at given position
  const getElementAt = useCallback(
    (x: number, y: number): DrawingElement | null => {
      // Check in reverse order (top to bottom)
      for (let i = canvasState.elements.length - 1; i >= 0; i--) {
        const element = canvasState.elements[i];

        switch (element.type) {
          case "text":
            if (element.text) {
              // Text hit area is roughly 16px high and text width
              const textWidth = element.text.length * 10; // Rough estimate
              if (
                x >= element.x && x <= element.x + textWidth &&
                y >= element.y && y <= element.y + 20
              ) {
                return element;
              }
            }
            break;

          case "rectangle":
          case "circle":
            if (element.width && element.height) {
              if (
                x >= element.x && x <= element.x + element.width &&
                y >= element.y && y <= element.y + element.height
              ) {
                return element;
              }
            }
            break;

          case "arrow":
            if (element.points && element.points.length >= 2) {
              const start = element.points[0];
              const end = element.points[element.points.length - 1];
              // Simple line hit test - check if point is close to the line
              const dist = distanceToLineSegment(
                x,
                y,
                start.x,
                start.y,
                end.x,
                end.y,
              );
              if (dist < 10) { // 10px tolerance
                return element;
              }
            }
            break;
        }
      }
      return null;
    },
    [canvasState.elements],
  );

  // Distance from point to line segment
  const distanceToLineSegment = (
    px: number,
    py: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): number => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    if (length === 0) {
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    const t = Math.max(
      0,
      Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (length * length)),
    );
    const projection = { x: x1 + t * dx, y: y1 + t * dy };
    return Math.sqrt(
      (px - projection.x) * (px - projection.x) +
        (py - projection.y) * (py - projection.y),
    );
  };

  // Redraw canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw all elements
    const allElements = [...canvasState.elements];
    if (canvasState.currentElement) {
      allElements.push(canvasState.currentElement);
    }

    allElements.forEach((element) => {
      ctx.strokeStyle = element.color;
      ctx.fillStyle = element.color;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      // Draw selection outline
      if (element.selected || element.id === canvasState.selectedElementId) {
        ctx.save();
        ctx.strokeStyle = "#2563eb";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        switch (element.type) {
          case "text":
            if (element.text) {
              const textWidth = element.text.length * 10;
              ctx.strokeRect(element.x - 2, element.y - 2, textWidth + 4, 20);
            }
            break;
          case "rectangle":
          case "circle":
            if (element.width && element.height) {
              ctx.strokeRect(
                element.x - 2,
                element.y - 2,
                element.width + 4,
                element.height + 4,
              );
            }
            break;
          case "arrow":
            if (element.points && element.points.length >= 2) {
              const start = element.points[0];
              const end = element.points[element.points.length - 1];
              const minX = Math.min(start.x, end.x) - 10;
              const minY = Math.min(start.y, end.y) - 10;
              const maxX = Math.max(start.x, end.x) + 10;
              const maxY = Math.max(start.y, end.y) + 10;
              ctx.strokeRect(minX, minY, maxX - minX, maxY - minY);
            }
            break;
        }
        ctx.restore();
      }

      // Draw the element
      ctx.strokeStyle = element.color;
      ctx.fillStyle = element.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      switch (element.type) {
        case "rectangle":
          if (element.width && element.height) {
            ctx.strokeRect(element.x, element.y, element.width, element.height);
          }
          break;

        case "circle":
          if (element.width && element.height) {
            const centerX = element.x + element.width / 2;
            const centerY = element.y + element.height / 2;
            const radiusX = Math.abs(element.width) / 2;
            const radiusY = Math.abs(element.height) / 2;

            ctx.beginPath();
            ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
            ctx.stroke();
          }
          break;

        case "arrow":
          if (element.points && element.points.length >= 2) {
            const start = element.points[0];
            const end = element.points[element.points.length - 1];

            // Draw line
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Draw arrowhead
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLength = 15;

            ctx.beginPath();
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
              end.x - headLength * Math.cos(angle - Math.PI / 6),
              end.y - headLength * Math.sin(angle - Math.PI / 6),
            );
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
              end.x - headLength * Math.cos(angle + Math.PI / 6),
              end.y - headLength * Math.sin(angle + Math.PI / 6),
            );
            ctx.stroke();
          }
          break;

        case "text":
          if (element.text) {
            ctx.font =
              '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            ctx.fillText(element.text, element.x, element.y + 16);
          }
          break;
      }
    });
  }, [
    canvasState.elements,
    canvasState.currentElement,
    canvasState.selectedElementId,
  ]);

  // Initialize canvas and set up redraw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redraw();
    };

    resizeCanvas();
    globalThis.addEventListener("resize", resizeCanvas);
    return () => globalThis.removeEventListener("resize", resizeCanvas);
  }, [redraw]);

  // Redraw when state changes
  useEffect(() => {
    redraw();
  }, [redraw]);

  // Note: We don't auto-update canvas data to avoid infinite loops
  // Instead, we call updateCanvasData explicitly when we modify elements

  // Get mouse position relative to canvas
  const getMousePos = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };

      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [],
  );

  // Handle tool change
  const handleToolChange = useCallback((tool: CanvasTool) => {
    setCanvasState((prev) => ({
      ...prev,
      tool,
      selectedElementId: null,
      editingTextId: null,
    }));
  }, []);

  // Handle text editing
  const startTextEdit = useCallback((elementId: string) => {
    setCanvasState((prev) => ({ ...prev, editingTextId: elementId }));
    setTimeout(() => textInputRef.current?.focus(), 0);
  }, []);

  const finishTextEdit = useCallback((newText: string) => {
    if (canvasState.editingTextId) {
      setCanvasState((prev) => {
        const updatedElements = prev.elements.map((el) =>
          el.id === prev.editingTextId ? { ...el, text: newText || "Text" } : el
        );

        // Update canvas data immediately
        const updatedData = {
          ...data,
          elements: updatedElements
            .filter((el) => el.type !== "select")
            .map((el) => ({
              id: el.id,
              type: el.type as "text" | "rectangle" | "circle" | "arrow",
              x: el.x,
              y: el.y,
              rotation: 0,
              strokeColor: el.color,
              strokeWidth: 2,
              fontSize: 16,
              opacity: 1,
              locked: false,
              roughness: 1,
              width: el.width,
              height: el.height,
              points: el.points,
              text: el.text,
            })),
          lastModified: Date.now(),
        };
        onChange?.(updatedData);

        return {
          ...prev,
          elements: updatedElements,
          editingTextId: null,
        };
      });
    }
  }, [canvasState.editingTextId, data, onChange]);

  // Handle pointer down
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      const pos = getMousePos(e);

      if (canvasState.tool === "select") {
        const hitElement = getElementAt(pos.x, pos.y);

        if (hitElement) {
          // Double-click to edit text
          if (
            hitElement.type === "text" &&
            canvasState.selectedElementId === hitElement.id
          ) {
            startTextEdit(hitElement.id);
            return;
          }

          // Select and prepare for dragging
          setCanvasState((prev) => ({
            ...prev,
            selectedElementId: hitElement.id,
            isDragging: true,
            startPoint: pos,
            dragOffset: {
              x: pos.x - hitElement.x,
              y: pos.y - hitElement.y,
            },
          }));
        } else {
          // Deselect
          setCanvasState((prev) => ({
            ...prev,
            selectedElementId: null,
          }));
        }
        return;
      }

      // Creating new elements
      let newElement: DrawingElement;

      switch (canvasState.tool) {
        case "text": {
          const text = prompt("Enter text:") || "Text";
          newElement = {
            id: crypto.randomUUID(),
            type: "text",
            x: pos.x,
            y: pos.y,
            text,
            color: "#000000",
          };
          setCanvasState((prev) => {
            const updatedElements = [...prev.elements, newElement];

            // Update canvas data immediately
            const updatedData = {
              ...data,
              elements: updatedElements
                .filter((el) => el.type !== "select")
                .map((el) => ({
                  id: el.id,
                  type: el.type as "text" | "rectangle" | "circle" | "arrow",
                  x: el.x,
                  y: el.y,
                  rotation: 0,
                  strokeColor: el.color,
                  strokeWidth: 2,
                  fontSize: 16,
                  opacity: 1,
                  locked: false,
                  roughness: 1,
                  width: el.width,
                  height: el.height,
                  points: el.points,
                  text: el.text,
                })),
              lastModified: Date.now(),
            };
            onChange?.(updatedData);

            return {
              ...prev,
              elements: updatedElements,
            };
          });
          return;
        }

        default:
          newElement = {
            id: crypto.randomUUID(),
            type: canvasState.tool,
            x: pos.x,
            y: pos.y,
            width: 0,
            height: 0,
            color: "#000000",
          };

          if (canvasState.tool === "arrow") {
            newElement.points = [pos, pos];
          }
          break;
      }

      setCanvasState((prev) => ({
        ...prev,
        isDrawing: true,
        startPoint: pos,
        currentElement: newElement,
      }));
    },
    [
      readOnly,
      getMousePos,
      canvasState.tool,
      canvasState.selectedElementId,
      getElementAt,
      startTextEdit,
      data,
      onChange,
    ],
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (readOnly) return;

      const pos = getMousePos(e);

      // Handle dragging selected element
      if (
        canvasState.isDragging && canvasState.selectedElementId &&
        canvasState.dragOffset
      ) {
        setCanvasState((prev) => ({
          ...prev,
          elements: prev.elements.map((el) =>
            el.id === prev.selectedElementId
              ? {
                ...el,
                x: pos.x - prev.dragOffset!.x,
                y: pos.y - prev.dragOffset!.y,
              }
              : el
          ),
        }));
        return;
      }

      // Handle drawing new element
      if (
        !canvasState.isDrawing || !canvasState.startPoint ||
        !canvasState.currentElement
      ) return;

      const startPoint = canvasState.startPoint;

      setCanvasState((prev) => {
        if (!prev.currentElement) return prev;

        let updatedElement: DrawingElement;

        switch (prev.currentElement.type) {
          case "rectangle":
          case "circle":
            updatedElement = {
              ...prev.currentElement,
              x: Math.min(startPoint.x, pos.x),
              y: Math.min(startPoint.y, pos.y),
              width: Math.abs(pos.x - startPoint.x),
              height: Math.abs(pos.y - startPoint.y),
            };
            break;

          case "arrow":
            updatedElement = {
              ...prev.currentElement,
              points: [startPoint, pos],
            };
            break;

          default:
            updatedElement = prev.currentElement;
            break;
        }

        return {
          ...prev,
          currentElement: updatedElement,
        };
      });
    },
    [
      readOnly,
      getMousePos,
      canvasState.isDragging,
      canvasState.selectedElementId,
      canvasState.dragOffset,
      canvasState.isDrawing,
      canvasState.startPoint,
      canvasState.currentElement,
    ],
  );

  // Handle pointer up
  const handlePointerUp = useCallback(() => {
    if (canvasState.isDragging) {
      setCanvasState((prev) => {
        // Update canvas data after dragging
        const updatedData = {
          ...data,
          elements: prev.elements
            .filter((el) => el.type !== "select")
            .map((el) => ({
              id: el.id,
              type: el.type as "text" | "rectangle" | "circle" | "arrow",
              x: el.x,
              y: el.y,
              rotation: 0,
              strokeColor: el.color,
              strokeWidth: 2,
              fontSize: 16,
              opacity: 1,
              locked: false,
              roughness: 1,
              width: el.width,
              height: el.height,
              points: el.points,
              text: el.text,
            })),
          lastModified: Date.now(),
        };
        onChange?.(updatedData);

        return {
          ...prev,
          isDragging: false,
          startPoint: null,
          dragOffset: null,
        };
      });
      return;
    }

    if (!canvasState.isDrawing || !canvasState.currentElement) return;

    setCanvasState((prev) => {
      const updatedElements = [...prev.elements, prev.currentElement!];

      // Update canvas data immediately
      const updatedData = {
        ...data,
        elements: updatedElements
          .filter((el) => el.type !== "select")
          .map((el) => ({
            id: el.id,
            type: el.type as "text" | "rectangle" | "circle" | "arrow",
            x: el.x,
            y: el.y,
            rotation: 0,
            strokeColor: el.color,
            strokeWidth: 2,
            fontSize: 16,
            opacity: 1,
            locked: false,
            roughness: 1,
            width: el.width,
            height: el.height,
            points: el.points,
            text: el.text,
          })),
        lastModified: Date.now(),
      };
      onChange?.(updatedData);

      return {
        ...prev,
        isDrawing: false,
        startPoint: null,
        elements: updatedElements,
        currentElement: null,
      };
    });
  }, [
    canvasState.isDragging,
    canvasState.isDrawing,
    canvasState.currentElement,
    data,
    onChange,
  ]);

  // Clear canvas
  const handleClear = useCallback(() => {
    setCanvasState((prev) => {
      // Update canvas data immediately
      const updatedData = {
        ...data,
        elements: [],
        lastModified: Date.now(),
      };
      onChange?.(updatedData);

      return {
        ...prev,
        elements: [],
        currentElement: null,
        selectedElementId: null,
        editingTextId: null,
      };
    });
  }, [data, onChange]);

  // Delete selected element
  const handleDelete = useCallback(() => {
    if (canvasState.selectedElementId) {
      setCanvasState((prev) => {
        const updatedElements = prev.elements.filter((el) =>
          el.id !== prev.selectedElementId
        );

        // Update canvas data immediately
        const updatedData = {
          ...data,
          elements: updatedElements
            .filter((el) => el.type !== "select")
            .map((el) => ({
              id: el.id,
              type: el.type as "text" | "rectangle" | "circle" | "arrow",
              x: el.x,
              y: el.y,
              rotation: 0,
              strokeColor: el.color,
              strokeWidth: 2,
              fontSize: 16,
              opacity: 1,
              locked: false,
              roughness: 1,
              width: el.width,
              height: el.height,
              points: el.points,
              text: el.text,
            })),
          lastModified: Date.now(),
        };
        onChange?.(updatedData);

        return {
          ...prev,
          elements: updatedElements,
          selectedElementId: null,
        };
      });
    }
  }, [canvasState.selectedElementId, data, onChange]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (canvasState.editingTextId) return; // Don't handle shortcuts while editing text

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      }
    };

    globalThis.addEventListener("keydown", handleKeyDown);
    return () => globalThis.removeEventListener("keydown", handleKeyDown);
  }, [handleDelete, canvasState.editingTextId]);

  const editingElement = canvasState.editingTextId
    ? canvasState.elements.find((el) => el.id === canvasState.editingTextId)
    : null;

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {showToolbar && (
        <div className="flex items-center gap-2 p-2 border-b bg-muted/30">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1">
            {TOOLS.map((tool) => (
              <Tooltip key={tool.id}>
                <TooltipTrigger asChild>
                  <Button
                    variant={canvasState.tool === tool.id ? "default" : "ghost"}
                    size="sm"
                    onClick={() => handleToolChange(tool.id)}
                    disabled={readOnly}
                    className="w-9 h-9 p-0"
                  >
                    <Icon name={tool.icon} size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{tool.label}</TooltipContent>
              </Tooltip>
            ))}

            <Separator orientation="vertical" className="h-6 ml-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  disabled={readOnly}
                  className="w-9 h-9 p-0"
                >
                  <Icon name="clear" size={16} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear</TooltipContent>
            </Tooltip>

            {canvasState.selectedElementId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={readOnly}
                    className="w-9 h-9 p-0"
                  >
                    <Icon name="delete" size={16} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete (Del/Backspace)</TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Send to Chat */}
          {onSendToChat && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSendToChat}
                  className="gap-2"
                >
                  <Icon name="send" size={16} />
                  Send to Chat
                </Button>
              </TooltipTrigger>
              <TooltipContent>Send Canvas to Chat</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Canvas Area */}
      <div className="flex-1 relative bg-white">
        <canvas
          ref={canvasRef}
          className={cn(
            "absolute inset-0 w-full h-full",
            canvasState.tool === "select"
              ? "cursor-default"
              : "cursor-crosshair",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          style={{ touchAction: "none" }}
        />

        {/* Text editing overlay */}
        {editingElement && (
          <Input
            ref={textInputRef}
            defaultValue={editingElement.text || ""}
            onBlur={(e) => finishTextEdit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                finishTextEdit(e.currentTarget.value);
              } else if (e.key === "Escape") {
                setCanvasState((prev) => ({ ...prev, editingTextId: null }));
              }
            }}
            className="absolute z-10 border-2 border-primary"
            style={{
              left: editingElement.x,
              top: editingElement.y,
              width: Math.max(100, (editingElement.text?.length || 0) * 10),
              height: 20,
              fontSize: "16px",
              font:
                '16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          />
        )}

        {canvasState.elements.length === 0 && !canvasState.currentElement && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground pointer-events-none">
            <div className="text-center">
              <Icon
                name="crop_din"
                size={48}
                className="mx-auto mb-2 opacity-50"
              />
              <p className="text-lg font-medium">Canvas</p>
              <p className="text-sm">
                Create diagrams with text, shapes, and arrows
              </p>
              <p className="text-xs mt-2">
                Select tool: click to select, drag to move, double-click text to
                edit
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
