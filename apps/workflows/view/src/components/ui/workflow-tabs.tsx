import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useState } from "react";

export interface Tab {
  id: string;
  label: string;
  icon?: string;
}

export interface WorkflowTabsProps {
  tabs: Tab[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export function WorkflowTabs({
  tabs,
  activeTab: controlledActiveTab,
  onTabChange,
  className,
}: WorkflowTabsProps) {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = useState(
    tabs[0]?.id || "",
  );

  const activeTab = controlledActiveTab ?? uncontrolledActiveTab;

  function handleTabClick(tabId: string) {
    if (!controlledActiveTab) {
      setUncontrolledActiveTab(tabId);
    }
    onTabChange?.(tabId);
  }

  return (
    <div className={cn("flex items-center bg-secondary", className)}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              "flex h-10 items-center justify-center gap-2.5 px-3 py-1.5",
              "bg-background border-r border-border",
              "text-sm font-normal leading-5 text-foreground",
              "transition-opacity hover:opacity-100",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive ? "opacity-100" : "opacity-50 border-b border-border",
            )}
          >
            {tab.icon && (
              <Icon
                name={tab.icon}
                size={20}
                className="shrink-0 text-muted-foreground"
              />
            )}
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
