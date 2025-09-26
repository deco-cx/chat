/**
 * Views 2.0 Module
 *
 * This module provides Views 2.0 implementation for standardized view management
 * using Resources 2.0 compliance and the existing binding system.
 *
 * Key Features:
 * - Views are Resources 2.0 resources with full CRUD operations
 * - Type-safe view renderer creation and management
 * - Integration with existing binding system and web components
 * - Resource-centric URL patterns for better organization
 * - Backward compatibility with existing view system
 *
 * Usage:
 *
 * import { createViewRenderer, createViewImplementation } from "./views-v2";
 *
 * const renderer = createViewRenderer({ name: "detail", handler: async () => ({ url: "..." }) });
 * const implementation = createViewImplementation({ integrationId: "test", viewData: { title: "Test" }, searchHandler: async () => ({}), readHandler: async () => ({}), renderers: [renderer] });
 */

// Export schemas
export * from "./schemas.ts";

// Export helper functions
export * from "./helpers.ts";

// Export bindings
export * from "./bindings.ts";
