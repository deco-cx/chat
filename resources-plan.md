# Resources 2.0 Implementation Plan

## Overview

This document outlines the implementation plan for Resources 2.0, a major version upgrade that introduces standardized resource management, view system, and workflow capabilities while maintaining backward compatibility with existing `DECO_CHAT_RESOURCES` implementations.

## What Already Exists

Before implementing Resources 2.0, it's important to understand what's already available in the codebase that can be reused:

### Existing Binding System ✅

**Location**: `packages/sdk/src/mcp/bindings/`

- **`ToolBinder` type**: Already defined in `binder.ts` with `name`, `inputSchema`, `outputSchema`, and `opt` properties
- **`Binder` type**: Generic type for binding definitions
- **`BinderImplementation` type**: Type for implementing bindings
- **`bindingClient` function**: Creates binding clients with `.implements()` and `.forConnection()` methods
- **`impl` function**: Helper to create tool implementations from bindings
- **`Binding` utility**: Helper to check if tools implement a binding using `isImplementedBy()`

### Existing Resource Schemas ✅

**Location**: `packages/runtime/src/resources.ts`

- **`ResourceSchema`**: Base resource schema with `name`, `title`, `description`, `uri`, `mimeType`, `thumbnail`, `timestamp`, `size`, `annotations`
- **Input/Output Schemas**: Complete set of schemas for all CRUD operations:
  - `ResourcesReadInputSchema` / `ResourcesReadOutputSchema`
  - `ResourceSearchInputSchema` / `ResourceSearchOutputSchema`
  - `ResourceCreateInputSchema` / `ResourceCreateOutputSchema`
  - `ResourceUpdateInputSchema` / `ResourceUpdateOutputSchema`
  - `ResourceDeleteInputSchema` / `ResourceDeleteOutputSchema`
  - `ResourcesListInputSchema` / `ResourcesListOutputSchema`

### Existing Resource Bindings ✅

**Location**: `packages/sdk/src/mcp/bindings/resources.ts`

- **`RESOURCE_BINDING_SCHEMA`**: Complete binding schema for `DECO_CHAT_RESOURCES_*` tools
- **WellKnownBindings**: Already includes `Resources` binding in the registry

### Existing Workflow Implementation ✅

**Location**: `packages/sdk/src/mcp/workflows/`

- **Workflow schemas**: `WorkflowDefinitionSchema`, `WorkflowStepDefinitionSchema`, etc.
- **Workflow resource**: `WorkflowResource` using `DeconfigResource.define()`
- **Workflow tools**: `startWorkflow`, `getWorkflowStatus` tools
- **Workflow views**: `workflowViews` implementation using `VIEW_BINDING_SCHEMA`
- **Integration with existing system**: Already uses `DECO_CHAT_RESOURCES_*` tools

### Existing View System ✅

**Location**: `packages/sdk/src/mcp/bindings/views.ts`

- **`VIEW_BINDING_SCHEMA`**: Binding schema for `DECO_CHAT_VIEWS_*` tools
- **View implementations**: Examples in workflows showing how to create views

### What We DON'T Need to Re-implement

1. **Tool binding system** - Complete and working
2. **Resource CRUD schemas** - Already defined in workers-runtime
3. **Resource binding schemas** - Already defined and working
4. **Workflow schemas and basic implementation** - Already exists
5. **View binding schemas** - Already defined
6. **`impl` helper function** - Already exists and working
7. **Binding checking utilities** - Already exists

### What We DO Need to Implement

1. **Resources 2.0 schemas** - New standardized schemas with `rsc://` URI format
2. **Helper functions** - Factory functions for easy resource/workflow/view creation
3. **Resources 2.0 bindings** - New `deco_resource_*` and `deco_view_*` tool names
4. **Workflow 2.0 implementation** - Enhanced workflow system using Resources 2.0
5. **Views 2.0 implementation** - New `DECO_VIEWS` system
6. **Migration utilities** - Help migrate from old to new systems

## Goals

1. **Create Resources 2.0** - New major version with standardized schemas and tool bindings
2. **Maintain Backward Compatibility** - Keep existing `DECO_CHAT_RESOURCES` working
3. **Helper Functions** - Create utilities to easily define resources, workflows, and views
4. **Override Workflows** - Replace current workflow implementation with Resources 2.0
5. **New Views System** - Create `DECO_VIEWS` (v2) alongside existing `DECO_CHAT_VIEWS`

## Architecture Overview

```
packages/sdk/src/mcp/
├── resources-v2/           # New Resources 2.0 implementation
│   ├── schemas/           # Standardized schemas
│   ├── helpers/           # Helper functions
│   ├── bindings/          # Tool bindings
│   └── implementations/   # Resource implementations
├── workflows-v2/          # New Workflow 2.0 (overrides current)
├── views-v2/              # New Views 2.0 (DECO_VIEWS)
└── [existing code]        # Current implementations (unchanged)
```

## Phase 1: Core Infrastructure

### 1.1 Create Resources 2.0 Schemas

**File: `packages/sdk/src/mcp/resources-v2/schemas.ts`**

```typescript
import { z } from "zod";

// Base resource data schema
export const BaseResourceDataSchema = z.object({
  title: z.string(),
});

// Common URI format validation
export const ResourceUriSchema = z.string().regex(
  /^rsc:\/\/[^\/]+\/[^\/]+\/.+$/,
  "Invalid resource URI format"
);

// Tool binding interface - ALREADY EXISTS in packages/sdk/src/mcp/bindings/binder.ts
// We can reuse the existing ToolBinder type instead of creating a new interface
// export interface ToolBinding {
//   name: string;
//   inputSchema: z.ZodTypeAny;
//   outputSchema: z.ZodTypeAny;
//   optional?: boolean;
// }

// Search schemas
export const SearchInputSchema = z.object({
  term: z.string().optional(),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  filters: z.record(z.any()).optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export function createSearchOutputSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    totalCount: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1),
    totalPages: z.number().int().min(0),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  });
}

// Read schemas
export const ReadInputSchema = z.object({
  uri: ResourceUriSchema,
});

export function createReadOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,
    data: dataSchema,
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    created_by: z.string().optional(),
    updated_by: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  });
}

// Create schemas
export function createCreateInputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
  });
}

export function createCreateOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,
    data: dataSchema,
    created_at: z.string().datetime().optional(),
    created_by: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  });
}

// Update schemas
export function createUpdateInputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,
    data: dataSchema,
  });
}

export function createUpdateOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,
    data: dataSchema,
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    created_by: z.string().optional(),
    updated_by: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  });
}

// Delete schemas
export const DeleteInputSchema = z.object({
  uri: ResourceUriSchema,
});

export const DeleteOutputSchema = z.object({
  success: z.boolean(),
  uri: ResourceUriSchema,
});

// Generic item schema factory
export function createItemSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,
    data: dataSchema,
    created_at: z.string().datetime().optional(),
    updated_at: z.string().datetime().optional(),
    created_by: z.string().optional(),
    updated_by: z.string().optional(),
    timestamp: z.string().datetime().optional(),
  });
}
```

### 1.2 Create Resource Helper Functions

**File: `packages/sdk/src/mcp/resources-v2/helpers.ts`**

```typescript
import { z } from "zod";
import { createTool, impl, type AppContext, type ToolBinder } from "../../index.ts";
import {
  BaseResourceDataSchema,
  createCreateInputSchema,
  createCreateOutputSchema,
  createItemSchema,
  createReadOutputSchema,
  createSearchOutputSchema,
  createUpdateInputSchema,
  createUpdateOutputSchema,
  DeleteInputSchema,
  DeleteOutputSchema,
  ReadInputSchema,
  SearchInputSchema,
} from "../schemas/index.ts";

// Use existing ToolBinder type instead of creating new ToolBinding interface

export interface ResourceDefinition<TDataSchema extends z.ZodTypeAny> {
  name: string;
  dataSchema: TDataSchema;
  searchHandler: (input: z.infer<typeof SearchInputSchema>, c: AppContext) => Promise<z.infer<ReturnType<typeof createSearchOutputSchema>>>;
  readHandler: (input: z.infer<typeof ReadInputSchema>, c: AppContext) => Promise<z.infer<ReturnType<typeof createReadOutputSchema>>>;
  createHandler?: (input: z.infer<ReturnType<typeof createCreateInputSchema>>, c: AppContext) => Promise<z.infer<ReturnType<typeof createCreateOutputSchema>>>;
  updateHandler?: (input: z.infer<ReturnType<typeof createUpdateInputSchema>>, c: AppContext) => Promise<z.infer<ReturnType<typeof createUpdateOutputSchema>>>;
  deleteHandler?: (input: z.infer<typeof DeleteInputSchema>, c: AppContext) => Promise<z.infer<ReturnType<typeof DeleteOutputSchema>>>;
}

export function createResourceTools<TDataSchema extends z.ZodTypeAny>(
  definition: ResourceDefinition<TDataSchema>
): ToolBinder[] {
  const itemSchema = createItemSchema(definition.dataSchema);
  const bindings: ToolBinder[] = [];

  // Required tools
  bindings.push({
    name: `DECO_RESOURCE_${definition.name.toUpperCase()}_SEARCH`,
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(itemSchema),
    optional: false,
  });

  bindings.push({
    name: `DECO_RESOURCE_${definition.name.toUpperCase()}_READ`,
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(definition.dataSchema),
    optional: false,
  });

  // Optional tools
  if (definition.createHandler) {
    bindings.push({
      name: `DECO_RESOURCE_${definition.name.toUpperCase()}_CREATE`,
      inputSchema: createCreateInputSchema(definition.dataSchema),
      outputSchema: createCreateOutputSchema(definition.dataSchema),
      optional: true,
    });
  }

  if (definition.updateHandler) {
    bindings.push({
      name: `DECO_RESOURCE_${definition.name.toUpperCase()}_UPDATE`,
      inputSchema: createUpdateInputSchema(definition.dataSchema),
      outputSchema: createUpdateOutputSchema(definition.dataSchema),
      optional: true,
    });
  }

  if (definition.deleteHandler) {
    bindings.push({
      name: `DECO_RESOURCE_${definition.name.toUpperCase()}_DELETE`,
      inputSchema: DeleteInputSchema,
      outputSchema: DeleteOutputSchema,
      optional: true,
    });
  }

  return bindings;
}

export function createResourceImplementation<TDataSchema extends z.ZodTypeAny>(
  definition: ResourceDefinition<TDataSchema>
) {
  const tools = createResourceTools(definition);
  
  // Use existing impl function from packages/sdk/src/mcp/bindings/binder.ts
  return impl(tools, [
    // Search implementation
    {
      description: `Search ${definition.name} resources`,
      handler: definition.searchHandler,
    },
    // Read implementation
    {
      description: `Read a ${definition.name} resource`,
      handler: definition.readHandler,
    },
    // Optional create implementation
    ...(definition.createHandler ? [{
      description: `Create a new ${definition.name} resource`,
      handler: definition.createHandler,
    }] : []),
    // Optional update implementation
    ...(definition.updateHandler ? [{
      description: `Update a ${definition.name} resource`,
      handler: definition.updateHandler,
    }] : []),
    // Optional delete implementation
    ...(definition.deleteHandler ? [{
      description: `Delete a ${definition.name} resource`,
      handler: definition.deleteHandler,
    }] : []),
  ]);
}
```

### 1.3 Create Workflow-Specific Tool Bindings

**File: `packages/sdk/src/mcp/resources-v2/helpers/workflow-tools.ts`**

```typescript
import { z } from "zod";
import type { Binder } from "../../bindings/binder.ts";
import { ResourceUriSchema } from "../schemas/index.ts";

// Workflow-specific tool bindings (execution only, not CRUD)
export const WORKFLOW_TOOLS_BINDING_SCHEMA = [
  {
    name: "deco_workflow_start" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema,
      parameters: z.record(z.any()).optional(),
    }),
    outputSchema: z.object({
      executionId: z.string(),
      status: z.enum(["started", "queued", "failed"]),
      message: z.string().optional(),
    }),
  },
  {
    name: "deco_workflow_terminate" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      terminatedExecutions: z.array(z.string()).optional(),
    }),
  },
  {
    name: "deco_workflow_get_status" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional(),
    }),
    outputSchema: z.object({
      status: z.enum(["running", "completed", "failed", "terminated", "queued"]),
      progress: z.number().min(0).max(100).optional(),
      startedAt: z.string().datetime().optional(),
      completedAt: z.string().datetime().optional(),
      error: z.string().optional(),
    }),
  },
  {
    name: "deco_workflow_get_logs" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional(),
      limit: z.number().int().min(1).max(1000).default(100),
    }),
    outputSchema: z.object({
      logs: z.array(z.object({
        timestamp: z.string().datetime(),
        level: z.enum(["info", "warn", "error", "debug"]),
        message: z.string(),
        data: z.record(z.any()).optional(),
      })),
      totalCount: z.number().int().min(0),
    }),
    opt: true, // Optional tool
  },
  {
    name: "deco_workflow_get_executions" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema,
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
      status: z.enum(["running", "completed", "failed", "terminated"]).optional(),
    }),
    outputSchema: z.object({
      executions: z.array(z.object({
        executionId: z.string(),
        status: z.enum(["running", "completed", "failed", "terminated", "queued"]),
        startedAt: z.string().datetime(),
        completedAt: z.string().datetime().optional(),
        duration: z.number().optional(),
      })),
      totalCount: z.number().int().min(0),
    }),
    opt: true, // Optional tool
  },
] as const satisfies Binder;

// Note: Workflow CRUD operations (deco_resource_workflow_*) are handled by DeconfigResource 2.0
// This binding only contains workflow execution tools (deco_workflow_*)
```

### 1.4 Create View Helper Functions

**File: `packages/sdk/src/mcp/resources-v2/helpers/view-factory.ts`**

```typescript
import { z } from "zod";
import { createTool, type AppContext } from "../../index.ts";
import {
  BaseResourceDataSchema,
  createCreateInputSchema,
  createCreateOutputSchema,
  createItemSchema,
  createReadOutputSchema,
  createSearchOutputSchema,
  createUpdateInputSchema,
  createUpdateOutputSchema,
  DeleteInputSchema,
  DeleteOutputSchema,
  ReadInputSchema,
  ResourceUriSchema,
  SearchInputSchema,
  type ToolBinding,
} from "../schemas/index.ts";

// View data schema
export const ViewDataSchema = BaseResourceDataSchema.extend({
  icon: z.string().url(),
  prompt: z.string(),
  tools: z.array(z.string()),
});

export interface ViewDefinition {
  name: string;
  searchHandler: (input: z.infer<typeof SearchInputSchema>, c: AppContext) => Promise<z.infer<ReturnType<typeof createSearchOutputSchema>>>;
  readHandler: (input: z.infer<typeof ReadInputSchema>, c: AppContext) => Promise<z.infer<ReturnType<typeof createReadOutputSchema>>>;
  createHandler?: (input: z.infer<ReturnType<typeof createCreateInputSchema>>, c: AppContext) => Promise<z.infer<ReturnType<typeof createCreateOutputSchema>>>;
  updateHandler?: (input: z.infer<ReturnType<typeof createUpdateInputSchema>>, c: AppContext) => Promise<z.infer<ReturnType<typeof createUpdateOutputSchema>>>;
  deleteHandler?: (input: z.infer<typeof DeleteInputSchema>, c: AppContext) => Promise<z.infer<ReturnType<typeof DeleteOutputSchema>>>;
  renderHandlers: Record<string, {
    inputSchema: z.ZodTypeAny;
    handler: (input: any, c: AppContext) => Promise<{ url: string; prompt?: string; tools?: string[] }>;
  }>;
}

export function createViewTools(definition: ViewDefinition): ToolBinder[] {
  const itemSchema = createItemSchema(ViewDataSchema);
  const bindings: ToolBinder[] = [];

  // Standard resource operations
  bindings.push({
    name: `DECO_RESOURCE_VIEW_SEARCH`,
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(itemSchema),
    optional: false,
  });

  bindings.push({
    name: `DECO_RESOURCE_VIEW_READ`,
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(ViewDataSchema),
    optional: false,
  });

  if (definition.createHandler) {
    bindings.push({
      name: `DECO_RESOURCE_VIEW_CREATE`,
      inputSchema: createCreateInputSchema(ViewDataSchema),
      outputSchema: createCreateOutputSchema(ViewDataSchema),
      optional: true,
    });
  }

  if (definition.updateHandler) {
    bindings.push({
      name: `DECO_RESOURCE_VIEW_UPDATE`,
      inputSchema: createUpdateInputSchema(ViewDataSchema),
      outputSchema: createUpdateOutputSchema(ViewDataSchema),
      optional: true,
    });
  }

  if (definition.deleteHandler) {
    bindings.push({
      name: `DECO_RESOURCE_VIEW_DELETE`,
      inputSchema: DeleteInputSchema,
      outputSchema: DeleteOutputSchema,
      optional: true,
    });
  }

  // View render operations
  for (const [viewName, renderHandler] of Object.entries(definition.renderHandlers)) {
    bindings.push({
      name: `deco_view_render_${viewName}`,
      inputSchema: renderHandler.inputSchema,
      outputSchema: z.object({
        url: z.string(),
        prompt: z.string().optional(),
        tools: z.array(z.string()).optional(),
      }),
      optional: true,
    });
  }

  return bindings;
}

export function createViewImplementation(definition: ViewDefinition) {
  const tools = createViewTools(definition);
  
  // Use existing impl function from packages/sdk/src/mcp/bindings/binder.ts
  return impl(tools, [
    // Standard resource operations
    {
      description: `Search view resources`,
      handler: definition.searchHandler,
    },
    {
      description: `Read a view resource`,
      handler: definition.readHandler,
    },
    // View render operations
    ...Object.entries(definition.renderHandlers).map(([viewName, renderHandler]) => ({
      description: `Render ${viewName} view`,
      handler: renderHandler.handler,
    })),
  ]);
}
```

## Phase 2: New Bindings and WellKnownBindings

### 2.1 Create Resources 2.0 Bindings

**File: `packages/sdk/src/mcp/resources-v2/bindings.ts`**

```typescript
import { z } from "zod";
import type { Binder } from "../../bindings/binder.ts";
import {
  BaseResourceDataSchema,
  createCreateInputSchema,
  createCreateOutputSchema,
  createItemSchema,
  createReadOutputSchema,
  createSearchOutputSchema,
  createUpdateInputSchema,
  createUpdateOutputSchema,
  DeleteInputSchema,
  DeleteOutputSchema,
  ReadInputSchema,
  ResourceUriSchema,
  SearchInputSchema,
} from "../schemas/index.ts";

// Generic resource bindings that can be used for any resource type
export const RESOURCE_V2_BINDING_SCHEMA = [
  {
    name: "deco_resource_search" as const,
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(createItemSchema(BaseResourceDataSchema)),
  },
  {
    name: "deco_resource_read" as const,
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(BaseResourceDataSchema),
  },
  {
    name: "deco_resource_create" as const,
    inputSchema: createCreateInputSchema(BaseResourceDataSchema),
    outputSchema: createCreateOutputSchema(BaseResourceDataSchema),
    opt: true,
  },
  {
    name: "deco_resource_update" as const,
    inputSchema: createUpdateInputSchema(BaseResourceDataSchema),
    outputSchema: createUpdateOutputSchema(BaseResourceDataSchema),
    opt: true,
  },
  {
    name: "deco_resource_delete" as const,
    inputSchema: DeleteInputSchema,
    outputSchema: DeleteOutputSchema,
    opt: true,
  },
] as const satisfies Binder;

// Workflow-specific bindings
export const WORKFLOW_V2_BINDING_SCHEMA = [
  ...RESOURCE_V2_BINDING_SCHEMA,
  {
    name: "deco_workflow_start" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema,
      parameters: z.record(z.any()).optional(),
    }),
    outputSchema: z.object({
      executionId: z.string(),
      status: z.enum(["started", "queued", "failed"]),
      message: z.string().optional(),
    }),
  },
  {
    name: "deco_workflow_terminate" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional(),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      terminatedExecutions: z.array(z.string()).optional(),
    }),
  },
  {
    name: "deco_workflow_get_status" as const,
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional(),
    }),
    outputSchema: z.object({
      status: z.enum(["running", "completed", "failed", "terminated", "queued"]),
      progress: z.number().min(0).max(100).optional(),
      startedAt: z.string().datetime().optional(),
      completedAt: z.string().datetime().optional(),
      error: z.string().optional(),
    }),
  },
] as const satisfies Binder;

// View-specific bindings
export const VIEW_V2_BINDING_SCHEMA = [
  ...RESOURCE_V2_BINDING_SCHEMA,
  {
    name: "deco_view_render" as const,
    inputSchema: z.object({
      view: ResourceUriSchema,
      resource: ResourceUriSchema,
    }),
    outputSchema: z.object({
      url: z.string(),
      prompt: z.string().optional(),
      tools: z.array(z.string()).optional(),
    }),
  },
] as const satisfies Binder;
```

### 2.2 Update WellKnownBindings

**File: `packages/sdk/src/mcp/bindings/index.ts`**

```typescript
export * from "./channel.ts";
export * from "./resources.ts";
export * from "./utils.ts";
export * from "./views.ts";
// should not export binder.ts because it is a server-side only file

// Import new Resources 2.0 bindings
import { RESOURCE_V2_BINDING_SCHEMA, WORKFLOW_V2_BINDING_SCHEMA, VIEW_V2_BINDING_SCHEMA } from "../resources-v2/bindings.ts";

export const WellKnownBindings = {
  Channel: CHANNEL_BINDING_SCHEMA,
  View: VIEW_BINDING_SCHEMA,
  Resources: RESOURCE_BINDING_SCHEMA,
  // New Resources 2.0 bindings
  ResourcesV2: RESOURCE_V2_BINDING_SCHEMA,
  WorkflowV2: WORKFLOW_V2_BINDING_SCHEMA,
  ViewV2: VIEW_V2_BINDING_SCHEMA,
} as const;

export type WellKnownBindingsName = keyof typeof WellKnownBindings;
```

## Phase 3: Workflow 2.0 Implementation

### 3.1 Create New Workflow Implementation

**File: `packages/sdk/src/mcp/workflows-v2/api.ts`**

**Note**: The existing workflow implementation in `packages/sdk/src/mcp/workflows/api.ts` already provides:
- Workflow execution with `startWorkflow` and `getWorkflowStatus` tools
- Integration with existing `DECO_CHAT_RESOURCES_*` system
- View system integration
- Sandbox execution environment

The new implementation will enhance this by:
- Using DeconfigResource 2.0 for CRUD operations (`deco_resource_workflow_*`)
- Using separate workflow tools binding for execution (`deco_workflow_*`)
- Adding more workflow management features (logs, executions, etc.)
- Standardizing the interface

```typescript
import { inspect } from "@deco/cf-sandbox";
import z from "zod";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import { WORKFLOW_TOOLS_BINDING_SCHEMA } from "../resources-v2/helpers.ts";
import {
  assertHasWorkspace,
  assertWorkspaceResourceAccess,
  createDeconfigClientForContext,
  createTool,
  impl,
  MCPClient,
  ProjectTools,
} from "../index.ts";
import { validate } from "../sandbox/utils.ts";
import { MCPClientStub } from "../stub.ts";
import {
  CodeStepDefinitionSchema,
  ToolCallStepDefinitionSchema,
  WorkflowDefinitionSchema,
  WorkflowStepDefinitionSchema,
} from "./schemas.ts";
import { RESOURCE_NAME } from "./resource.ts";
import {
  extractStepLogs,
  extractWorkflowTiming,
  fetchWorkflowStatus,
  findCurrentStep,
  formatWorkflowError,
  mapWorkflowStatus,
  processWorkflowSteps,
} from "./common.ts";

// Workflow data schema for Resources 2.0
const WorkflowDataSchemaV2 = z.object({
  title: z.string(),
  description: z.string().optional(),
  definition: WorkflowDefinitionSchema,
  status: z.enum(["draft", "active", "inactive"]).default("draft"),
});

// Create DeconfigResource 2.0 for workflow CRUD operations
export const WorkflowResourceV2 = DeconfigResourceV2.define({
  directory: "/src/workflows",
  resourceName: "workflow",
  dataSchema: WorkflowDataSchemaV2,
  enhancements: {
    DECO_RESOURCE_WORKFLOW_CREATE: {
      description: `Create or update a workflow in the sandbox environment.

## Overview

Workflows are powerful automation tools that execute a sequence of steps sequentially to accomplish complex tasks. Each workflow consists of:

- **Input Schema**: Defines the data structure and parameters required to start the workflow
- **Output Schema**: Defines the final result structure after all steps complete
- **Steps**: An ordered array of individual operations that run one after another

The workflow's final output is determined by the last step in the sequence, which should be a code step that aggregates and returns the desired result.

## Workflow Steps

Workflows alternate between two types of steps:

### 1. Tool Call Steps
Execute tools from integrations using the workflow input:
- **type**: "tool_call"
- **def**: Tool call step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **options**: Configuration with retry/timeout settings and custom properties
  - **tool_name**: The name of the tool to call
  - **integration**: The integration ID of the integration that provides this tool

### 2. Code Steps
Transform data between tool calls using JavaScript/TypeScript:
- **type**: "code"
- **def**: Code step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **execute**: JavaScript/TypeScript code that transforms data

## Best Practices

1. **Alternating Steps**: Design workflows to alternate between tool calls and code
2. **Final Code Step**: Always end with a code step that aggregates and returns the final result
3. **Input Transformation**: Use code steps before tool calls to transform workflow input as needed
4. **Integration Discovery**: Always use the \`integration_list\` tool to find the correct integration ID before creating tool_call steps
5. **Minimal Output**: Keep code step outputs minimal to improve performance
6. **Error Handling**: Use retry and timeout configurations appropriately for tool calls
7. **Schema Validation**: Define clear input/output schemas for type safety
8. **Step Independence**: Design steps to be testable in isolation
9. **Business Configuration**: Use options to expose tunable parameters for tool calls
10. **Sequential Execution**: Steps run in order - design accordingly
11. **Data Flow**: Use code to transform data between tool calls

## WellKnownOptions Interface

The context object in code step execute functions includes:

\`\`\`typescript
interface WellKnownOptions {
  readWorkflowInput(): Promise<WorkflowInputSchema>;
  readStepResult(stepName: string): Promise<StepOutputSchema>;
  sleep(name: string, duration: number): Promise<void>;
  sleepUntil(name: string, date: Date | number): Promise<void>;
}
\`\`\`

Use these helper functions to access workflow input and previous step results within your code step execute functions.

`,
    },
    DECO_RESOURCE_WORKFLOW_UPDATE: {
      description: `Update an existing workflow in the sandbox environment.

${WorkflowResourceV2.enhancements?.DECO_RESOURCE_WORKFLOW_CREATE?.description || ""}

## Update Behavior

When updating a workflow:
- All fields are optional - only provided fields will be updated
- The workflow definition will be validated against the schema
- Existing metadata (created_at, created_by) is preserved
- New metadata (updated_at, updated_by) is automatically added
- The workflow status can be changed between draft, active, and inactive

`,
    },
  },
});

// Workflow execution tools implementation
export const workflowExecutionTools = impl(WORKFLOW_TOOLS_BINDING_SCHEMA, [
  {
    description: "Start a workflow execution",
    handler: async ({ uri, parameters }, c) => {
      // Implementation for starting workflows
      // This would replace the current WORKFLOWS_START implementation
    },
  },
  {
    description: "Terminate a workflow execution", 
    handler: async ({ uri, executionId }, c) => {
      // Implementation for terminating workflows
      // This would replace the current WORKFLOWS_TERMINATE implementation
    },
  },
  {
    description: "Get workflow execution status",
    handler: async ({ uri, executionId }, c) => {
      // Implementation for getting workflow status
      // This would replace the current WORKFLOWS_GET_STATUS implementation
    },
  },
  {
    description: "Get workflow execution logs",
    handler: async ({ uri, executionId, limit }, c) => {
      // Implementation for getting workflow logs
      // This would be a new optional feature
    },
  },
  {
    description: "Get workflow executions",
    handler: async ({ uri, limit, offset, status }, c) => {
      // Implementation for getting workflow executions
      // This would be a new optional feature
    },
  },
]);

// Export the complete workflow implementation
export const WORKFLOWS_TOOLS_V2 = [
  ...WorkflowResourceV2.tools(createDeconfigClientForContext()),
  ...workflowExecutionTools,
];

// Read workflow function (same as current implementation)
async function readWorkflow(
  name: string,
  client: MCPClientStub<ProjectTools>,
  workflows: MCPClientStub<(typeof WellKnownBindings)["Resources"]>,
  branch?: string,
): Promise<z.infer<typeof WorkflowDefinitionSchema> | null> {
  // ... (same implementation as current)
}

// Create workflow definition using the new helper
const workflowDefinition: WorkflowDefinition = {
  name: "workflow",
  searchHandler: async (input, c) => {
    // Implementation for searching workflows
    // This would replace the current DECO_CHAT_RESOURCES_SEARCH implementation
  },
  readHandler: async (input, c) => {
    // Implementation for reading workflows
    // This would replace the current DECO_CHAT_RESOURCES_READ implementation
  },
  createHandler: async (input, c) => {
    // Implementation for creating workflows
    // This would replace the current DECO_CHAT_RESOURCES_CREATE implementation
  },
  updateHandler: async (input, c) => {
    // Implementation for updating workflows
    // This would replace the current DECO_CHAT_RESOURCES_UPDATE implementation
  },
  deleteHandler: async (input, c) => {
    // Implementation for deleting workflows
    // This would replace the current DECO_CHAT_RESOURCES_DELETE implementation
  },
  startHandler: async (input, c) => {
    // Implementation for starting workflows
    // This would replace the current WORKFLOWS_START implementation
  },
  terminateHandler: async (input, c) => {
    // Implementation for terminating workflows
    // This would replace the current WORKFLOWS_TERMINATE implementation
  },
  getStatusHandler: async (input, c) => {
    // Implementation for getting workflow status
    // This would replace the current WORKFLOWS_GET_STATUS implementation
  },
  getLogsHandler: async (input, c) => {
    // Implementation for getting workflow logs
    // This would be a new optional feature
  },
  getExecutionsHandler: async (input, c) => {
    // Implementation for getting workflow executions
    // This would be a new optional feature
  },
};

// Create the workflow implementation using the helper
export const workflowV2Implementation = createWorkflowImplementation(workflowDefinition);

// Export the tools for backward compatibility
export const WORKFLOWS_TOOLS_V2 = workflowV2Implementation;
```

### 3.2 Update Workflow Resource

**File: `packages/sdk/src/mcp/workflows-v2/resource.ts`**

```typescript
import { z } from "zod";
import { DeconfigResource } from "../deconfig/deconfig-resource.ts";
import { WorkflowDefinitionSchema } from "./schemas.ts";

export const RESOURCE_NAME = "workflow";

const WORKFLOW_PROMPT = `Create or update a workflow in the sandbox environment.

## Overview

Workflows are powerful automation tools that execute a sequence of steps sequentially to accomplish complex tasks. Each workflow consists of:

- **Input Schema**: Defines the data structure and parameters required to start the workflow
- **Output Schema**: Defines the final result structure after all steps complete
- **Steps**: An ordered array of individual operations that run one after another (alternating between tool calls and mappers)

The workflow's final output is determined by the last step in the sequence, which should be a code step that aggregates and returns the desired result.

## Workflow Steps

Workflows alternate between two types of steps:

### 1. Tool Call Steps
Execute tools from integrations using the workflow input:
- **type**: "tool_call"
- **def**: Tool call step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **options**: Configuration with retry/timeout settings and custom properties
  - **tool_name**: The name of the tool to call
  - **integration**: The integration ID of the integration that provides this tool

**Important**: The integration must be available and the tool must exist in that integration.

### 2. Code Steps
Transform data between tool calls using JavaScript/TypeScript:
- **type**: "code"
- **def**: Code step definition containing:
  - **name**: Unique identifier within the workflow
  - **description**: Clear explanation of the step's purpose
  - **execute**: JavaScript/TypeScript code that transforms data

## Example Workflow

\`\`\`json
{
  "name": "process-user-data",
  "description": "Process and validate user data from multiple sources",
  "inputSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" },
      "sources": { "type": "array", "items": { "type": "string" } }
    },
    "required": ["userId"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "processedData": { "type": "array" },
      "summary": { "type": "string" }
    }
  },
  "steps": [
    {
      "type": "code",
      "def": {
        "name": "validate-input",
        "description": "Validate and prepare input data",
        "execute": "return { userId: ctx.readWorkflowInput().userId, sources: ctx.readWorkflowInput().sources };"
      }
    },
    {
      "type": "tool_call",
      "def": {
        "name": "fetch-user-data",
        "description": "Fetch user data from primary source",
        "options": { "retry": 3, "timeout": 30000 },
        "tool_name": "USER_GET",
        "integration": "user-service"
      }
    },
    {
      "type": "code",
      "def": {
        "name": "process-data",
        "description": "Process and aggregate user data",
        "execute": "const userData = ctx.readStepResult('fetch-user-data'); return { processedData: [userData], summary: 'User data processed successfully' };"
      }
    }
  ]
}
\`\`\`

## Best Practices

1. **Alternating Steps**: Design workflows to alternate between tool calls and code
2. **Final Code Step**: Always end with a code step that aggregates and returns the final result
3. **Input Transformation**: Use code steps before tool calls to transform workflow input as needed
4. **Integration Discovery**: Always use the \`integration_list\` tool to find the correct integration ID before creating tool_call steps
5. **Minimal Output**: Keep code step outputs minimal to improve performance
6. **Error Handling**: Use retry and timeout configurations appropriately for tool calls
7. **Schema Validation**: Define clear input/output schemas for type safety
8. **Step Independence**: Design steps to be testable in isolation
9. **Business Configuration**: Use options to expose tunable parameters for tool calls
10. **Sequential Execution**: Steps run in order - design accordingly
11. **Data Flow**: Use code to transform data between tool calls

## WellKnownOptions Interface

The context object in code step execute functions includes:

\`\`\`typescript
interface WellKnownOptions {
  readWorkflowInput(): Promise<WorkflowInputSchema>;
  readStepResult(stepName: string): Promise<StepOutputSchema>;
  sleep(name: string, duration: number): Promise<void>;
  sleepUntil(name: string, date: Date | number): Promise<void>;
}
\`\`\`

Use these helper functions to access workflow input and previous step results within your code step execute functions.

`;

export const WorkflowResourceV2 = DeconfigResource.define({
  directory: "/src/workflows",
  resourceName: RESOURCE_NAME,
  schema: WorkflowDefinitionSchema,
  enhancements: {
    DECO_CHAT_RESOURCES_CREATE: {
      description: WORKFLOW_PROMPT,
    },
    DECO_CHAT_RESOURCES_UPDATE: {
      description: WORKFLOW_PROMPT,
    },
  },
});
```

## Phase 4: Views 2.0 Implementation

### 4.1 Create Views 2.0 Implementation

**File: `packages/sdk/src/mcp/views-v2/api.ts`**

**Note**: The existing web app already has a sophisticated view system that we can leverage:

**Existing Web Components** (in `apps/web/src/components/views/`):
- **`ViewDetail`**: Main view component that handles `internal://resource/list` and `internal://resource/detail` URLs
- **`InternalResourceListWithIntegration`**: Generic resource listing component with search, pagination, CRUD operations
- **`WorkflowView`**: Specialized workflow detail view component
- **`ViewsList`**: Lists all available views from integrations
- **Routing**: Dynamic routes `/views/:integrationId/:viewName` with `viewUrl` parameter

**Integration Strategy**:
- Use existing `internal://resource/list` and `internal://resource/detail` URL patterns
- Leverage existing `InternalResourceListWithIntegration` component for generic resource listing
- Create specialized view components for Resources 2.0 (similar to `WorkflowView`)
- Use existing view discovery and menu system

```typescript
import { createResourceImplementation, type ResourceDefinition } from "../resources-v2/helpers.ts";
import { assertHasWorkspace, type AppContext } from "../index.ts";

// Create view definition using the new helper
const viewDefinition: ViewDefinition = {
  name: "view",
  searchHandler: async (input, c) => {
    // Implementation for searching views
    // This would replace the current DECO_CHAT_VIEWS_LIST implementation
  },
  readHandler: async (input, c) => {
    // Implementation for reading views
    // This would be a new feature
  },
  createHandler: async (input, c) => {
    // Implementation for creating views
    // This would be a new feature
  },
  updateHandler: async (input, c) => {
    // Implementation for updating views
    // This would be a new feature
  },
  deleteHandler: async (input, c) => {
    // Implementation for deleting views
    // This would be a new feature
  },
  renderHandlers: {
    // Use new resource-centric URL patterns
    resource_list: {
      inputSchema: z.object({
        resourceType: z.string(),
        term: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
        filters: z.record(z.any()).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      }),
      handler: async (input, c) => {
        // Return new resource-centric URL
        const params = new URLSearchParams({
          view: "list",
          integrationId: "resources-v2",
          ...(input.term && { term: input.term }),
          ...(input.page && { page: input.page.toString() }),
          ...(input.pageSize && { pageSize: input.pageSize.toString() }),
          ...(input.filters && { filters: JSON.stringify(input.filters) }),
          ...(input.sortBy && { sortBy: input.sortBy }),
          ...(input.sortOrder && { sortOrder: input.sortOrder }),
        });
        return {
          url: `internal://resources/${input.resourceType}?${params.toString()}`,
          prompt: `You are helping the user browse and manage ${input.resourceType} resources...`,
          tools: [
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_SEARCH`,
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_READ`,
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_CREATE`,
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_UPDATE`,
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_DELETE`,
          ],
        };
      },
    },
    resource_detail: {
      inputSchema: z.object({
        resourceType: z.string(),
        uri: ResourceUriSchema,
      }),
      handler: async (input, c) => {
        // Return new resource-centric URL
        const params = new URLSearchParams({
          view: "detail",
          integrationId: "resources-v2",
          uri: input.uri,
        });
        return {
          url: `internal://resources/${input.resourceType}?${params.toString()}`,
          prompt: `You are helping the user view and manage a ${input.resourceType} resource...`,
          tools: [
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_READ`,
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_UPDATE`,
            `DECO_RESOURCE_${input.resourceType.toUpperCase()}_DELETE`,
          ],
        };
      },
    },
    // Specialized views for specific resource types
    workflow_detail: {
      inputSchema: z.object({
        uri: ResourceUriSchema,
      }),
      handler: async (input, c) => {
        // Use new resource-centric URL pattern
        const params = new URLSearchParams({
          view: "detail",
          integrationId: "resources-v2",
          uri: input.uri,
        });
        return {
          url: `internal://resources/workflow?${params.toString()}`,
          prompt: "You are helping the user manage a workflow...",
          tools: [
            "DECO_RESOURCE_WORKFLOW_READ",
            "deco_workflow_start",
            "deco_workflow_terminate",
            "deco_workflow_get_status",
          ],
        };
      },
    },
  },
};

// Create the view implementation using the helper
export const viewV2Implementation = createViewImplementation(viewDefinition);

// Export the tools
export const VIEWS_TOOLS_V2 = viewV2Implementation;
```

### 4.2 Web Component Integration

**File: `apps/web/src/components/views/resource-v2-view.tsx`**

```typescript
import { useMemo } from "react";
import { useSearchParams } from "react-router";
import { InternalResourceListWithIntegration } from "./internal-resource-list.tsx";
import { EmptyState } from "../common/empty-state.tsx";

// Generic Resources 2.0 view component that leverages existing infrastructure
export function ResourceV2View() {
  const [searchParams] = useSearchParams();
  
  // Extract resource type from URL parameters
  const resourceType = useMemo(() => {
    const viewUrl = searchParams.get("viewUrl");
    if (!viewUrl) return null;
    
    try {
      const url = new URL(viewUrl.replace("internal://", "https://internal/"));
      return url.searchParams.get("name");
    } catch {
      return null;
    }
  }, [searchParams]);
  
  if (!resourceType) {
    return (
      <EmptyState
        icon="report"
        title="Missing resource type"
        description="The resource type is missing from the URL parameters."
      />
    );
  }
  
  // Use existing InternalResourceListWithIntegration component
  // It already handles all the CRUD operations and UI
  return <InternalResourceListWithIntegration name={resourceType} integrationId="resources-v2" />;
}
```

**File: `apps/web/src/components/views/detail.tsx` (Update existing)**

```typescript
// Add to existing PreviewTab function:
if (resolvedUrl.startsWith("internal://resource/list")) {
  if (!embeddedName || !integrationId) {
    return (
      <EmptyState
        icon="report"
        title="Missing embedded name or integration id"
        description="The embedded name or integration id is missing from the URL parameters. This is likely a bug in the system, please report it to the team."
      />
    );
  }

  // Check if this is a Resources 2.0 view
  if (integrationId === "resources-v2") {
    return <ResourceV2View />;
  }

  return (
    <InternalResourceListWithIntegration
      name={embeddedName}
      integrationId={integrationId}
    />
  );
}

if (resolvedUrl.startsWith("internal://resource/detail")) {
  if (embeddedName === "workflow") {
    return <WorkflowView />;
  }
  
  // Add Resources 2.0 detail view handling
  if (integrationId === "resources-v2") {
    return <ResourceV2DetailView />;
  }

  return (
    <EmptyState
      icon="report"
      title="Not implemented yet"
      description="This view is not implemented yet."
    />
  );
}
```

### 4.3 Menu Integration

**How to Add Resources 2.0 to the Menu System:**

The existing menu system in `apps/web/src/components/sidebar/index.tsx` automatically discovers views from integrations and adds them to the sidebar. To add Resources 2.0 views:

1. **Create a Resources 2.0 Integration**: Create a virtual integration that exposes Resources 2.0 views
2. **Register Views**: The integration should return views with `internal://resource/list` URLs
3. **Automatic Discovery**: The existing `ViewsList` component will automatically discover and display these views

**File: `packages/sdk/src/mcp/resources-v2/integration.ts`**

```typescript
import { IntegrationSchema } from "../../index.ts";
import { viewV2Implementation } from "./views-v2/api.ts";

// Create a virtual integration for Resources 2.0
export const RESOURCES_V2_INTEGRATION = {
  id: "resources-v2",
  name: "Resources 2.0",
  icon: "layers",
  description: "Standardized resource management system",
  connection: {
    type: "MCP" as const,
    url: "internal://resources-v2",
  },
  tools: viewV2Implementation,
  // Views will be discovered automatically through DECO_CHAT_VIEWS_LIST
} satisfies z.infer<typeof IntegrationSchema>;

// Example views that would be returned by DECO_CHAT_VIEWS_LIST
export const RESOURCES_V2_VIEWS = [
  {
    name: "WORKFLOWS_LIST",
    title: "Workflows",
    description: "Manage and monitor your workflows",
    icon: "workflow",
    url: "internal://resources/workflow?view=list&integrationId=resources-v2",
    resourceName: "workflow",
    tools: [
      "DECO_RESOURCE_WORKFLOW_SEARCH",
      "DECO_RESOURCE_WORKFLOW_READ", 
      "DECO_RESOURCE_WORKFLOW_CREATE",
      "DECO_RESOURCE_WORKFLOW_UPDATE",
      "DECO_RESOURCE_WORKFLOW_DELETE",
    ],
    rules: [
      "You are a specialist for crud operations on resources. Use the resource tools to read, search, create, update, or delete items; do not fabricate data.",
    ],
  },
  {
    name: "WORKFLOW_DETAIL",
    title: "Workflow Detail", 
    description: "View and manage individual workflow details",
    icon: "workflow",
    url: "internal://resources/workflow?view=detail&integrationId=resources-v2",
    mimeTypePattern: "application/json",
    resourceName: "workflow",
    tools: [
      "DECO_RESOURCE_WORKFLOW_READ",
      "deco_workflow_start",
      "deco_workflow_terminate",
      "deco_workflow_get_status",
    ],
    rules: [
      "You are a workflow editing specialist. Use the workflow tools to edit the current workflow.",
    ],
  },
  // Add more resource types as needed
  {
    name: "DOCUMENTS_LIST",
    title: "Documents",
    description: "Manage your documents",
    icon: "description",
    url: "internal://resources/document?view=list&integrationId=resources-v2",
    resourceName: "document",
    tools: [
      "DECO_RESOURCE_DOCUMENT_SEARCH",
      "DECO_RESOURCE_DOCUMENT_READ",
      "DECO_RESOURCE_DOCUMENT_CREATE",
      "DECO_RESOURCE_DOCUMENT_UPDATE", 
      "DECO_RESOURCE_DOCUMENT_DELETE",
    ],
    rules: [
      "You are a document management specialist. Help users organize and manage their documents.",
    ],
  },
];
```

**Integration with Existing Menu System:**

The existing menu system will automatically:
1. **Discover Views**: Use `useIntegrationViews()` to get views from the Resources 2.0 integration
2. **Add to Sidebar**: Views appear in the sidebar under the integration name
3. **Handle Navigation**: Clicking a view navigates to `/views/resources-v2/:viewName`
4. **Render Components**: The existing `ViewDetail` component handles the `internal://` URLs

**Benefits of This Approach:**
- **Zero UI Changes**: Leverages existing menu and navigation system
- **Consistent UX**: Resources 2.0 views look and behave like existing views
- **Automatic Discovery**: No manual menu configuration needed
- **Extensible**: Easy to add new resource types by adding more views
- **Backward Compatible**: Existing views continue to work unchanged

## Phase 5: Migration Strategy

### 5.1 Clean Implementation

1. **Fresh Start**: Resources 2.0 is a completely new system - no legacy baggage
2. **New Namespace**: Resources 2.0 uses `deco_resource_` and `deco_view_` namespaces
3. **Clean URLs**: New resource-centric URL structure without legacy patterns
4. **Helper Functions**: New helper functions make it easy to create Resources 2.0 implementations
5. **Reuse Existing Infrastructure**: Leverage existing binding system, `impl` function, and type definitions

### 5.2 Implementation Steps

1. **Phase 1**: Implement core infrastructure (schemas, helpers, bindings)
2. **Phase 2**: Create Workflow 2.0 implementation (replaces current)
3. **Phase 3**: Create Views 2.0 implementation (new major version)
4. **Phase 4**: Update existing integrations to use Resources 2.0
5. **Phase 5**: Remove legacy implementations

### 5.3 Example Implementation

**Legacy Implementation (to be removed):**
```typescript
export const workflowViews = impl(VIEW_BINDING_SCHEMA, [
  {
    description: "List views exposed by this MCP",
    handler: (_, c) => {
      // ... implementation
    },
  },
]);
```

**Resources 2.0 Implementation:**
```typescript
const workflowDefinition: WorkflowDefinition = {
  name: "workflow",
  searchHandler: async (input, c) => { /* ... */ },
  readHandler: async (input, c) => { /* ... */ },
  startHandler: async (input, c) => { /* ... */ },
  // ... other handlers
};

export const workflowV2Implementation = createWorkflowImplementation(workflowDefinition);
```

## Phase 6: Testing and Validation

### 6.1 Unit Tests

- Test all helper functions
- Test schema validation
- Test tool binding generation
- Test clean implementation

### 6.2 Integration Tests

- Test Resources 2.0 with existing integrations
- Test workflow execution
- Test view rendering
- Test discovery mechanism

## Phase 7: Documentation and Examples

### 7.1 Documentation

- Update API documentation
- Create implementation guides
- Document helper functions
- Create best practices guide

### 7.2 Examples

- Example resource implementations
- Example workflow definitions
- Example view configurations
- Implementation examples

## Implementation Timeline

**Note**: With AI workers, we can implement this in parallel across multiple tasks simultaneously. The existing infrastructure provides a solid foundation that can be built upon rapidly.

### **Parallel Implementation Strategy (15 minutes total)**

**Phase 1: Core Infrastructure (5 minutes)**
- Multiple AI workers implement schemas, helpers, and bindings simultaneously
- Leverage existing binding system and utilities
- Create Resources 2.0 schemas with `rsc://` URI format
- Implement helper functions for resource/workflow/view creation

**Phase 2: Backend Implementation (5 minutes)**
- DeconfigResource 2.0 implementation using existing patterns
- Workflow 2.0 using DeconfigResource + workflow tools binding
- Views 2.0 implementation with `internal://` URL patterns
- Integration with existing systems

**Phase 3: Frontend Integration (3 minutes)**
- Update existing view components to handle Resources 2.0
- Leverage existing `InternalResourceListWithIntegration` component
- No new UI components needed - reuse existing patterns
- Automatic menu integration through existing discovery system

**Phase 4: Testing & Validation (2 minutes)**
- Parallel testing across all implementations
- Integration testing with existing systems
- Performance validation and bug fixes

### **Key Advantages of Parallel AI Implementation:**
- **Massive Parallelization**: Multiple AI workers can work simultaneously
- **Existing Foundation**: Leverage proven binding system, schemas, and UI components
- **No New UI Components**: Reuse existing view system and routing
- **Automatic Integration**: Existing discovery system handles Resources 2.0 views
- **Consistent UX**: Resources 2.0 views look identical to existing views
- **Rapid Iteration**: AI workers can quickly iterate and fix issues

## Benefits

1. **Standardization**: Consistent schemas and tool bindings across all resources
2. **Type Safety**: Full TypeScript support with Zod validation
3. **Helper Functions**: Easy to create new resource implementations
4. **Backward Compatibility**: Existing code continues to work
5. **Extensibility**: Easy to add new resource types and operations
6. **Discovery**: Automatic discovery of resources, workflows, and views
7. **Performance**: Optimized schemas and tool bindings
8. **Maintainability**: Cleaner, more maintainable code structure
9. **Reduced Implementation Effort**: Reuse existing binding system, schemas, and utilities
10. **Faster Development**: Leverage proven patterns and infrastructure

## Conclusion

This implementation plan provides a comprehensive approach to implementing Resources 2.0 while maintaining backward compatibility and providing powerful helper functions for easy resource creation. The phased approach ensures minimal disruption to existing systems while providing a clear migration path to the new architecture.

**Key Advantages of This Approach:**
- **Leverages Existing Infrastructure**: Reuses proven binding system, schemas, and utilities
- **Reduced Development Time**: 7 weeks instead of 14 weeks due to existing components
- **Lower Risk**: Builds on stable, tested foundation
- **Easier Maintenance**: Consistent patterns across the codebase
- **Faster Adoption**: Teams can migrate gradually using familiar patterns

The existing codebase already provides most of the foundational pieces needed for Resources 2.0, making this implementation much more straightforward than starting from scratch.

## Web Integration Summary

**The existing web app already has everything needed for Resources 2.0:**

### ✅ **Existing Components We Can Reuse**
- **`InternalResourceListWithIntegration`**: Complete resource listing with search, pagination, CRUD operations
- **`ViewDetail`**: Handles `internal://resource/list` and `internal://resource/detail` URLs
- **`WorkflowView`**: Example of specialized resource detail view
- **`ViewsList`**: Automatic view discovery from integrations
- **Menu System**: Automatic sidebar integration with view discovery

### ✅ **Existing URL Patterns**
- **`internal://resource/list?name=workflow`**: Lists resources of a specific type
- **`internal://resource/detail?name=workflow&uri=...`**: Shows detail view for specific resource
- **`/views/:integrationId/:viewName`**: Dynamic routing for views (legacy)
- **`/resources/:resource?view=:viewName&integrationId=:integration`**: New resource-centric routing

### ✅ **Integration Strategy**
1. **Create Resources 2.0 Integration**: Virtual integration that exposes views
2. **Use New Resource-Centric URLs**: `/{org}/{project}/resources/{resource}?view={viewName}&integrationId={integration}`
3. **Leverage Existing Components**: `InternalResourceListWithIntegration` handles all the UI
4. **Automatic Menu Integration**: Existing discovery system adds views to sidebar
5. **Clean Implementation**: No backward compatibility needed - Resources 2.0 is a fresh start

### ✅ **Benefits**
- **No new UI components needed**
- **Consistent user experience**
- **Automatic menu integration**
- **Reuse existing search, pagination, CRUD operations**
- **Clean, resource-centric URL structure**
- **Simplified implementation without legacy baggage**

This approach means Resources 2.0 can be implemented with minimal web UI changes while providing a rich, consistent user experience that matches the existing system.

## Implementation Tasks

### Backend Tasks

#### Phase 1: Core Infrastructure (Week 1)

**Task 1.1: Create Resources 2.0 Schemas**
- [x] Create `packages/sdk/src/mcp/resources-v2/schemas.ts`
- [ ] Implement `BaseResourceDataSchema` with required `title` field
- [ ] Implement `ResourceUriSchema` with `rsc://` format validation
- [ ] Create `SearchInputSchema` and `SearchOutputSchema` factory functions
- [ ] Create `ReadInputSchema` and `ReadOutputSchema` factory functions
- [ ] Create `CreateInputSchema` and `CreateOutputSchema` factory functions
- [ ] Create `UpdateInputSchema` and `UpdateOutputSchema` factory functions
- [ ] Create `DeleteInputSchema` and `DeleteOutputSchema`
- [ ] Create `createItemSchema` factory function
- [ ] Add comprehensive JSDoc documentation

**Task 1.2: Create Resource Helper Functions**
- [x] Create `packages/sdk/src/mcp/resources-v2/helpers.ts`
- [ ] Implement `ResourceDefinition<TDataSchema>` interface
- [ ] Implement `createResourceTools<TDataSchema>` function
- [ ] Implement `createResourceImplementation<TDataSchema>` function
- [ ] Add TypeScript generics for type safety
- [ ] Add comprehensive error handling
- [ ] Add JSDoc documentation with examples

**Task 1.3: Create Workflow-Specific Tool Bindings**
- [ ] Create `packages/sdk/src/mcp/resources-v2/helpers/workflow-tools.ts`
- [ ] Implement `WORKFLOW_TOOLS_BINDING_SCHEMA` with `deco_workflow_*` tools only
- [ ] Add `deco_workflow_start` tool binding
- [ ] Add `deco_workflow_terminate` tool binding
- [ ] Add `deco_workflow_get_status` tool binding
- [ ] Add optional `deco_workflow_get_logs` tool binding
- [ ] Add optional `deco_workflow_get_executions` tool binding
- [ ] Note: Standard CRUD operations use DeconfigResource 2.0 (`deco_resource_workflow_*`)

**Task 1.4: Create View Helper Functions**
- [ ] Create `packages/sdk/src/mcp/resources-v2/helpers/view-factory.ts`
- [ ] Implement `ViewDataSchema` extending `BaseResourceDataSchema`
- [ ] Implement `ViewDefinition` interface
- [ ] Implement `createViewTools` function
- [ ] Implement `createViewImplementation` function
- [ ] Add render handler support for different view types
- [ ] Add support for `internal://` URL patterns

#### Phase 2: New Bindings and WellKnownBindings (Week 2)

**Task 2.1: Create Resources 2.0 Bindings**
- [x] Create `packages/sdk/src/mcp/resources-v2/bindings.ts`
- [ ] Implement `RESOURCE_V2_BINDING_SCHEMA` with `deco_resource_*` tools
- [ ] Implement `WORKFLOW_TOOLS_BINDING_SCHEMA` with `deco_workflow_*` tools only
- [ ] Implement `VIEW_V2_BINDING_SCHEMA` with view-specific tools
- [ ] Use existing `Binder` type from `packages/sdk/src/mcp/bindings/binder.ts`
- [ ] Add proper TypeScript types and validation
- [ ] Note: Workflow CRUD uses `RESOURCE_V2_BINDING_SCHEMA`, execution uses `WORKFLOW_TOOLS_BINDING_SCHEMA`

**Task 2.2: Update WellKnownBindings**
- [ ] Update `packages/sdk/src/mcp/bindings/index.ts`
- [ ] Add `ResourcesV2`, `WorkflowTools`, `ViewV2` to `WellKnownBindings`
- [ ] Update `WellKnownBindingsName` type
- [ ] Ensure backward compatibility with existing bindings
- [ ] Add proper exports and documentation
- [ ] Note: `WorkflowTools` contains only `deco_workflow_*` tools, not CRUD operations

#### Phase 3: Workflow 2.0 Implementation (Week 3)

**Task 3.1: Create Workflow 2.0 Implementation**
- [ ] Create `packages/sdk/src/mcp/workflows-v2/api.ts`
- [ ] Use `DeconfigResourceV2.define()` for workflow CRUD operations
- [ ] Implement workflow-specific tool handlers (start, terminate, get_status)
- [ ] Add optional handlers (get_logs, get_executions)
- [ ] Export `WORKFLOW_TOOLS_BINDING_SCHEMA` for workflow execution tools
- [ ] Integrate with existing workflow execution system
- [ ] Note: CRUD operations handled by DeconfigResource 2.0, execution by workflow tools

**Task 3.2: Create DeconfigResources 2.0**
- [x] Create `packages/sdk/src/mcp/deconfig-v2/index.ts`
- [ ] Implement `DeconfigResourceV2Options` interface
- [ ] Implement `DeconfigResourceV2.define()` method
- [ ] Implement `deconfigResourceV2()` function
- [ ] Add support for `rsc://` URI format
- [ ] Add file-based resource management
- [ ] Add schema validation support
- [ ] Add enhancement support for tool descriptions

**Task 3.3: Create Workflow Resource V2 Example**
- [ ] Create `packages/sdk/src/mcp/resources-v2/examples/workflow-v2-resource.ts`
- [ ] Define `WorkflowDataSchemaV2` extending `BaseResourceDataSchema`
- [ ] Create `WorkflowResourceV2` using `DeconfigResourceV2.define()`
- [ ] Add comprehensive workflow creation prompts
- [ ] Add workflow update prompts
- [ ] Test integration with existing workflow system

#### Phase 4: Views 2.0 Implementation (Week 4)

**Task 4.1: Create Views 2.0 Implementation**
- [ ] Create `packages/sdk/src/mcp/views-v2/api.ts`
- [ ] Implement view definition using `createViewImplementation`
- [ ] Add `resource_list` render handler with new resource-centric URLs
- [ ] Add `resource_detail` render handler with new resource-centric URLs
- [ ] Add `workflow_detail` specialized render handler
- [ ] Add support for dynamic tool lists based on resource type
- [ ] Add proper error handling and validation

**Task 4.2: Create Resources 2.0 Integration**
- [ ] Create `packages/sdk/src/mcp/resources-v2/integration.ts`
- [ ] Implement `RESOURCES_V2_INTEGRATION` virtual integration
- [ ] Define `RESOURCES_V2_VIEWS` with example views
- [ ] Add support for automatic view discovery
- [ ] Add proper integration metadata and tools
- [ ] Test integration with existing integration system

### Frontend Tasks

#### Phase 4: Web Integration (Week 4)

**Task 4.3: Create Resource V2 View Component**
- [ ] Create `apps/web/src/components/views/resource-v2-view.tsx`
- [ ] Implement `ResourceV2View` component for new resource-centric URLs
- [ ] Add URL parameter parsing for resource type, view, and integrationId
- [ ] Integrate with existing `InternalResourceListWithIntegration`
- [ ] Add proper error handling and loading states
- [ ] Add TypeScript types and interfaces

**Task 4.4: Update Router Configuration**
- [ ] Update `apps/web/src/main.tsx` router configuration
- [ ] Add new resource route: `/:org/:project/resources/:resource`
- [ ] Add route handler for resource-centric URLs
- [ ] Remove legacy `/views/:integrationId/:viewName` route (no backward compatibility needed)
- [ ] Add proper error handling and fallbacks

**Task 4.5: Update View Detail Component**
- [ ] Update `apps/web/src/components/views/detail.tsx`
- [ ] Add Resources 2.0 detection for new `internal://resources/` URLs
- [ ] Add routing to `ResourceV2View` for Resources 2.0 views
- [ ] Add Resources 2.0 detail view handling
- [ ] Remove legacy view handling (no backward compatibility needed)
- [ ] Add proper error handling and fallbacks

**Task 4.6: Test Web Integration**
- [ ] Test Resources 2.0 views with new resource-centric URLs
- [ ] Test navigation between list and detail views
- [ ] Test CRUD operations through existing UI components
- [ ] Test menu integration and view discovery
- [ ] Test error handling and edge cases
- [ ] Verify consistent UX with existing views

#### Phase 5: Implementation Utilities (Week 5)

**Task 5.1: Create Implementation Utilities**
- [ ] Create `packages/sdk/src/mcp/resources-v2/utils/` directory
- [ ] Implement utilities for Resources 2.0 implementation
- [ ] Add URI format utilities for `rsc://` scheme
- [ ] Add schema helpers
- [ ] Add data transformation utilities
- [ ] Add comprehensive implementation documentation

**Task 5.2: Create Implementation Examples**
- [ ] Create implementation examples for workflows
- [ ] Create implementation examples for custom resources
- [ ] Add step-by-step implementation guides
- [ ] Add automated implementation scripts
- [ ] Test implementation utilities with real data
- [ ] Document implementation best practices

#### Phase 6: Testing and Validation (Week 6)

**Task 6.1: Backend Testing**
- [ ] Create unit tests for all helper functions
- [ ] Create integration tests for Resources 2.0 implementations
- [ ] Test schema validation and error handling
- [ ] Test binding compatibility and type safety
- [ ] Test DeconfigResources 2.0 with file operations
- [ ] Test workflow 2.0 with existing execution system

**Task 6.2: Frontend Testing**
- [ ] Test Resources 2.0 views in web application
- [ ] Test navigation and routing
- [ ] Test CRUD operations through UI
- [ ] Test error handling and edge cases
- [ ] Test menu integration and view discovery
- [ ] Test responsive design and accessibility

**Task 6.3: End-to-End Testing**
- [ ] Test complete workflow from resource creation to execution
- [ ] Test view rendering and user interactions
- [ ] Test integration with existing systems
- [ ] Test performance and scalability
- [ ] Test clean implementation
- [ ] Test resource-centric URL handling

#### Phase 7: Documentation and Examples (Week 7)

**Task 7.1: API Documentation**
- [ ] Document all Resources 2.0 schemas and types
- [ ] Document helper functions and usage examples
- [ ] Document binding system and integration patterns
- [ ] Document implementation utilities and guides
- [ ] Add JSDoc comments to all public APIs
- [ ] Create comprehensive README files

**Task 7.2: Usage Examples**
- [ ] Create example resource implementations
- [ ] Create example workflow definitions
- [ ] Create example view configurations
- [ ] Create implementation examples
- [ ] Create best practices guide
- [ ] Create troubleshooting guide

**Task 7.3: Developer Documentation**
- [ ] Create developer onboarding guide
- [ ] Create architecture overview documentation
- [ ] Create contribution guidelines
- [ ] Create testing guidelines
- [ ] Create deployment guide
- [ ] Create maintenance guide

### Testing and Quality Assurance

**Task QA.1: Code Quality**
- [ ] Run TypeScript type checking on all new code
- [ ] Run ESLint and fix all linting errors
- [ ] Run Prettier and ensure consistent formatting
- [ ] Add comprehensive error handling
- [ ] Add input validation and sanitization
- [ ] Add proper logging and debugging support

**Task QA.2: Performance Testing**
- [ ] Test resource listing performance with large datasets
- [ ] Test search performance with complex queries
- [ ] Test workflow execution performance
- [ ] Test view rendering performance
- [ ] Optimize database queries and API calls
- [ ] Add performance monitoring and metrics

**Task QA.3: Security Testing**
- [ ] Test input validation and sanitization
- [ ] Test authentication and authorization
- [ ] Test file access permissions
- [ ] Test API security and rate limiting
- [ ] Test data privacy and compliance
- [ ] Add security documentation and guidelines

### Deployment and Release

**Task DEP.1: Release Preparation**
- [ ] Update package.json versions
- [ ] Update changelog and release notes
- [ ] Create migration guide for users
- [ ] Test deployment in staging environment
- [ ] Prepare rollback plan
- [ ] Coordinate with team for release

**Task DEP.2: Production Deployment**
- [ ] Deploy backend changes to production
- [ ] Deploy frontend changes to production
- [ ] Monitor system health and performance
- [ ] Verify all functionality works in production
- [ ] Update documentation and support materials
- [ ] Communicate changes to users

### Post-Release

**Task POST.1: Monitoring and Support**
- [ ] Monitor system performance and errors
- [ ] Collect user feedback and bug reports
- [ ] Fix critical issues and bugs
- [ ] Update documentation based on feedback
- [ ] Plan future improvements and features
- [ ] Conduct retrospective and lessons learned
