import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import type { MentionItem } from "../../hooks/useMentionItems";

interface ToolsDropdownProps {
  items: MentionItem[];
  isLoading?: boolean;
  onItemClick?: (item: MentionItem) => void;
}

export function ToolsDropdown({
  items,
  isLoading,
  onItemClick,
}: ToolsDropdownProps) {
  // Filter only tool items
  const toolItems = items.filter((item) => item.type === "tool");

  if (toolItems.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[300px] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="xs" />
            Loading tools...
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            No tools available
          </div>
        )}
      </div>
    );
  }

  // Group items by category (integration name)
  const groupedItems = toolItems.reduce(
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

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs font-semibold text-foreground">
          Available Tools
        </span>
      </div>

      <ScrollArea className="h-[400px] w-full max-w-[400px]">
        <div className="p-1 max-w-[400px]">
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <Spinner size="xs" />
              Loading tools...
            </div>
          )}

          {Object.entries(groupedItems).map(([category, categoryItems]) => (
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

              {categoryItems.map(({ item }) => (
                <button
                  type="button"
                  key={item.id}
                  className={cn(
                    "flex items-start gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors",
                    "hover:bg-muted/50",
                  )}
                  onClick={() => onItemClick?.(item)}
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
          ))}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
