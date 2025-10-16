/**
 * WorkflowLayout - Clean workflow builder with floating toolbar
 */

import { useRef } from "react";
import { WorkflowTabs } from "./ui/workflow-tabs";
import { WorkflowToolbar } from "./ui/workflow-toolbar";
import { WorkflowCanvas, type WorkflowCanvasRef } from "./canvas";
import { useActiveTab } from "@/store/tab";

export function WorkflowLayout() {
  const activeTab = useActiveTab();
  const canvasRef = useRef<WorkflowCanvasRef>(null);

  if (!canvasRef) {
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Tabs at top */}
      <WorkflowTabs />

      {/* Main Content Area */}
      <div className="flex-1 relative">
        {activeTab === "editor" && (
          <div className="absolute inset-0">
            <WorkflowCanvas ref={canvasRef} />
          </div>
        )}
      </div>

      {/* Floating Toolbar at bottom */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <WorkflowToolbar
          canvasRef={canvasRef as React.RefObject<WorkflowCanvasRef>}
        />
      </div>
    </div>
  );
}
