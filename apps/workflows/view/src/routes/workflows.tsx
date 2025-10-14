/**
 * WORKFLOWS - Main Workflow Builder Page
 * 
 * Layout: Golden layout with resizable panels
 * - Left: Tool catalog
 * - Center: Step editor with tabs
 * - Right: Execution monitor (toggle)
 */

import { createRoute } from "@tanstack/react-router";
import { rootRoute } from "../main";
import { WorkflowLayout } from "@/components/WorkflowLayout";
import { WorkflowProvider } from "@/store/workflow";

export default createRoute({
  path: "/workflow",
  component: () => (
    <WorkflowProvider>
      <WorkflowLayout />
    </WorkflowProvider>
  ),
  getParentRoute: () => rootRoute,
});