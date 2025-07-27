# Canvas Feature Specification for deco.chat

## Overview

This document outlines the implementation of a new **Canvas View** for
deco.chat - a minimal, fast, and intuitive drawing canvas that allows users to
create simple diagrams and notes within agent conversations.

## Background

Drawing and visual thinking are essential for communication, but existing
solutions like Excalidraw and tldraw, while powerful, are too complex for daily
use. Users need a lightweight canvas that integrates seamlessly into their
workflow without overwhelming them with features.

## Goals

1. **Simplicity**: Minimal UI with only essential drawing tools
2. **Speed**: Fast rendering and responsiveness
3. **Integration**: Seamless integration with deco.chat's agent system
4. **Persistence**: Always-saved JSON format for drawings
5. **Referenceability**: Ability to reference canvas content in chat via
   `@canvas`

## Features

### Core Drawing Tools

- **Text**: Add text annotations
- **Rectangle**: Draw rectangular shapes
- **Circle**: Draw circular shapes
- **Arrow**: Draw arrows for connections
- **Free Drawing**: Pen tool for freehand sketching

### Canvas Properties

- **Infinite Canvas**: Zoom and pan for large diagrams
- **Auto-save**: Changes saved automatically to JSON format
- **Terse JSON**: Optimized data format for minimal storage
- **Undo/Redo**: Standard editing operations

### Integration Features

- **@canvas Reference**: Type `@canvas` in chat to include canvas JSON
- **Send to Chat Button**: One-click to add `@canvas` to chat input
- **Agent View Tab**: Canvas appears as a new view type alongside Chat, Profile,
  etc.

## Architecture

### Data Model

```typescript
interface CanvasElement {
  id: string;
  type: "text" | "rectangle" | "circle" | "arrow" | "freehand";
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation?: number;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  // Type-specific properties
  text?: string;
  fontSize?: number;
  points?: { x: number; y: number }[]; // For freehand and arrows
}

interface CanvasData {
  version: string;
  elements: CanvasElement[];
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}
```

### Storage

Canvas data will be stored in the database as part of the agent's views system:

```sql
-- Extend existing deco_chat_views table
-- Canvas data stored in metadata.canvasData as JSONB
```

### View System Integration

The Canvas will integrate with deco.chat's existing view system:

1. **View Type**: New view type `"canvas"` added to the system
2. **Tab Integration**: Canvas appears as a tab in agent editing interface
3. **Permission System**: Uses existing role-based access controls

## Implementation Plan

### Phase 1: Core Canvas Engine (Week 1)

- [ ] Canvas component with basic rendering
- [ ] Tool selection UI (text, rectangle, circle, arrow, pen)
- [ ] Mouse/touch interaction handling
- [ ] Element creation and manipulation
- [ ] Basic zoom and pan functionality

### Phase 2: Data Persistence (Week 1)

- [ ] JSON serialization/deserialization
- [ ] Auto-save functionality
- [ ] Undo/redo system
- [ ] Canvas data storage in database

### Phase 3: View System Integration (Week 2)

- [ ] Canvas view component
- [ ] Integration with agent tabs system
- [ ] Canvas data CRUD operations
- [ ] View permissions and access control

### Phase 4: Chat Integration (Week 2)

- [ ] `@canvas` mention system
- [ ] Canvas JSON inclusion in chat messages
- [ ] "Send to Chat" button functionality
- [ ] Chat rendering of canvas references

### Phase 5: Polish & Performance (Week 3)

- [ ] Performance optimization for large canvases
- [ ] Mobile responsiveness
- [ ] Keyboard shortcuts
- [ ] Export functionality (PNG, SVG)
- [ ] Import from other formats (optional)

## Technical Considerations

### Canvas Rendering

- **HTML5 Canvas**: Primary rendering method for performance
- **SVG Fallback**: For accessibility and crisp scaling
- **React Integration**: Canvas component wrapped in React for state management

### Performance

- **Viewport Culling**: Only render elements in current view
- **Batch Operations**: Group multiple changes for efficient updates
- **Web Workers**: Consider for complex operations if needed

### Common Patterns Analysis

Based on research of Excalidraw and tldraw:

**Shared Patterns:**

- Element-based architecture (each drawing element is an object)
- JSON serialization for data persistence
- Viewport/camera system for zoom and pan
- Tool-based interaction model
- Undo/redo via command pattern

**Our Simplified Approach:**

- Fewer tools (5 vs 15+ in full-featured tools)
- No collaboration features initially
- No complex styling options
- Focus on speed over features

## User Experience

### Workflow

1. User opens agent in edit mode
2. Clicks on "Canvas" tab
3. Draws diagram using simple tools
4. Canvas auto-saves continuously
5. User clicks "Send to Chat" or types `@canvas` in chat
6. Canvas JSON is included in message for AI agent processing

### UI Design Principles

- **Minimal Toolbar**: Only essential tools visible
- **Clean Canvas**: No grid, rulers, or complex UI elements
- **Touch-Friendly**: Large touch targets for mobile use
- **Keyboard Shortcuts**: Power user efficiency

## Success Metrics

1. **Adoption Rate**: % of agents with canvas content
2. **Usage Frequency**: Canvas interactions per user session
3. **Chat Integration**: % of canvas references in chat messages
4. **Performance**: Canvas load time < 100ms
5. **User Satisfaction**: Qualitative feedback on simplicity vs. functionality

## Future Enhancements (Post-MVP)

- **Templates**: Pre-made diagram templates
- **Shape Library**: Additional shapes as needed
- **Collaboration**: Real-time editing (if demand exists)
- **AI Integration**: Agent-generated diagrams
- **Export Options**: PDF, PNG, SVG export
- **Import Support**: Import from Excalidraw/tldraw files

## Risk Mitigation

1. **Performance Issues**: Implement viewport culling and efficient rendering
2. **User Adoption**: Focus on simplicity and integration
3. **Feature Creep**: Strict adherence to minimal feature set
4. **Mobile Experience**: Responsive design and touch optimization
5. **Data Loss**: Robust auto-save and backup systems

## Conclusion

The Canvas feature will provide deco.chat users with a powerful yet simple
visual thinking tool that integrates seamlessly with their agent workflows. By
focusing on essential features and excellent performance, we can deliver a
drawing tool that users will actually adopt and use daily.

The key to success is maintaining the balance between functionality and
simplicity - providing just enough features to be useful while avoiding the
complexity that makes other tools intimidating for casual use.
