# Resources 2.0 Specification

## Table of Contents
1. [Problem Statement](#problem-statement)
2. [Current State](#current-state)
3. [Desired Architecture](#desired-architecture)
4. [Resource Schema Specification](#resource-schema-specification)
5. [View Schema Specification](#view-schema-specification)
6. [Tool Binding Standards](#tool-binding-standards)
7. [Implementation Examples](#implementation-examples)
8. [Migration Strategy](#migration-strategy)

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

### Resource URI Format

Resources are identified by URIs following the pattern: `<resource>://<server>/<resource-id>`

- **The protocol (scheme) IS the resource name** - e.g., `workflow://` defines the "workflow" resource type
- **The server identifier** - e.g., `workflow://server-a/` identifies which MCP server manages this resource
- **The pathname IS the resource instance identifier** - e.g., `workflow://server-a/123` or `workflow://server-a/users/get-user-email-and-send-reset-password-link`

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
const ResourceUriSchema = z.string().regex(/^[a-z]+:\/\/[^\/]+\/.+$/, "Invalid resource URI format");
```

### Generic Schema Factory Functions

```typescript
import { z } from "zod";

// ============================================================================
// MISCELLANEOUS TYPES
// ============================================================================

// Common URI format validation
const ResourceUriSchema = z.string().regex(/^[a-z]+:\/\/[^\/]+\/.+$/, "Invalid resource URI format");

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

---

## View Schema Specification

### View Data Schema

Views define how resources should be rendered and how LLM agents should interact with them:

```typescript
const ViewDataSchema = z.object({
  title: z.string(), // Human-readable title for the view
  icon: z.string().url(), // HTTPS URL to an image icon
  tools: z.array(z.string()), // Array of tool names that this view will call
});
```

### View Render Operation

Views support a custom render operation that returns UI components and LLM context:

```typescript
const viewRenderTool = {
  toolName: "deco_resource_view_render",
  inputSchema: z.object({
    view: ResourceUriSchema, // URI of the view to render
    resource: ResourceUriSchema, // URI of the resource to render in the view
  }),
  outputSchema: z.object({
    items: z.array(z.object({
      url: z.string(),
      prompt: z.string(),
      tools: z.array(z.string()),
    })),
  }),
};
```

---

## Tool Binding Standards

All resources must implement a standardized set of tool bindings that define the interface between the CMS and MCP servers. These bindings consist of `toolName`, `inputSchema`, and `outputSchema`.

### Standard Tool Naming Convention

All resource tools must follow the naming pattern: `deco_resource_{resource}_{operation}`

Examples:
- `deco_resource_workflow_search`
- `deco_resource_workflow_read`
- `deco_resource_workflow_create`
- `deco_resource_workflow_update`
- `deco_resource_workflow_delete`
- `deco_resource_workflow_start` (domain-specific)
- `deco_resource_workflow_stop` (domain-specific)

### Required Tools

Every resource must implement these standard tools:

1. **Search Tool**: `deco_resource_{resource}_search`
2. **Read Tool**: `deco_resource_{resource}_read`

### Optional Tools

Resources may implement these optional tools:

3. **Create Tool**: `deco_resource_{resource}_create`
4. **Update Tool**: `deco_resource_{resource}_update`
5. **Delete Tool**: `deco_resource_{resource}_delete`

### Domain-Specific Tools

Resources can define additional domain-specific tools beyond the standard CRUD operations:
- These tools should follow the same binding pattern: `deco_resource_{resource}_{operation}`
- Examples: `deco_resource_workflow_start`, `deco_resource_workflow_stop`, `deco_resource_workflow_get_status`, `deco_resource_workflow_get_logs`

---

## Implementation Examples

### Example: View Resource Tool Bindings

Here's how a view resource would implement the standardized tool bindings using Zod:

```typescript
import { z } from "zod";

const ViewDataSchema = z.object({
  title: z.string(), // Human-readable title for the view
  icon: z.string().url(), // HTTPS URL to an image icon
  tools: z.array(z.string()), // Array of tool names that this view will call
});

const ViewItemSchema = createItemSchema(ViewDataSchema);

// Standard CRUD Tool Bindings for Views
const viewSearchTool = {
  toolName: "deco_resource_view_search",
  inputSchema: SearchInputSchema,
  outputSchema: createSearchOutputSchema(ViewItemSchema),
};

const viewReadTool = {
  toolName: "deco_resource_view_read",
  inputSchema: ReadInputSchema,
  outputSchema: createReadOutputSchema(ViewDataSchema),
};

const viewCreateTool = {
  toolName: "deco_resource_view_create",
  inputSchema: createCreateInputSchema(ViewDataSchema),
  outputSchema: createCreateOutputSchema(ViewDataSchema),
};

const viewUpdateTool = {
  toolName: "deco_resource_view_update",
  inputSchema: createUpdateInputSchema(ViewDataSchema),
  outputSchema: createUpdateOutputSchema(ViewDataSchema),
};

const viewDeleteTool = {
  toolName: "deco_resource_view_delete",
  inputSchema: DeleteInputSchema,
  outputSchema: DeleteOutputSchema,
};

// Custom View-Specific Tool: Render Operation
const viewRenderTool = {
  toolName: "deco_resource_view_render",
  inputSchema: z.object({
    view: ResourceUriSchema, // URI of the view to render
    resource: ResourceUriSchema, // URI of the resource to render in the view
  }),
  outputSchema: z.object({
    url: z.string(),
    prompt: z.string(),
  }),
};

// Example Usage
const workflowDetailView: z.infer<typeof ViewDataSchema> = {
  title: "Workflow Details",
  icon: "https://example.com/icons/workflow-detail.svg",
  tools: [
    "deco_resource_workflow_read",
    "deco_resource_workflow_update", 
    "deco_resource_workflow_start",
    "deco_resource_workflow_stop",
    "deco_resource_workflow_get_logs"
  ],
};

const workflowListView: z.infer<typeof ViewDataSchema> = {
  title: "Workflow List",
  icon: "https://example.com/icons/workflow-list.svg",
  tools: [
    "deco_resource_workflow_search",
    "deco_resource_workflow_create",
    "deco_resource_workflow_bulk_delete",
    "deco_resource_workflow_bulk_start"
  ],
};
```

### Example: View Search Tool Response

Here's a sample response from the `deco_resource_view_search` tool:

```typescript
// Input to view_search
const searchInput = {
  term: "workflow",
  page: 1,
  pageSize: 10,
  filters: {
    resourceProto: "workflow"
  },
  sortBy: "created_at",
  sortOrder: "desc" as const
};

// Output from view_search
const searchResponse = {
  items: [
    {
      uri: "view://server-a/workflow-detail-basic",
      data: {
        title: "Workflow Details",
        icon: "https://example.com/icons/workflow-detail.svg",
        tools: [
          "deco_resource_workflow_read",
          "deco_resource_workflow_update", 
          "deco_resource_workflow_start",
          "deco_resource_workflow_stop",
          "deco_resource_workflow_get_logs"
        ]
      },
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-20T14:45:00Z",
      created_by: "user-123",
      updated_by: "user-456",
      timestamp: "2024-01-20T14:45:00Z"
    },
    {
      uri: "view://server-b/workflow-detail-advanced",
      data: {
        title: "Advanced Workflow Details",
        icon: "https://example.com/icons/workflow-advanced.svg",
        tools: [
          "deco_resource_workflow_read",
          "deco_resource_workflow_update", 
          "deco_resource_workflow_start",
          "deco_resource_workflow_stop",
          "deco_resource_workflow_get_logs",
          "deco_resource_workflow_get_executions",
          "deco_resource_workflow_debug"
        ]
      },
      created_at: "2024-01-10T09:15:00Z",
      updated_at: "2024-01-18T16:20:00Z",
      created_by: "user-789",
      updated_by: "user-789",
      timestamp: "2024-01-18T16:20:00Z"
    },
    {
      uri: "view://server-a/workflow-list-basic",
      data: {
        title: "Workflow List",
        icon: "https://example.com/icons/workflow-list.svg",
        tools: [
          "deco_resource_workflow_search",
          "deco_resource_workflow_create",
          "deco_resource_workflow_bulk_delete",
          "deco_resource_workflow_bulk_start"
        ]
      },
      created_at: "2024-01-12T11:00:00Z",
      updated_at: "2024-01-19T13:30:00Z",
      created_by: "user-123",
      updated_by: "user-123",
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

Here's a sample response from the `deco_resource_view_read` tool:

```typescript
// Input to view_read
const readInput = {
  uri: "view://server-a/workflow-detail-basic"
};

// Output from view_read
const readResponse = {
  uri: "view://server-a/workflow-detail-basic",
  data: {
    title: "Workflow Details",
    icon: "https://example.com/icons/workflow-detail.svg",
    tools: [
      "deco_resource_workflow_read",
      "deco_resource_workflow_update", 
      "deco_resource_workflow_start",
      "deco_resource_workflow_stop",
      "deco_resource_workflow_get_logs"
    ]
  },
  created_at: "2024-01-15T10:30:00Z",
  updated_at: "2024-01-20T14:45:00Z",
  created_by: "user-123",
  updated_by: "user-456",
  timestamp: "2024-01-20T14:45:00Z"
};
```

### Example: View Render Tool Response

Here's a sample response from the `deco_resource_view_render` tool:

```typescript
// Input to view_render
const renderInput = {
  view: "view://server-a/workflow-detail-basic",
  resource: "workflow://server-a/123"
};

// Output from view_render
const renderResponse = {
  url: "https://example.com/components/workflow-detail-form",
  prompt: "You are helping the user manage a workflow. You can read the workflow details, update its properties, start or stop the workflow, and view its logs. Always confirm actions before executing them."
};
```

### Example: View Render Tool Response (List View)

Here's another example for a list view:

```typescript
// Input to view_render for a list view
const listRenderInput = {
  view: "view://server-a/workflow-list-basic",
  resource: "workflow://server-a/*" // Wildcard for list view
};

// Output from view_render for list view
const listRenderResponse = {
  url: "https://example.com/components/workflow-list-table",
  prompt: "You are helping the user browse and manage workflows. You can search for workflows, create new ones, and perform bulk operations. Provide clear feedback on all actions."
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

## Questions to Explore

### Technical Questions
- [ ] **Resource Schema Standardization**: How should we define the flexible operation structure? Should operations be named with patterns like `{resource}_{operation}` (e.g., `workflow_start`, `workflow_get_status`)?
- [ ] **View Schema Definition**: How detailed should the agent configuration be? Should views specify exact tool names, or should they reference operation categories?
- [ ] **Discovery Mechanism**: How should the CMS discover available resources and views from MCP servers? Should servers register them at startup, or should the CMS query them dynamically?
- [ ] **View Selection UI**: How should users choose between multiple views for the same resource? Should there be a "default" view with alternatives, or equal treatment?
- [ ] **LLM Context Sharing**: How should views communicate their current state and available actions to LLM agents? Should this be through a standardized context API?
- [ ] **Tool Access Coordination**: How do we ensure LLM agents have access to the same tools that views are using? Should there be a shared tool registry?
- [ ] **Operation Naming**: How should we handle operation naming conflicts between different servers? Should there be namespacing?
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