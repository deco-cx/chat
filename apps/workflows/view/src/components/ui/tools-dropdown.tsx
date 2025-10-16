import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { useToolItems, type MentionItem } from "../../hooks/useMentionItems";

interface ToolsDropdownProps {
  onToolClick?: (tool: MentionItem) => void;
}

export function ToolsDropdown({ onToolClick }: ToolsDropdownProps) {
  // IMPORTANT: All hooks must be called before any conditional returns
  const toolItems = useToolItems();
  const [searchTerm, setSearchTerm] = useState("");
  const deferredSearchTerm = useDeferredValue(searchTerm);

  const handleToolClick = useCallback(
    (item: MentionItem) => {
      onToolClick?.(item);
    },
    [onToolClick],
  );

  // Filter tools based on search term
  const filteredTools = useMemo(() => {
    if (!deferredSearchTerm.trim()) {
      return toolItems;
    }

    const searchLower = deferredSearchTerm.toLowerCase();
    return toolItems.filter((item) => {
      const matchesLabel = item.label.toLowerCase().includes(searchLower);
      const matchesDescription = item.description
        ?.toLowerCase()
        .includes(searchLower);
      const matchesCategory = item.category
        ?.toLowerCase()
        .includes(searchLower);
      return matchesLabel || matchesDescription || matchesCategory;
    });
  }, [toolItems, deferredSearchTerm]);

  // Group items by category (integration name)
  const groupedItems = useMemo(() => {
    return filteredTools.reduce(
      (acc, item, index) => {
        const category = item.category || "Other Tools";
        if (!acc[category]) {
          acc[category] = [];
        }
        acc[category].push({ item, index });
        return acc;
      },
      {} as Record<string, Array<{ item: MentionItem; index: number }>>,
    );
  }, [filteredTools]);

  const totalFilteredCount = filteredTools.length;
  const hasResults = totalFilteredCount > 0;

  // Conditional rendering AFTER all hooks
  if (toolItems.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[300px] overflow-hidden">
        <div className="text-sm text-muted-foreground">No tools available</div>
      </div>
    );
  }

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-foreground">
            Available Tools
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-background text-muted-foreground">
            {totalFilteredCount} {totalFilteredCount === 1 ? "tool" : "tools"}
          </span>
        </div>
        <div className="relative">
          <Icon
            name="search"
            size={14}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-8 pl-7 pr-8 text-xs"
            autoFocus
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>
      </div>

      <ScrollArea className="h-[400px] w-full max-w-[400px]">
        <div className="p-1 max-w-[400px]">
          {!hasResults ? (
            <div className="px-3 py-8 text-center">
              <Icon
                name="search"
                size={24}
                className="mx-auto mb-2 text-muted-foreground"
              />
              <p className="text-sm text-muted-foreground">
                No tools found matching "{searchTerm}"
              </p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([category, categoryItems]) => (
              <div key={category} className="mb-2">
                <div className="px-2 py-1 flex items-center justify-between bg-muted/40 rounded-md mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="build" size={14} />
                    <span className="text-xs font-semibold truncate">
                      {category}
                    </span>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                    {categoryItems.length}
                  </span>
                </div>

                {categoryItems.map(({ item, index }) => (
                  <button
                    type="button"
                    key={`${category}-${index}`}
                    className={cn(
                      "flex items-start gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors",
                      "hover:bg-muted/50",
                    )}
                    onClick={() => handleToolClick(item)}
                  >
                    <div className="flex min-w-0 flex-1 flex-col max-w-[320px]">
                      <div className="flex items-center text-sm truncate">
                        <span className="font-medium">{item.label}</span>
                      </div>
                      {item.description && (
                        <span className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {item.description}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
