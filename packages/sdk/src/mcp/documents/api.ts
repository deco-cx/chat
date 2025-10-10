import z from "zod";
import { formatIntegrationId, WellKnownMcpGroups } from "../../crud/groups.ts";
import { impl } from "../bindings/binder.ts";
import { WellKnownBindings } from "../bindings/index.ts";
import { VIEW_BINDING_SCHEMA } from "../bindings/views.ts";
import { DeconfigResourceV2 } from "../deconfig-v2/index.ts";
import { createToolGroup, DeconfigClient } from "../index.ts";
import {
  createViewImplementation,
  createViewRenderer,
} from "../views-v2/index.ts";
import { DetailViewRenderInputSchema } from "../views-v2/schemas.ts";
import {
  DOCUMENT_CREATE_PROMPT,
  DOCUMENT_DELETE_PROMPT,
  DOCUMENT_READ_PROMPT,
  DOCUMENT_SEARCH_PROMPT,
  DOCUMENT_UPDATE_PROMPT,
} from "./prompts.ts";
import { DocumentDefinitionSchema } from "./schemas.ts";

/**
 * Document Resource V2
 *
 * This module provides a Resources 2.0 implementation for document management
 * using the DeconfigResources 2.0 system with file-based storage.
 *
 * Key Features:
 * - File-based document storage in DECONFIG directories
 * - Resources 2.0 standardized schemas and URI format
 * - Type-safe document definitions with Zod validation
 * - Full CRUD operations for document management
 * - Markdown content support
 * - Custom React-based detail view for rich document editing
 *
 * Usage:
 * - Documents are stored as JSON files in /src/documents directory
 * - Each document has a unique ID and follows Resources 2.0 URI format
 * - Content is stored as markdown strings for easy editing
 * - Custom React view provides rich editing experience
 */

// Create the DocumentResourceV2 using DeconfigResources 2.0
export const DocumentResourceV2 = DeconfigResourceV2.define({
  directory: "/src/documents",
  resourceName: "document",
  group: WellKnownMcpGroups.Documents,
  dataSchema: DocumentDefinitionSchema,
  enhancements: {
    DECO_RESOURCE_DOCUMENT_SEARCH: {
      description: DOCUMENT_SEARCH_PROMPT,
    },
    DECO_RESOURCE_DOCUMENT_READ: {
      description: DOCUMENT_READ_PROMPT,
    },
    DECO_RESOURCE_DOCUMENT_CREATE: {
      description: DOCUMENT_CREATE_PROMPT,
    },
    DECO_RESOURCE_DOCUMENT_UPDATE: {
      description: DOCUMENT_UPDATE_PROMPT,
    },
    DECO_RESOURCE_DOCUMENT_DELETE: {
      description: DOCUMENT_DELETE_PROMPT,
    },
  },
});

// Export types for TypeScript usage
export type DocumentDataV2 = z.infer<typeof DocumentDefinitionSchema>;

// Helper function to create a document resource implementation
export function createDocumentResourceV2Implementation(
  deconfig: DeconfigClient,
  integrationId: string,
) {
  return DocumentResourceV2.create(deconfig, integrationId);
}

const createDocumentTool = createToolGroup("Documents", {
  name: "Documents Management",
  description: "Manage your documents",
  icon: "https://assets.decocache.com/mcp/81d602bb-45e2-4361-b52a-23379520a34d/sandbox.png",
});

/**
 * Creates Views 2.0 implementation for document views with custom React renderer
 *
 * This function creates a complete Views 2.0 implementation that includes:
 * - Custom React-based detail view for rich document editing
 * - Resources 2.0 CRUD operations for documents
 * - Resource-centric URL patterns for better organization
 *
 * The detail view uses a react:// URL scheme to render a custom React component
 * in the frontend, providing a rich markdown editing experience.
 *
 * @returns Views 2.0 implementation for document views
 */
export function createDocumentViewsV2() {
  const integrationId = formatIntegrationId(WellKnownMcpGroups.Documents);

  const documentDetailRenderer = createViewRenderer({
    name: "document_detail",
    title: "Document Detail",
    description: "View and edit document content with a rich markdown editor",
    icon: "https://example.com/icons/document-detail.svg",
    inputSchema: DetailViewRenderInputSchema,
    tools: [
      "DECO_RESOURCE_DOCUMENT_READ",
      "DECO_RESOURCE_DOCUMENT_UPDATE",
      "DECO_RESOURCE_DOCUMENT_DELETE",
    ],
    prompt:
      "You are helping the user manage a document. You can read the document content, update its text and metadata, and delete it. Always confirm destructive actions before executing them.",
    rules: [
      "You are a document editing specialist. Use the document tools to edit the current document. Help the user manage content, tags, and metadata effectively.",
    ],
    handler: (input, _c) => {
      // Return a custom react:// URL that the frontend will handle
      // The frontend will render a custom React component for this view
      const url = `react://document_detail?integration=${integrationId}&resource=${encodeURIComponent(input.resource)}`;
      return Promise.resolve({ url });
    },
  });

  // Create Views 2.0 implementation
  const viewsV2Implementation = createViewImplementation({
    renderers: [documentDetailRenderer],
  });

  return viewsV2Implementation;
}

/**
 * Creates legacy document views implementation for backward compatibility
 *
 * This provides the legacy VIEW_BINDING_SCHEMA implementation that was used
 * before the Views 2.0 system. It creates document list and detail views
 * using the internal://resource URL pattern.
 *
 * @returns Legacy document views implementation using VIEW_BINDING_SCHEMA
 */
export const documentViews = impl(
  VIEW_BINDING_SCHEMA,
  [
    // DECO_CHAT_VIEWS_LIST
    {
      description: "List views exposed by this MCP",
      handler: (_, c) => {
        c.resourceAccess.grant();

        const org = c.locator?.org;
        const project = c.locator?.project;

        if (!org || !project) {
          return { views: [] };
        }

        return {
          views: [
            // Document List View
            {
              name: "DOCUMENTS_LIST",
              title: "Documents",
              description: "Manage and organize your documents",
              icon: "description",
              url: `internal://resource/list?name=document`,
              tools: WellKnownBindings.Resources.map(
                (resource) => resource.name,
              ),
              rules: [
                "You are a specialist for crud operations on resources. Use the resource tools to read, search, create, update, or delete items; do not fabricate data.",
              ],
            },
            // Document Detail View (for individual document management)
            {
              name: "DOCUMENT_DETAIL",
              title: "Document Detail",
              description: "View and edit individual document details",
              icon: "description",
              url: `internal://resource/detail?name=document`,
              mimeTypePattern: "application/json",
              resourceName: "document",
              tools: [
                "DECO_RESOURCE_DOCUMENT_READ",
                "DECO_RESOURCE_DOCUMENT_UPDATE",
                "DECO_RESOURCE_DOCUMENT_DELETE",
              ],
              rules: [
                "You are a document editing specialist. Use the document tools to edit the current document. Help the user manage content, tags, and metadata effectively.",
              ],
            },
          ],
        };
      },
    },
  ],
  createDocumentTool,
);
