/**
 * Central export point for all workflows organized by domain.
 *
 * This file aggregates all workflows from different domains into a single
 * export, making it easy to import all workflows in main.ts while keeping
 * the domain separation.
 *
 * When you add new workflow domains, create a new file (e.g., todos.ts, user.ts)
 * and import/export them here.
 */

// Import workflow arrays from domain files
// import { todoWorkflows } from "./todos.ts";
// import { userWorkflows } from "./user.ts";

// Export all workflows from all domains
export const workflows = [
  // ...todoWorkflows,
  // ...userWorkflows,
];

// Re-export domain-specific workflows for direct access if needed
// export { todoWorkflows } from "./todos.ts";
// export { userWorkflows } from "./user.ts";
