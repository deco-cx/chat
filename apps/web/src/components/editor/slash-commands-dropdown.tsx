import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { Editor, Range } from "@tiptap/react";
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type Ref,
} from "react";

export interface SlashCommandOption {
  id: string;
  type: "category" | "option";
  label: string;
  icon?: string;
  tooltip?: string;
  handle?: (props: {
    editor: Editor;
    command: (props: Record<string, unknown>) => void;
    range: Range;
  }) => void;
  children?: SlashCommandOption[];
}

interface Props {
  items: SlashCommandOption[];
  editor: Editor;
  command: (props: Record<string, unknown>) => void;
  range: Range;
  ref: Ref<unknown>;
  query: string;
}

export default function SlashCommandsDropdown({
  items: defaultOptions,
  editor,
  range,
  ref,
  query,
  command,
}: Props) {
  const [selectedIndex, setSelected] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Reset selection when query changes
  useEffect(() => {
    setSelected(0);
  }, [query]);

  const currentCategory: SlashCommandOption[] = useMemo(() => {
    if (selectedCategory) {
      const category = defaultOptions
        .flatMap((category) => category.children ?? [])
        .find((option) => option.id === selectedCategory);

      if (category) {
        return [category];
      }
    }

    return defaultOptions;
  }, [selectedCategory, defaultOptions]);

  const items = useMemo(() => {
    const allItems = currentCategory.flatMap(
      (category) => category.children ?? [],
    );

    if (!query) {
      return allItems;
    }

    const lowerQuery = query.toLowerCase();
    return allItems.filter((item) =>
      item.label.toLowerCase().includes(lowerQuery),
    );
  }, [currentCategory, query]);

  const isSelected = (item: SlashCommandOption) => {
    return selectedIndex !== null && items[selectedIndex]?.id === item.id;
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelected((prev) =>
          prev === null ? 0 : (prev - 1 + items.length) % items.length,
        );
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelected((prev) => (prev === null ? 0 : (prev + 1) % items.length));
        return true;
      }

      if (event.key === "Enter" && selectedIndex !== null) {
        handleOptionClick(items[selectedIndex]);
        return true;
      }

      if (event.key === "ArrowLeft" && selectedCategory) {
        setSelectedCategory(null);
        setSelected(null);
        return true;
      }

      return false;
    },
  }));

  const handleMouseEnter = (item: SlashCommandOption) => {
    const index = items.findIndex((i) => i.id === item.id);
    setSelected(index);
  };

  const handleMouseLeave = () => {
    // Keep selection on mouse leave for better UX
  };

  const handleOptionClick = (item: SlashCommandOption) => {
    if (item.type === "option") {
      item.handle?.({ editor, command, range });
    }

    if (item.type === "category") {
      setSelectedCategory(item.id);
    }
  };

  return (
    <div className="bg-background rounded-lg flex flex-col gap-0.5 border text-sm w-60 pt-1 pb-1 shadow-[0px_0px_0px_1px_rgba(84,72,49,0.08),0px_2px_4px_-1px_rgba(0,0,0,0.06),0px_14px_28px_-6px_rgba(0,0,0,0.1)]">
      {currentCategory.map((category) => (
        <div key={category.id} className="flex flex-col">
          <div className="px-2 py-2">
            <p className="text-xs text-muted-foreground uppercase font-['CommitMono',_monospace] leading-4">
              {category.label}
            </p>
          </div>
          {items.length > 0 ? (
            items.map((item) => {
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => handleOptionClick(item)}
                  onMouseEnter={() => handleMouseEnter(item)}
                  onMouseLeave={handleMouseLeave}
                  className={cn(
                    "flex items-center gap-2 h-8 px-2 rounded-lg mx-2 transition-colors",
                    "hover:bg-accent text-left",
                    isSelected(item) && "bg-accent",
                  )}
                >
                  {item.icon && (
                    <Icon name={item.icon} size={16} className="shrink-0" />
                  )}
                  <span className="text-sm leading-5 font-normal overflow-hidden text-ellipsis whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="px-2 py-4 text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Icon name="quick_reference_all" size={14} />
              No results found
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
