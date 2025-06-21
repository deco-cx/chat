# Spaces Feature Implementation

## Overview

The Spaces feature allows users to save different tab/dock arrangements for agent editing with custom themes. This creates a more organized and efficient editing experience by providing pre-configured layouts for different workflows.

## What's Been Implemented

### 1. Agent Model Updates

**File**: `packages/sdk/src/models/agent.ts`

Added `spaces` field to the Agent schema:

```typescript
export const AgentSchema = z.object({
  // ... existing fields ...
  /** Saved spaces configurations */
  spaces: z.record(SpaceSchema).optional().describe(
    "Saved spaces configurations for different editing layouts",
  ),
});

const SpaceSchema = z.object({
  /** Name of the space */
  title: z.string().describe("Name of the space"),
  /** Dock/tab layout configuration */
  viewSetup: z.record(z.any()).describe("Dock/tab layout configuration"),
  /** Theme configuration for this space */
  theme: z.record(z.string()).optional().describe("Theme configuration for this space"),
});

export type Space = z.infer<typeof SpaceSchema>;
```

### 2. Database Schema Updates

**File**: `supabase/migrations/20250103000000_add_spaces_column.sql`

```sql
-- Add spaces column to deco_chat_agents table
ALTER TABLE deco_chat_agents ADD COLUMN spaces jsonb DEFAULT '{}';

-- Add a comment to document the column
COMMENT ON COLUMN deco_chat_agents.spaces IS 'Saved space configurations for different editing layouts';
```

**File**: `packages/sdk/src/storage/supabase/schema.ts`

Updated the `deco_chat_agents` table type definitions to include the `spaces` column.

### 3. Space Selector Component

**File**: `apps/web/src/components/agent/space-selector.tsx`

A dropdown component that allows users to:
- Switch between existing spaces
- Save new spaces
- View current space configuration

```typescript
interface SpaceSelectorProps {
  spaces: Record<string, Space>;
  currentSpace: string;
  onSpaceChange: (spaceId: string) => void;
  onSaveSpace: (spaceId: string, spaceName: string) => void;
  onDeleteSpace?: (spaceId: string) => void;
  className?: string;
}
```

Features:
- **Dropdown interface** with current space indicator
- **Save dialog** for creating new spaces
- **Visual feedback** for current selection
- **Icon integration** using Material Design icons

### 4. Space Management Hook

**File**: `apps/web/src/components/agent/hooks/use-spaces.ts`

A React hook that manages:
- **URL-based space navigation** (using search params)
- **Default "Edit" space** configuration
- **Tab configuration** based on space settings
- **Space CRUD operations**

```typescript
export function useSpaces({ agent, baseTabs, onSpaceChange }: UseSpacesOptions) {
  return {
    spaces,
    currentSpace: currentSpaceId,
    currentSpaceData: currentSpace,
    tabsForSpace,
    changeSpace,
    saveSpace,
    deleteSpace,
  };
}
```

Default Edit space configuration:
```typescript
const DEFAULT_EDIT_SPACE: Space = {
  title: "Edit",
  viewSetup: {
    layout: "default",
    openPanels: ["chat", "prompt", "integrations", "setup"],
    initialLayout: {
      chat: { position: "left", initialOpen: true },
      prompt: { position: "within", initialOpen: true },
      integrations: { position: "within", initialOpen: true },
      setup: { position: "right", initialOpen: true },
    },
  },
  theme: {
    "--background": "oklch(1 0 0)",
    "--foreground": "oklch(26.8% 0.007 34.298)",
  },
};
```

### 5. Enhanced Agent Edit Interface

**File**: `apps/web/src/components/agent/edit.tsx`

Updated the agent editing interface to:
- **Integrate Space Selector** in the action buttons area
- **Use space-configured tabs** instead of hardcoded tabs
- **Handle space changes** with URL updates
- **Provide feedback** for space operations

Key changes:
- Added `SpaceSelector` component to action buttons
- Integrated `useSpaces` hook for space management
- Updated `PageLayout` key to re-render on space changes
- Added space save functionality with user feedback

## How It Works

### Space Selection Flow

1. **User opens agent edit page**: Defaults to "Edit" space
2. **User clicks Space Selector**: Dropdown shows available spaces
3. **User selects different space**: URL updates, tabs reconfigure
4. **User arranges tabs**: Can save current arrangement as new space

### URL Structure

```
/agent/{agentId}/{threadId}?space={spaceId}
```

- No `space` parameter = "Edit" space (default)
- `?space=custom` = Custom saved space
- Space changes update URL for shareable links

### Data Flow

```
Agent.spaces -> useSpaces -> SpaceSelector
                     ↓
               Tab Configuration
                     ↓
                PageLayout/Dock
```

## Features Implemented

### ✅ Core Functionality
- [x] Space selector dropdown
- [x] Default "Edit" space
- [x] URL-based space navigation
- [x] Space save dialog
- [x] Tab configuration per space
- [x] Database schema updates
- [x] Agent model integration

### ✅ User Experience
- [x] Visual feedback for current space
- [x] Toast notifications for space operations
- [x] Responsive design
- [x] Icon integration
- [x] Keyboard shortcuts (Enter to save)

### ✅ Technical Integration
- [x] React Router integration
- [x] Form state management
- [x] Type safety with Zod schemas
- [x] Database migration
- [x] Supabase schema updates

## Example Usage

### Creating a New Space

1. User arranges tabs in desired layout
2. Clicks Space Selector → "Save as new space"
3. Enters space name (e.g., "Development")
4. New space is saved with current layout
5. Space appears in dropdown for future use

### Switching Spaces

1. User clicks Space Selector
2. Sees list: "Edit ✓", "Development", "Testing"
3. Clicks "Development"
4. URL updates to `?space=development`
5. Tabs reconfigure to saved layout
6. Theme changes if space has custom theme

### Sharing Space Links

Users can share direct links to specific spaces:
- `https://app.deco.chat/agent/123/456` (Edit space)
- `https://app.deco.chat/agent/123/456?space=development` (Development space)

## Architecture Benefits

### 1. **Modular Design**
- Space logic separated into dedicated hook
- Reusable SpaceSelector component
- Clean separation of concerns

### 2. **URL-First Approach**
- Shareable space configurations
- Browser back/forward support
- Deep linking capabilities

### 3. **Type Safety**
- Zod schema validation
- TypeScript interfaces
- Runtime type checking

### 4. **Extensible**
- Easy to add new space features
- Theme system integration ready
- Custom dock layouts supported

## Future Enhancements

### Possible Extensions
- **Space templates**: Pre-built spaces for common workflows
- **Space sharing**: Export/import space configurations
- **Advanced themes**: Full theme customization per space
- **Space analytics**: Track which spaces are most used
- **Space permissions**: Team-level space sharing

This implementation provides a solid foundation for the Spaces feature while maintaining the existing functionality and following the project's architectural patterns.