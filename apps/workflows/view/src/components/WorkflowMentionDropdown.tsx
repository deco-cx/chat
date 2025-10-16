import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { SuggestionProps } from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";

interface ToolItem {
  id: string;
  type: "tool";
  label: string;
  description?: string;
  category?: string;
  integration?: { id: string; name: string; icon?: string };
}

interface StepItem {
  id: string;
  type: "step";
  label: string;
  description?: string;
  category?: string;
}

type MentionItem = ToolItem | StepItem;

interface WorkflowMentionDropdownProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  editor: unknown;
  isLoading?: boolean;
}

export default forwardRef<
  { onKeyDown: (props: SuggestionProps) => boolean },
  WorkflowMentionDropdownProps
>(function WorkflowMentionDropdown({ items, command, isLoading }, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command({
        id: item.id,
        label: item.label,
        type: item.type,
        integration:
          item.type === "tool" && "integration" in item
            ? item.integration
            : undefined,
      });
    }
  };

  const scrollSelectedIntoView = (index: number) => {
    const selectedElement = itemRefs.current[index];
    if (selectedElement && scrollAreaRef.current) {
      selectedElement.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  const upHandler = () => {
    const newIndex = (selectedIndex + items.length - 1) % items.length;
    setSelectedIndex(newIndex);
    scrollSelectedIntoView(newIndex);
  };

  const downHandler = () => {
    const newIndex = (selectedIndex + 1) % items.length;
    setSelectedIndex(newIndex);
    scrollSelectedIntoView(newIndex);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: (props: SuggestionProps) => {
      const event = (props as { event?: KeyboardEvent }).event;

      if (event?.key === "ArrowUp") {
        event.preventDefault();
        upHandler();
        return true;
      }

      if (event?.key === "ArrowDown") {
        event.preventDefault();
        downHandler();
        return true;
      }

      if (event?.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        enterHandler();
        return true;
      }

      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[300px] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="xs" />
            Loading...
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No results</div>
        )}
      </div>
    );
  }

  // Group items by category
  const groupedItems = items.reduce(
    (acc, item, index) => {
      const category =
        item.category || (item.type === "tool" ? "Tools" : "Steps");
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
      <ScrollArea
        className="h-[300px] w-full max-w-[400px]"
        ref={scrollAreaRef}
      >
        <div className="p-1 max-w-[400px]">
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <Spinner size="xs" />
              Loading...
            </div>
          )}

          {Object.entries(groupedItems).map(([category, categoryItems]) => (
            <div key={category} className="mb-2">
              <div className="px-2 py-1 flex items-center justify-between bg-muted/40 rounded-md mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon
                    name={
                      categoryItems[0].item.type === "tool"
                        ? "build"
                        : "deployed_code"
                    }
                    size={14}
                  />
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
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors",
                    "hover:bg-muted/50",
                    selectedIndex === index && "bg-muted",
                  )}
                  onClick={() => selectItem(index)}
                >
                  <div className="flex min-w-0 flex-1 max-w-[320px]">
                    <div className="flex items-center text-sm truncate">
                      <span className="font-medium">{item.label}</span>
                      {item.description ? (
                        <>
                          <span className="mx-1 text-muted-foreground">-</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-muted-foreground truncate inline-block align-baseline max-w-full">
                                {item.description}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{item.description}</TooltipContent>
                          </Tooltip>
                        </>
                      ) : null}
                    </div>
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
});
