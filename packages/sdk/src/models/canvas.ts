import { z } from "zod";

// Canvas element types
export type CanvasElementType =
  | "text"
  | "rectangle"
  | "circle"
  | "arrow"
  | "freehand";

// Base canvas element schema
export const CanvasElementSchema = z.object({
  id: z.string().describe("Unique identifier for the element"),
  type: z.enum(["text", "rectangle", "circle", "arrow", "freehand"]).describe(
    "Type of canvas element",
  ),
  x: z.number().describe("X coordinate position"),
  y: z.number().describe("Y coordinate position"),
  width: z.number().optional().describe("Element width"),
  height: z.number().optional().describe("Element height"),
  rotation: z.number().optional().default(0).describe(
    "Rotation angle in degrees",
  ),
  strokeColor: z.string().default("#000000").describe("Stroke color"),
  fillColor: z.string().optional().describe("Fill color"),
  strokeWidth: z.number().default(2).describe("Stroke width"),

  // Type-specific properties
  text: z.string().optional().describe("Text content for text elements"),
  fontSize: z.number().optional().default(16).describe(
    "Font size for text elements",
  ),
  points: z.array(z.object({
    x: z.number(),
    y: z.number(),
  })).optional().describe("Points for freehand and arrow elements"),

  // Metadata
  opacity: z.number().optional().default(1).describe("Element opacity"),
  locked: z.boolean().optional().default(false).describe(
    "Whether element is locked from editing",
  ),
  roughness: z.number().optional().default(1).describe(
    "Roughness for hand-drawn aesthetic",
  ),
});

export type CanvasElement = z.infer<typeof CanvasElementSchema>;

// Viewport schema
export const ViewportSchema = z.object({
  x: z.number().default(0).describe("Viewport X offset"),
  y: z.number().default(0).describe("Viewport Y offset"),
  zoom: z.number().default(1).describe("Zoom level"),
});

export type Viewport = z.infer<typeof ViewportSchema>;

// Main canvas data schema
export const CanvasDataSchema = z.object({
  version: z.string().default("1.0").describe("Canvas data format version"),
  elements: z.array(CanvasElementSchema).default([]).describe(
    "Array of canvas elements",
  ),
  viewport: ViewportSchema.default({ x: 0, y: 0, zoom: 1 }).describe(
    "Current viewport state",
  ),
  appState: z.object({
    selectedElementIds: z.array(z.string()).optional().default([]).describe(
      "Currently selected elements",
    ),
    selectedTool: z.enum([
      "select",
      "text",
      "rectangle",
      "circle",
      "arrow",
      "freehand",
    ]).default("select").describe("Currently selected tool"),
    gridSize: z.number().optional().default(20).describe(
      "Grid size for snapping",
    ),
    showGrid: z.boolean().optional().default(false).describe(
      "Whether to show grid",
    ),
  }).optional().describe("Application state"),
  lastModified: z.number().optional().describe(
    "Timestamp of last modification",
  ),
});

export type CanvasData = z.infer<typeof CanvasDataSchema>;

// Canvas tool types
export type CanvasTool =
  | "select"
  | "text"
  | "rectangle"
  | "circle"
  | "arrow"
  | "freehand";

// Canvas interaction state
export interface CanvasState {
  tool: CanvasTool;
  selectedElements: Set<string>;
  isDrawing: boolean;
  isDragging: boolean;
  dragStart?: { x: number; y: number };
  currentElement?: Partial<CanvasElement>;
}

// Canvas event types
export interface CanvasPointerEvent {
  x: number;
  y: number;
  pressure?: number;
  shiftKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
}

// Canvas history for undo/redo
export interface CanvasHistoryEntry {
  elements: CanvasElement[];
  appState: CanvasData["appState"];
  timestamp: number;
}

// Canvas bounds for viewport culling
export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Helper function to create a new canvas element
export function createCanvasElement(
  type: CanvasElementType,
  x: number,
  y: number,
  options: Partial<CanvasElement> = {},
): CanvasElement {
  const id = crypto.randomUUID();

  const baseElement: CanvasElement = {
    id,
    type,
    x,
    y,
    strokeColor: "#000000",
    strokeWidth: 2,
    rotation: 0,
    opacity: 1,
    locked: false,
    roughness: 1,
    ...options,
  } as CanvasElement;

  // Set default dimensions based on type
  switch (type) {
    case "rectangle":
    case "circle":
      baseElement.width = options.width ?? 100;
      baseElement.height = options.height ?? 100;
      break;
    case "text":
      baseElement.text = options.text ?? "Text";
      baseElement.fontSize = options.fontSize ?? 16;
      break;
    case "arrow":
      baseElement.points = options.points ?? [{ x: 0, y: 0 }, { x: 100, y: 0 }];
      break;
    case "freehand":
      baseElement.points = options.points ?? [];
      break;
  }

  return baseElement;
}

// Helper function to get element bounds
export function getElementBounds(element: CanvasElement): CanvasBounds {
  const { x, y, width = 0, height = 0, points } = element;

  if (points && points.length > 0) {
    const xs = points.map((p) => p.x + x);
    const ys = points.map((p) => p.y + y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }

  return {
    minX: x,
    minY: y,
    maxX: x + width,
    maxY: y + height,
  };
}

// Helper function to check if point is inside element
export function isPointInElement(
  x: number,
  y: number,
  element: CanvasElement,
): boolean {
  const bounds = getElementBounds(element);
  return x >= bounds.minX && x <= bounds.maxX &&
    y >= bounds.minY && y <= bounds.maxY;
}

// Helper function to create empty canvas data
export function createEmptyCanvas(): CanvasData {
  return {
    version: "1.0",
    elements: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    appState: {
      selectedElementIds: [],
      selectedTool: "select",
      gridSize: 20,
      showGrid: false,
    },
    lastModified: Date.now(),
  };
}
