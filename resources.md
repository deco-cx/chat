# Resources 2.0 Specification

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Current State](#current-state)
3. [Desired Architecture](#desired-architecture)
4. [Resource Schema Specification](#resource-schema-specification)
5. [View Schema Specification](#view-schema-specification)
6. [Namespace Guidelines](#namespace-guidelines)
7. [Tool Binding Standards](#tool-binding-standards)
8. [Workflow Bindings Specification](#workflow-bindings-specification)
9. [Resource Binding Examples](#resource-binding-examples)
10. [Implementation Examples](#implementation-examples)
11. [Migration Strategy](#migration-strategy)

---

## Problem Statement

### The Challenge: Building a Plugin-Based CMS with Rich UI Components

We are building a Content Management System (CMS) that operates as a mesh of MCP (Model Context Protocol) server integrations. Each integration is an HTTP server that exposes functionality through "tools" rather than traditional REST endpoints.

### The Multi-Server View Problem

**Scenario:**
- Server A defines a "Workflow" resource with operations: create, read, update, delete, start, stop, get_status, get_logs
- Server A also provides a "Workflow Detail View" with specific UI components, tools, and LLM prompts for workflow management
- Server B can provide an alternative "Workflow Detail View" with different UI, different tools, and different LLM behavior
- The CMS needs to present both view options to users and coordinate LLM agent behavior

### Key Requirements

1. **Resource Schema Definition**: CMS must support flexible resource schemas that define both data structure and available operations
2. **Resource Type Discovery**: MCP servers must provide a way to list all available resource types (URI schemes) they support
3. **View Management**: CMS must support multiple views per resource type from different servers
4. **Tool Coordination**: Views must specify which tools are available and how LLM agents should use them
5. **LLM Agent Integration**: Views must provide prompts and context for LLM agent behavior
6. **Multi-Server Resource Management**: CMS must coordinate resources across multiple MCP servers
7. **Standardized Tool Bindings**: All resource operations must follow consistent naming and schema patterns
8. **Consistent Interface**: All resources and views must follow standardized schemas

---

## Current State

### Existing Architecture

**MCP Servers (Integrations)**
- Each server exposes tools with defined `name`, `inputSchema`, and `outputSchema`
- Schemas are built using Zod for type safety
- Tools provide the core functionality for data operations

### Current Limitations

- **No standardized resource schema definitions**: Each server defines resources differently
- **Inconsistent tool naming conventions**: No standard naming convention for resource operations
- **No standardized view definitions**: No standardized way to define views for resources
- **Limited LLM integration**: Limited coordination between views and LLM agent behavior
- **Multi-server coordination issues**: Difficult to manage resources across multiple servers
- **No resource type discovery mechanism**: No standardized way to discover available resource types
- **Inconsistent URI schemes**: Different servers use different URI patterns

### Current Problems

1. **Resource Schema Inconsistency**: Each server defines resources differently
2. **Tool Naming Chaos**: No standard naming convention for resource operations
3. **View Management**: No standardized way to define views for resources
4. **LLM Integration**: Limited coordination between views and LLM agent behavior
5. **Multi-Server Coordination**: Difficult to manage resources across multiple servers

---

## Desired Architecture

### Core Components

**Resources**
- Defined by standardized schemas that describe the data structure and available operations
- MCP servers can define operations over resources (not just CRUD)
- Operations can include domain-specific actions beyond basic CRUD
- Example: A "Workflow" resource might have create, read, update, delete operations, but also start, stop, get_status, and get_logs operations

**Views**
- Define how resources should be rendered and how LLM agents should interact with them
- Multiple views can exist for the same resource type from different servers
- Views specify available tools and LLM agent behavior
- Views are identified by URIs following the pattern: `rsc://<integrationId>/view/<view-name>`
- Views provide UI components, LLM prompts, and tool coordination for resource management

**Workflows**
- Represent automated processes or sequences of operations that can be executed
- Workflows are resources themselves, identified by URIs following the pattern: `rsc://<integrationId>/workflow/<workflow-id>`
- Workflows can be managed through standard resource operations (CRUD) using the `deco_resource_` namespace
- Workflow execution and monitoring operations use the `deco_workflow_` namespace (e.g., `deco_workflow_start`, `deco_workflow_terminate`, `deco_workflow_get_status`)

### Resource URI Format

Resources are identified by URIs following the pattern: `rsc://<integrationId>/<resource-name>/<resource-id>`

- **Universal scheme**: All resources use the `rsc://` scheme
- **Integration ID**: Identifies which MCP integration manages this resource
- **Resource name**: The type of resource (e.g., "workflow", "user", "document")
- **Resource ID**: The specific instance identifier

Examples:
- `rsc://github/workflow/123`
- `rsc://notion/user/john-doe`
- `rsc://slack/document/project-456/task-789`

### Resource Metadata

Resources may include standard audit fields (flattened at the top level, all optional):
- `created_at` - when the resource was first created (ISO datetime string)
- `updated_at` - when the resource was last modified (ISO datetime string)
- `created_by` - who created the resource (user identifier)
- `updated_by` - who last updated the resource (user identifier)
- `timestamp` - resource timestamp for tracking purposes (ISO datetime string)

---

## Resource Schema Specification

### Common URI Format Validation

```typescript
import { z } from "zod";

// Common URI format validation
const ResourceUriSchema = z.string().regex(/^rsc:\/\/[^\/]+\/[^\/]+\/.+$/, "Invalid resource URI format");
```

### Generic Schema Factory Functions

All resource data schemas must extend the `BaseResourceDataSchema` to ensure they include a required `title` field. This provides consistency across all resources and enables proper display in the UI.

```typescript
import { z } from "zod";

// ============================================================================
// MISCELLANEOUS TYPES
// ============================================================================

// Common URI format validation
const ResourceUriSchema = z.string().regex(/^rsc:\/\/[^\/]+\/[^\/]+\/.+$/, "Invalid resource URI format");

// Base resource data schema that all resource data schemas must extend
const BaseResourceDataSchema = z.object({
  title: z.string(), // Human-readable title for the resource
});

// Tool binding interface definition
interface ToolBinding {
  name: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  optional?: boolean;
}

// Generic item schema factory
function createItemSchema<T extends z.ZodTypeAny>(dataSchema: T) {
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

// ============================================================================
// SEARCH OPERATION SCHEMAS
// ============================================================================

// Common search input schema
const SearchInputSchema = z.object({
  term: z.string().optional(),           // Optional search term for text-based searching
  page: z.number().int().min(1),         // Required page number (1-based)
  pageSize: z.number().int().min(1).max(100).default(20), // Optional page size (default: 20)
  filters: z.record(z.any()).optional(), // Optional resource-specific filters
  sortBy: z.string().optional(),         // Optional field to sort by
  sortOrder: z.enum(["asc", "desc"]).optional(), // Optional sort direction
});

function createSearchOutputSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),            // Array of resource instances
    totalCount: z.number().int().min(0),   // Total number of items across all pages
    page: z.number().int().min(1),         // Current page number
    pageSize: z.number().int().min(1),     // Items per page
    totalPages: z.number().int().min(0),   // Total number of pages
    hasNextPage: z.boolean(),              // Whether there are more pages
    hasPreviousPage: z.boolean(),          // Whether there are previous pages
  });
}

// ============================================================================
// READ OPERATION SCHEMAS
// ============================================================================

const ReadInputSchema = z.object({
  uri: ResourceUriSchema,                // Resource URI to read
});

function createReadOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,                // Resource URI
    data: dataSchema,                      // Complete resource data
    created_at: z.string().datetime().optional(),    // ISO timestamp
    updated_at: z.string().datetime().optional(),    // ISO timestamp
    created_by: z.string().optional(),               // User identifier
    updated_by: z.string().optional(),               // User identifier
    timestamp: z.string().datetime().optional(),     // Resource timestamp
  });
}

// ============================================================================
// CREATE OPERATION SCHEMAS
// ============================================================================

function createCreateInputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,                      // Resource data to create
  });
}

function createCreateOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,                // Generated resource URI
    data: dataSchema,                      // Created resource data
    created_at: z.string().datetime().optional(),    // ISO timestamp
    created_by: z.string().optional(),               // User identifier
    timestamp: z.string().datetime().optional(),     // Resource timestamp
  });
}

// ============================================================================
// UPDATE OPERATION SCHEMAS
// ============================================================================

function createUpdateInputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,                // Resource URI to update
    data: dataSchema,                      // Resource data to update
  });
}

function createUpdateOutputSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    uri: ResourceUriSchema,                // Resource URI
    data: dataSchema,                      // Updated resource data
    created_at: z.string().datetime().optional(),    // ISO timestamp
    updated_at: z.string().datetime().optional(),    // ISO timestamp
    created_by: z.string().optional(),               // User identifier
    updated_by: z.string().optional(),               // User identifier
    timestamp: z.string().datetime().optional(),     // Resource timestamp
  });
}

// ============================================================================
// DELETE OPERATION SCHEMAS
// ============================================================================

const DeleteInputSchema = z.object({
  uri: ResourceUriSchema,                // Resource URI to delete
});

const DeleteOutputSchema = z.object({
  success: z.boolean(),                  // Whether the deletion was successful
  uri: ResourceUriSchema,                // URI of the deleted resource
});
```

### Example: Creating Custom Resource Schemas

Here's how to create custom resource data schemas that extend the base resource data schema:

```typescript
// Example: Document Resource Schema
const DocumentDataSchema = BaseResourceDataSchema.extend({
  content: z.string(),                   // Document content
  type: z.enum(["markdown", "html", "text"]),
  tags: z.array(z.string()).optional(),  // Optional tags
  author: z.string().optional(),         // Document author
});

// Example: User Resource Schema  
const UserDataSchema = BaseResourceDataSchema.extend({
  email: z.string().email(),             // User email address
  role: z.enum(["admin", "user", "guest"]),
  preferences: z.record(z.any()).optional(), // User preferences
  lastLogin: z.string().datetime().optional(),
});

// Example: Project Resource Schema
const ProjectDataSchema = BaseResourceDataSchema.extend({
  description: z.string().optional(),    // Project description
  status: z.enum(["active", "archived", "planning"]),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  team: z.array(z.string()).optional(),  // Team member IDs
});
```

---

## View Schema Specification

### View Data Schema

Views define how resources should be rendered and how LLM agents should interact with them:

```typescript
const ViewDataSchema = BaseResourceDataSchema.extend({
  icon: z.string().url(), // HTTPS URL to an image icon
  prompt: z.string(), // LLM prompt for this view
  tools: z.array(z.string()), // Array of tool names that this view will call
});
```

### View Render Operation

Views support custom render operations that return UI components and LLM context. **Note: View render operations use the `deco_view_render_{viewName}` pattern** as they are view-specific functionality rather than core resource operations:

```typescript
// Generic view render tool factory
function createViewRenderTool(viewName: string, inputSchema: z.ZodTypeAny) {
  return {
    toolName: `deco_view_render_${viewName}`, // Uses deco_view_render_{viewName} pattern
    inputSchema: inputSchema,
    outputSchema: z.object({
      url: z.string(),
      prompt: z.string().optional(),
      tools: z.array(z.string()).optional(),
    }),
  };
}

// Example: Workflow Detail View Render Tool
const workflowDetailRenderTool = createViewRenderTool(
  "workflow_detail",
  z.object({
    resource: ResourceUriSchema, // URI of the resource to render in the view
  })
);

// Example: Workflow List View Render Tool
const workflowListRenderTool = createViewRenderTool(
  "workflow_list",
  z.object({
    term: z.string().optional(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    filters: z.record(z.any()).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
);
```

---

## Namespace Guidelines

### When to Use `deco_resource_` Namespace

The `deco_resource_` namespace should **ONLY** be used for the five well-known resource management operations:

- **Search**: `DECO_RESOURCE_{RESOURCE}_SEARCH`
- **Read**: `DECO_RESOURCE_{RESOURCE}_READ`
- **Create**: `DECO_RESOURCE_{RESOURCE}_CREATE`
- **Update**: `DECO_RESOURCE_{RESOURCE}_UPDATE`
- **Delete**: `DECO_RESOURCE_{RESOURCE}_DELETE`

**Important**: The `deco_resource_` namespace is strictly reserved for these five operations only. No other operations should use this namespace, including domain-specific operations, workflow execution, view rendering, or integration-specific functionality.

### When NOT to Use `deco_resource_` Namespace

**Any operation that is NOT one of the five well-known operations (search, read, create, update, delete) should NOT use the `deco_resource_` namespace.**

This includes but is not limited to:

- **Domain-Specific Operations**: Any operation specific to a particular resource type (e.g., `workflow_start`, `user_login`, `document_publish`)
- **View-Specific Operations**: View render, view configuration, view-specific tools
- **Integration-Specific Operations**: Operations specific to a particular integration (e.g., `github_sync`, `notion_import`)
- **Workflow Operations**: Workflow execution, workflow management, workflow monitoring
- **UI-Specific Operations**: Component rendering, UI state management, user interface operations
- **System Operations**: Authentication, authorization, system configuration
- **Bulk Operations**: Bulk operations should use appropriate alternative namespaces (e.g., `deco_workflow_bulk_start`)

### Alternative Namespace Patterns

For operations that don't belong in the `deco_resource_` namespace, use descriptive namespaces:

- **View Operations**: `deco_view_{operation}` or `deco_view_render_{viewName}` (e.g., `deco_view_configure`, `deco_view_render_workflow_detail`, `deco_view_render_workflow_list`)
- **Workflow Operations**: `deco_workflow_{operation}` (e.g., `deco_workflow_start`, `deco_workflow_terminate`, `deco_workflow_get_status`, `deco_workflow_get_logs`)
- **Integration Operations**: `{integration}_{operation}` (e.g., `github_sync`, `notion_import`)
- **System Operations**: `system_{operation}` (e.g., `system_auth`, `system_config`)

---

## Tool Binding Standards

All resources must implement a standardized set of tool bindings that define the interface between the CMS and MCP servers. Tool bindings are defined as an array of objects with the following structure:

```typescript
Array<{
  name: string;
  inputSchema: z.ZodTypeAny;
  outputSchema: z.ZodTypeAny;
  optional?: boolean;
}>
```

### Standard Tool Naming Convention

All resource tools must follow the naming pattern: `deco_resource_{resource}_{operation}`

Examples:
- `DECO_RESOURCE_WORKFLOW_SEARCH`
- `DECO_RESOURCE_WORKFLOW_READ`
- `DECO_RESOURCE_WORKFLOW_CREATE`
- `DECO_RESOURCE_WORKFLOW_UPDATE`
- `DECO_RESOURCE_WORKFLOW_DELETE`

### Required Tools

Every resource must implement these standard tools:

```typescript
const requiredResourceBindings: ToolBinding[] = [
  {
    name: "DECO_RESOURCE_{RESOURCE}_SEARCH",
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(ResourceItemSchema),
    optional: false
  },
  {
    name: "DECO_RESOURCE_{RESOURCE}_READ",
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(ResourceDataSchema),
    optional: false
  }
];
```

### Optional Tools

Resources may implement these optional tools:

```typescript
const optionalResourceBindings: ToolBinding[] = [
  {
    name: "DECO_RESOURCE_{RESOURCE}_CREATE",
    inputSchema: createCreateInputSchema(ResourceDataSchema),
    outputSchema: createCreateOutputSchema(ResourceDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_{RESOURCE}_UPDATE",
    inputSchema: createUpdateInputSchema(ResourceDataSchema),
    outputSchema: createUpdateOutputSchema(ResourceDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_{RESOURCE}_DELETE",
    inputSchema: DeleteInputSchema,
    outputSchema: DeleteOutputSchema,
    optional: true
  }
];
```

### Domain-Specific Tools

Resources can define additional domain-specific tools beyond the standard CRUD operations:

```typescript
const domainSpecificBindings: ToolBinding[] = [
  // Workflow execution operations
  {
    name: "deco_workflow_start",
    inputSchema: z.object({
      uri: ResourceUriSchema,
      parameters: z.record(z.any()).optional()
    }),
    outputSchema: z.object({
      executionId: z.string(),
      status: z.enum(["started", "queued", "failed"]),
      message: z.string().optional()
    }),
    optional: true
  },
  {
    name: "deco_workflow_terminate",
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional()
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      terminatedExecutions: z.array(z.string()).optional()
    }),
    optional: true
  },
  // View operations
  {
    name: "deco_view_render_workflow_detail",
    inputSchema: z.object({
      resource: ResourceUriSchema
    }),
    outputSchema: z.object({
      url: z.string(),
      prompt: z.string().optional(),
      tools: z.array(z.string()).optional()
    }),
    optional: true
  },
  {
    name: "deco_view_render_workflow_list",
    inputSchema: z.object({
      term: z.string().optional(),
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      filters: z.record(z.any()).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional()
    }),
    outputSchema: z.object({
      url: z.string(),
      prompt: z.string().optional(),
      tools: z.array(z.string()).optional()
    }),
    optional: true
  },
  // Integration operations
  {
    name: "github_sync",
    inputSchema: z.object({
      repository: z.string(),
      branch: z.string().optional()
    }),
    outputSchema: z.object({
      success: z.boolean(),
      syncedFiles: z.number()
    }),
    optional: true
  }
];
```

**Important**: The `deco_resource_` namespace is strictly reserved for the five well-known operations only (search, read, create, update, delete). All domain-specific operations must use appropriate alternative namespaces.

---

## Workflow Bindings Specification

### Workflow Resource Interface

Workflows are resources that implement the standard resource bindings (CRUD operations) and define additional workflow-specific operations for execution and monitoring.

### Standard Workflow Resource Operations

Workflows must implement the standard resource operations using the `deco_resource_` namespace:

```typescript
const workflowResourceBindings: ToolBinding[] = [
  // Required resource operations
  {
    name: "DECO_RESOURCE_WORKFLOW_SEARCH",
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(createItemSchema(WorkflowDataSchema)),
    optional: false
  },
  {
    name: "DECO_RESOURCE_WORKFLOW_READ",
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(WorkflowDataSchema),
    optional: false
  },
  // Optional resource operations
  {
    name: "DECO_RESOURCE_WORKFLOW_CREATE",
    inputSchema: createCreateInputSchema(WorkflowDataSchema),
    outputSchema: createCreateOutputSchema(WorkflowDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_WORKFLOW_UPDATE",
    inputSchema: createUpdateInputSchema(WorkflowDataSchema),
    outputSchema: createUpdateOutputSchema(WorkflowDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_WORKFLOW_DELETE",
    inputSchema: DeleteInputSchema,
    outputSchema: DeleteOutputSchema,
    optional: true
  }
];
```

### Workflow-Specific Operations

Workflows define additional operations using the `deco_workflow_` namespace:

```typescript
const workflowSpecificBindings: ToolBinding[] = [
  // Required workflow operations
  {
    name: "deco_workflow_start",
    inputSchema: z.object({
      uri: ResourceUriSchema,
      parameters: z.record(z.any()).optional()
    }),
    outputSchema: z.object({
      executionId: z.string(),
      status: z.enum(["started", "queued", "failed"]),
      message: z.string().optional()
    }),
    optional: false
  },
  {
    name: "deco_workflow_terminate",
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional()
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      terminatedExecutions: z.array(z.string()).optional()
    }),
    optional: false
  },
  {
    name: "deco_workflow_get_status",
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional()
    }),
    outputSchema: z.object({
      status: z.enum(["running", "completed", "failed", "terminated", "queued"]),
      progress: z.number().min(0).max(100).optional(),
      startedAt: z.string().datetime().optional(),
      completedAt: z.string().datetime().optional(),
      error: z.string().optional()
    }),
    optional: false
  },
  // Optional workflow operations
  {
    name: "deco_workflow_get_logs",
    inputSchema: z.object({
      uri: ResourceUriSchema.optional(),
      executionId: z.string().optional(),
      limit: z.number().int().min(1).max(1000).default(100)
    }),
    outputSchema: z.object({
      logs: z.array(z.object({
        timestamp: z.string().datetime(),
        level: z.enum(["info", "warn", "error", "debug"]),
        message: z.string(),
        data: z.record(z.any()).optional()
      })),
      totalCount: z.number().int().min(0)
    }),
    optional: true
  },
  {
    name: "deco_workflow_get_executions",
    inputSchema: z.object({
      uri: ResourceUriSchema,
      limit: z.number().int().min(1).max(100).default(20),
      offset: z.number().int().min(0).default(0),
      status: z.enum(["running", "completed", "failed", "terminated"]).optional()
    }),
    outputSchema: z.object({
      executions: z.array(z.object({
        executionId: z.string(),
        status: z.enum(["running", "completed", "failed", "terminated", "queued"]),
        startedAt: z.string().datetime(),
        completedAt: z.string().datetime().optional(),
        duration: z.number().optional()
      })),
      totalCount: z.number().int().min(0)
    }),
    optional: true
  }
];
```

### Workflow Data Schema

```typescript
const WorkflowDataSchema = BaseResourceDataSchema.extend({
  description: z.string().optional(),  // Workflow description
  definition: z.record(z.any()),       // Workflow definition (integration-specific)
  status: z.enum(["draft", "active", "inactive"]).default("draft"),
  created_at: z.string().datetime().optional(),
  updated_at: z.string().datetime().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
});
```

### Complete Workflow Resource Bindings

The complete set of workflow resource bindings combines both resource management and workflow-specific operations:

```typescript
const completeWorkflowBindings: ToolBinding[] = [
  ...workflowResourceBindings,    // Standard CRUD operations
  ...workflowSpecificBindings     // Workflow execution operations
];
```

---

## Resource Binding Examples

### View Resource Bindings

```typescript
const viewResourceBindings: ToolBinding[] = [
  // Required resource operations
  {
    name: "DECO_RESOURCE_VIEW_SEARCH",
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(createItemSchema(ViewDataSchema)),
    optional: false
  },
  {
    name: "DECO_RESOURCE_VIEW_READ",
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(ViewDataSchema),
    optional: false
  },
  // Optional resource operations
  {
    name: "DECO_RESOURCE_VIEW_CREATE",
    inputSchema: createCreateInputSchema(ViewDataSchema),
    outputSchema: createCreateOutputSchema(ViewDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_VIEW_UPDATE",
    inputSchema: createUpdateInputSchema(ViewDataSchema),
    outputSchema: createUpdateOutputSchema(ViewDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_VIEW_DELETE",
    inputSchema: DeleteInputSchema,
    outputSchema: DeleteOutputSchema,
    optional: true
  },
  // View-specific operations
  {
    name: "deco_view_render_workflow_detail",
    inputSchema: z.object({
      resource: ResourceUriSchema
    }),
    outputSchema: z.object({
      url: z.string(),
      prompt: z.string().optional(),
      tools: z.array(z.string()).optional()
    }),
    optional: true
  },
  {
    name: "deco_view_render_workflow_list",
    inputSchema: z.object({
      term: z.string().optional(),
      page: z.number().int().min(1),
      pageSize: z.number().int().min(1).max(100).default(20),
      filters: z.record(z.any()).optional(),
      sortBy: z.string().optional(),
      sortOrder: z.enum(["asc", "desc"]).optional()
    }),
    outputSchema: z.object({
      url: z.string(),
      prompt: z.string().optional(),
      tools: z.array(z.string()).optional()
    }),
    optional: true
  }
];
```

### Document Resource Bindings

```typescript
const documentResourceBindings: ToolBinding[] = [
  // Required resource operations
  {
    name: "DECO_RESOURCE_DOCUMENT_SEARCH",
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(createItemSchema(DocumentDataSchema)),
    optional: false
  },
  {
    name: "DECO_RESOURCE_DOCUMENT_READ",
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(DocumentDataSchema),
    optional: false
  },
  // Optional resource operations
  {
    name: "DECO_RESOURCE_DOCUMENT_CREATE",
    inputSchema: createCreateInputSchema(DocumentDataSchema),
    outputSchema: createCreateOutputSchema(DocumentDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_DOCUMENT_UPDATE",
    inputSchema: createUpdateInputSchema(DocumentDataSchema),
    outputSchema: createUpdateOutputSchema(DocumentDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_DOCUMENT_DELETE",
    inputSchema: DeleteInputSchema,
    outputSchema: DeleteOutputSchema,
    optional: true
  },
  // Document-specific operations
  {
    name: "document_publish",
    inputSchema: z.object({
      uri: ResourceUriSchema,
      publishTo: z.array(z.string()).optional()
    }),
    outputSchema: z.object({
      success: z.boolean(),
      publishedUrls: z.array(z.string()).optional()
    }),
    optional: true
  },
  {
    name: "document_export",
    inputSchema: z.object({
      uri: ResourceUriSchema,
      format: z.enum(["pdf", "html", "markdown", "docx"])
    }),
    outputSchema: z.object({
      downloadUrl: z.string(),
      expiresAt: z.string().datetime()
    }),
    optional: true
  }
];
```

### User Resource Bindings

```typescript
const userResourceBindings: ToolBinding[] = [
  // Required resource operations
  {
    name: "DECO_RESOURCE_USER_SEARCH",
    inputSchema: SearchInputSchema,
    outputSchema: createSearchOutputSchema(createItemSchema(UserDataSchema)),
    optional: false
  },
  {
    name: "DECO_RESOURCE_USER_READ",
    inputSchema: ReadInputSchema,
    outputSchema: createReadOutputSchema(UserDataSchema),
    optional: false
  },
  // Optional resource operations
  {
    name: "DECO_RESOURCE_USER_CREATE",
    inputSchema: createCreateInputSchema(UserDataSchema),
    outputSchema: createCreateOutputSchema(UserDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_USER_UPDATE",
    inputSchema: createUpdateInputSchema(UserDataSchema),
    outputSchema: createUpdateOutputSchema(UserDataSchema),
    optional: true
  },
  {
    name: "DECO_RESOURCE_USER_DELETE",
    inputSchema: DeleteInputSchema,
    outputSchema: DeleteOutputSchema,
    optional: true
  },
  // User-specific operations
  {
    name: "user_login",
    inputSchema: z.object({
      email: z.string().email(),
      password: z.string()
    }),
    outputSchema: z.object({
      success: z.boolean(),
      token: z.string().optional(),
      user: UserDataSchema.optional()
    }),
    optional: true
  },
  {
    name: "user_logout",
    inputSchema: z.object({
      token: z.string()
    }),
    outputSchema: z.object({
      success: z.boolean()
    }),
    optional: true
  },
  {
    name: "user_reset_password",
    inputSchema: z.object({
      email: z.string().email()
    }),
    outputSchema: z.object({
      success: z.boolean(),
      message: z.string()
    }),
    optional: true
  }
];
```

---

## Implementation Examples

### Example: View Resource Tool Bindings

Here's how a view resource would implement the standardized tool bindings using Zod:

```typescript
import { z } from "zod";

const ViewDataSchema = z.object({
  title: z.string(), // Human-readable title for the view
  icon: z.string().url(), // HTTPS URL to an image icon
  prompt: z.string(), // LLM prompt for this view
  tools: z.array(z.string()), // Array of tool names that this view will call
});

const ViewItemSchema = createItemSchema(ViewDataSchema);

// Standard CRUD Tool Bindings for Views
const viewSearchTool = {
  toolName: "DECO_RESOURCE_VIEW_SEARCH",
  inputSchema: SearchInputSchema,
  outputSchema: createSearchOutputSchema(ViewItemSchema),
};

const viewReadTool = {
  toolName: "DECO_RESOURCE_VIEW_READ",
  inputSchema: ReadInputSchema,
  outputSchema: createReadOutputSchema(ViewDataSchema),
};

const viewCreateTool = {
  toolName: "DECO_RESOURCE_VIEW_CREATE",
  inputSchema: createCreateInputSchema(ViewDataSchema),
  outputSchema: createCreateOutputSchema(ViewDataSchema),
};

const viewUpdateTool = {
  toolName: "DECO_RESOURCE_VIEW_UPDATE",
  inputSchema: createUpdateInputSchema(ViewDataSchema),
  outputSchema: createUpdateOutputSchema(ViewDataSchema),
};

const viewDeleteTool = {
  toolName: "DECO_RESOURCE_VIEW_DELETE",
  inputSchema: DeleteInputSchema,
  outputSchema: DeleteOutputSchema,
};

// Generic View Render Tool Factory
// Note: View render tools use deco_view_ namespace
function createViewRenderTool<T extends z.ZodTypeAny>(viewName: string, inputSchema: T) {
  return {
    toolName: `deco_view_render_${viewName}`, // Uses deco_view_ namespace for view operations
    inputSchema: inputSchema,
    outputSchema: z.object({
      url: z.string(),
    }),
  };
}

// Example: Workflow Detail View Render Tool
const workflowDetailRenderTool = createViewRenderTool(
  "workflow_detail",
  z.object({
    resource: ResourceUriSchema, // URI of the workflow resource to render
  })
);

// Example: Workflow List View Render Tool
const workflowListRenderTool = createViewRenderTool(
  "workflow_list",
  z.object({
    term: z.string().optional(),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100).default(20),
    filters: z.record(z.any()).optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
);

// Example Usage
const workflowDetailView: z.infer<typeof ViewDataSchema> = {
  title: "Workflow Details",
  icon: "https://example.com/icons/workflow-detail.svg",
  prompt: "You are helping the user manage a workflow. You can read the workflow details, update its properties, start or stop the workflow, and view its logs. Always confirm actions before executing them.",
  tools: [
    "DECO_RESOURCE_WORKFLOW_READ",
    "DECO_RESOURCE_WORKFLOW_UPDATE", 
    "deco_workflow_start",
    "deco_workflow_terminate",
    "deco_workflow_get_logs",
    "deco_view_render_workflow_detail" // Uses deco_view_ namespace for view operations
  ],
};

const workflowListView: z.infer<typeof ViewDataSchema> = {
  title: "Workflow List",
  icon: "https://example.com/icons/workflow-list.svg",
  prompt: "You are helping the user browse and manage workflows. You can search for workflows, create new ones, and perform bulk operations. Provide clear feedback on all actions.",
  tools: [
    "DECO_RESOURCE_WORKFLOW_SEARCH",
    "DECO_RESOURCE_WORKFLOW_CREATE",
    "deco_workflow_bulk_delete",
    "deco_workflow_bulk_start",
    "deco_view_render_workflow_list" // Uses deco_view_ namespace for view operations
  ],
};
```

### Example: View Search Tool Response

Here's a sample response from the `DECO_RESOURCE_VIEW_SEARCH` tool:

```typescript
// Input to view_search
const searchInput = {
  term: "",
  page: 1,
  pageSize: 10,
  sortBy: "created_at",
  sortOrder: "desc" as const
};

// Output from view_search
const searchResponse = {
  items: [
    {
      uri: "rsc://github/view/workflow-detail-basic",
      data: {
        title: "Workflow Details",
        icon: "https://example.com/icons/workflow-detail.svg",
        prompt: "You are helping the user manage a workflow. You can read the workflow details, update its properties, start or stop the workflow, and view its logs. Always confirm actions before executing them.",
        tools: [
          "DECO_RESOURCE_WORKFLOW_READ",
          "DECO_RESOURCE_WORKFLOW_UPDATE", 
          "deco_workflow_start",
          "deco_workflow_terminate",
          "deco_workflow_get_logs",
          "deco_view_render_workflow_detail"
        ]
      },
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-20T14:45:00Z",
      created_by: "github",
      updated_by: "github",
      timestamp: "2024-01-20T14:45:00Z"
    },
    {
      uri: "rsc://notion/view/workflow-detail-advanced",
      data: {
        title: "Advanced Workflow Details",
        icon: "https://example.com/icons/workflow-advanced.svg",
        prompt: "You are helping the user build and debug complex workflows. You have access to advanced debugging tools and can provide detailed insights into workflow execution.",
        tools: [
          "DECO_RESOURCE_WORKFLOW_READ",
          "DECO_RESOURCE_WORKFLOW_UPDATE", 
          "deco_workflow_start",
          "deco_workflow_terminate",
          "deco_workflow_get_logs",
          "deco_workflow_get_executions",
          "deco_workflow_debug",
          "deco_view_render_workflow_detail"
        ]
      },
      created_at: "2024-01-10T09:15:00Z",
      updated_at: "2024-01-18T16:20:00Z",
      created_by: "notion",
      updated_by: "notion",
      timestamp: "2024-01-18T16:20:00Z"
    },
    {
      uri: "rsc://github/view/workflow-list-basic",
      data: {
        title: "Workflow List",
        icon: "https://example.com/icons/workflow-list.svg",
        prompt: "You are helping the user browse and manage workflows. You can search for workflows, create new ones, and perform bulk operations. Provide clear feedback on all actions.",
        tools: [
          "DECO_RESOURCE_WORKFLOW_SEARCH",
          "DECO_RESOURCE_WORKFLOW_CREATE",
          "deco_workflow_bulk_delete",
          "deco_workflow_bulk_start",
          "deco_view_render_workflow_list"
        ]
      },
      created_at: "2024-01-12T11:00:00Z",
      updated_at: "2024-01-19T13:30:00Z",
      created_by: "github",
      updated_by: "github",
      timestamp: "2024-01-19T13:30:00Z"
    }
  ],
  totalCount: 3,
  page: 1,
  pageSize: 10,
  totalPages: 1,
  hasNextPage: false,
  hasPreviousPage: false
};
```

### Example: View Read Tool Response

Here's a sample response from the `DECO_RESOURCE_VIEW_READ` tool:

```typescript
// Input to view_read
const readInput = {
  uri: "rsc://github/view/workflow-detail-basic"
};

// Output from view_read
const readResponse = {
  uri: "rsc://github/view/workflow-detail-basic",
  data: {
    title: "Workflow Details",
    icon: "https://example.com/icons/workflow-detail.svg",
    prompt: "You are helping the user manage a workflow. You can read the workflow details, update its properties, start or stop the workflow, and view its logs. Always confirm actions before executing them.",
    tools: [
      "DECO_RESOURCE_WORKFLOW_READ",
      "DECO_RESOURCE_WORKFLOW_UPDATE", 
      "deco_workflow_start",
      "deco_workflow_terminate",
      "deco_workflow_get_logs",
      "deco_view_render_workflow_detail"
    ]
  },
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-20T14:45:00Z",
  created_by: "github",
  updated_by: "github",
  timestamp: "2024-01-20T14:45:00Z"
};
```

### Example: View Render Tool Response

Here's a sample response from the `deco_view_render_workflow_detail` tool:

```typescript
// Input to deco_view_render_workflow_detail
const renderInput = {
  resource: "rsc://github/workflow/123"
};

// Output from deco_view_render_workflow_detail
const renderResponse = {
  url: "https://example.com/components/workflow-detail-form"
};
```

### Example: View Render Tool Response (List View)

Here's another example for a list view:

```typescript
// Input to deco_view_render_workflow_list
const listRenderInput = {
  term: "active workflows",
  page: 1,
  pageSize: 20,
  filters: { status: "active" },
  sortBy: "created_at",
  sortOrder: "desc"
};

// Output from deco_view_render_workflow_list
const listRenderResponse = {
  url: "https://example.com/components/workflow-list-table"
};
```

---

## Migration Strategy

### Phase 1: Schema Standardization
1. Implement the standardized schema factory functions
2. Update existing resources to use the new schemas
3. Migrate tool bindings to follow the naming convention

### Phase 2: View System Implementation
1. Implement the view schema specification
2. Add view render operations to existing resources
3. Update CMS to support multiple views per resource

### Phase 3: Multi-Server Coordination
1. Implement resource type discovery across servers
2. Add view registration and selection mechanisms
3. Enable LLM agent coordination with views

### Phase 4: Advanced Features
1. Add domain-specific tool support
2. Implement advanced search and filtering
3. Add performance optimizations and caching

---

## Discovery Mechanism Specification

### Integration Discovery Process

The CMS discovers available resources, workflows, and views from MCP servers through a dynamic querying process:

#### 1. Views Discovery

```typescript
// Discover all available views from an integration
const discoverViews = async (integrationId: string) => {
  const viewsResponse = await callTool("DECO_RESOURCE_VIEW_SEARCH", {
    term: "", // Empty term to get all views
    page: 1,
    pageSize: 100
  });
  
  return viewsResponse.items.map(view => ({
    uri: view.uri,
    title: view.data.title,
    icon: view.data.icon,
    prompt: view.data.prompt,
    tools: view.data.tools,
    canAddToMenu: validateViewForMenu(view)
  }));
};

// Validate if a view can be added to the main menu
const validateViewForMenu = (view: ViewItem) => {
  // Check if the view has a render tool with empty input schema
  const renderTool = view.data.tools.find(tool => 
    tool.startsWith("deco_view_render_")
  );
  
  if (!renderTool) return false;
  
  // Query the tool's input schema to check if it's empty
  const toolSchema = getToolInputSchema(renderTool);
  return isEmptyInputSchema(toolSchema);
};
```

#### 2. Resource Discovery

```typescript
// Discover available resource types from an integration
const discoverResources = async (integrationId: string) => {
  const allTools = await getIntegrationTools(integrationId);
  
  // Find all deco_resource_{resourceName}_{operation} tools
  const resourceTools = allTools.filter(tool => 
    tool.name.match(/^deco_resource_([^_]+)_(search|read|create|update|delete)$/)
  );
  
  // Group by resource name and validate compliance
  const resourceTypes = new Map();
  
  for (const tool of resourceTools) {
    const match = tool.name.match(/^deco_resource_([^_]+)_(search|read|create|update|delete)$/);
    if (match) {
      const resourceName = match[1];
      const operation = match[2];
      
      if (!resourceTypes.has(resourceName)) {
        resourceTypes.set(resourceName, {
          name: resourceName,
          operations: new Set(),
          compliant: false
        });
      }
      
      resourceTypes.get(resourceName).operations.add(operation);
    }
  }
  
  // Validate compliance with resource binding standards
  for (const [resourceName, resource] of resourceTypes) {
    resource.compliant = validateResourceCompliance(resourceName, resource.operations);
  }
  
  return Array.from(resourceTypes.values()).filter(r => r.compliant);
};

// Validate if a resource complies with binding standards
const validateResourceCompliance = (resourceName: string, operations: Set<string>) => {
  // Must have at least search and read operations
  const requiredOps = ['search', 'read'];
  const hasRequired = requiredOps.every(op => operations.has(op));
  
  // Check if all operations follow the correct naming pattern
  const hasCorrectNaming = Array.from(operations).every(op => 
    ['search', 'read', 'create', 'update', 'delete'].includes(op)
  );
  
  return hasRequired && hasCorrectNaming;
};
```

#### 3. Workflow Discovery

```typescript
// Discover workflow capabilities from an integration
const discoverWorkflows = async (integrationId: string) => {
  const allTools = await getIntegrationTools(integrationId);
  
  // Find workflow-specific tools
  const workflowTools = allTools.filter(tool => 
    tool.name.startsWith("deco_workflow_")
  );
  
  // Check for required workflow operations
  const hasRequiredOps = [
    'deco_workflow_start',
    'deco_workflow_terminate', 
    'deco_workflow_get_status'
  ].every(op => workflowTools.some(tool => tool.name === op));
  
  return {
    hasWorkflowSupport: hasRequiredOps,
    availableOperations: workflowTools.map(tool => tool.name),
    canAddToMenu: hasRequiredOps
  };
};
```

### Integration Screen Enhancement

The integrations screen should be enhanced to display:

```typescript
interface IntegrationCapabilities {
  integrationId: string;
  tools: ToolInfo[];
  resources: ResourceTypeInfo[];
  workflows: WorkflowCapabilities;
  views: ViewInfo[];
}

interface ResourceTypeInfo {
  name: string;
  title: string;
  operations: string[];
  canAddToMenu: boolean;
  suggestedView?: string; // View that accepts this resource type
}

interface ViewInfo {
  uri: string;
  title: string;
  icon: string;
  canAddToMenu: boolean;
  inputSchema: any;
}
```

### Menu Integration Strategy

Resources can be added to the main menu by:

1. **Resource Selection**: User selects a discovered resource type
2. **View Matching**: System finds views that accept that resource type (empty input schema)
3. **Menu Addition**: Resource is added to menu with the matching view
4. **Dynamic Loading**: When accessed, the view renders with the resource context

---

## Questions to Explore

### Answered Questions

The following questions have been answered through the specification:

**Resource Schema Standardization**: Operations are named using specific namespace patterns:
- `deco_resource_{resource}_{operation}` for CRUD operations (search, read, create, update, delete)
- `deco_workflow_{operation}` for workflow-specific operations (start, terminate, get_status, etc.)
- `deco_view_render_{viewName}` for view rendering operations
- `{integration}_{operation}` for integration-specific operations

**View Schema Definition**: Views specify exact tool names in their `tools` array. The `ViewDataSchema` includes:
- `title`: Human-readable title
- `icon`: HTTPS URL to an image icon
- `prompt`: LLM prompt for the view
- `tools`: Array of exact tool names that the view will call

**Operation Naming**: Namespace conflicts are avoided through strict namespace guidelines:
- `deco_resource_` namespace is reserved for the five well-known CRUD operations only
- Domain-specific operations use appropriate alternative namespaces
- Clear separation prevents conflicts between different types of operations

**Discovery Mechanism**: The CMS discovers available resources and views by querying MCP servers dynamically:
- **Views Discovery**: Use `DECO_RESOURCE_VIEW_SEARCH` with empty term to list all available views
- **Resource Discovery**: Filter server tools to find `deco_resource_{resourceName}_{operation}` patterns to identify available resource types
- **View Validation**: Check if view render methods have empty input schemas to determine if they can be added to menus
- **Resource Validation**: Ensure resources comply with the resource binding standards before suggesting them

**View Selection UI**: Users can choose between multiple views through an integrations screen that displays:
- **Integration Tools**: Current tools from each integration
- **Integration Resources**: Discovered resource types from each integration
- **Integration Workflows**: Workflow capabilities from each integration  
- **Integration Views**: Available views that can be added to the main menu
- **Menu Integration**: Resources can be added to the main menu with views that accept resources

---

### Technical Questions
- [ ] **LLM Context Sharing**: How should views communicate their current state and available actions to LLM agents? Should this be through a standardized context API?
- [ ] **Tool Access Coordination**: How do we ensure LLM agents have access to the same tools that views are using? Should there be a shared tool registry?
- [ ] **View Inheritance**: Should views be able to extend or override other views? How should view composition work?

### Product Questions
- [ ] **User Experience**: How should the CMS present multiple view options to users? Should there be a "default" view with alternatives, or equal treatment?
- [ ] **View Capabilities**: What different types of views should be supported? (Detail views, list views, form views, dashboard views, etc.)
- [ ] **Resource Relationships**: How should resources relate to each other? Should there be a way to define relationships between resources from different servers?
- [ ] **Permission Model**: How should permissions work across different servers and views? Should each server manage its own permissions?
- [ ] **Caching Strategy**: How should resource data be cached? Should views be able to specify their own caching requirements?

### Implementation Questions
- [ ] **MCP Server Integration**: How should the CMS communicate with MCP servers? Should it use the existing MCP protocol or extend it?
- [ ] **Component Loading**: How should React components for views be loaded? Dynamic imports, iframe, or some other mechanism?
- [ ] **State Management**: How should state be shared between views and LLM agents? Should there be a centralized state management system?
- [ ] **Error Handling**: How should errors from different servers and views be handled and presented to users?
- [ ] **Performance**: How can we ensure good performance when dealing with multiple servers and dynamic view loading?
- [ ] **Backward Compatibility**: How do we ensure existing MCP servers continue to work while adding the new resource/view capabilities?

---

*This document is a living specification and will be updated as we explore and refine the Resources 2.0 design.*