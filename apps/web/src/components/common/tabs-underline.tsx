import { cn } from "@deco/ui/lib/utils.ts";

export interface TabItem {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
}

interface TabsUnderlineProps {
  tabs: TabItem[];
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
  className?: string;
}

export function TabsUnderline({
  tabs,
  activeTab,
  onTabChange,
  className,
}: TabsUnderlineProps) {
  function handleTabClick(tab: TabItem) {
    if (tab.onClick) {
      tab.onClick();
    }
    if (onTabChange) {
      onTabChange(tab.id);
    }
  }

  return (
    <div className={cn("flex h-[52px] items-center", className)}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab)}
            className={cn(
              "flex items-center h-full px-3 relative text-sm whitespace-nowrap border-b-2 mb-[-1px]",
              isActive
                ? "text-foreground border-foreground"
                : "text-muted-foreground opacity-75 hover:opacity-100 transition-opacity border-transparent",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
