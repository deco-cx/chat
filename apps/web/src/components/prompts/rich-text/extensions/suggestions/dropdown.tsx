import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Editor, type Range } from "@tiptap/react";
import { type Ref, useImperativeHandle, useMemo, useState } from "react";

interface Option {
  id: string;
  label: string;
  icon?: string;
  handle?: () => void;
  tooltip?: string | React.ReactNode;
}

export interface Category {
  icon?: string;
  name: string;
  options: Option[];
}

interface Props {
  items: Category[];
  editor: Editor;
  range: Range;
  ref: Ref<unknown>;
  query: string;
}

function FormattingTooltip(
  { children, label }: { children: React.ReactNode; label: string },
) {
  return (
    <div className="flex flex-col gap-2 min-w-40">
      <p className="text-sm font-medium">{label}</p>
      <div className="prose bg-white p-2 rounded-md text-black">
        {children}
      </div>
    </div>
  );
}

export default function MentionDropdown({
  items: _categories,
  editor,
  range,
  ref,
  query,
}: Props) {
  const [selectedIndex, setSelected] = useState<number | null>(null);

  const categories: Category[] = useMemo(() => [
    ..._categories,
    {
      name: "Formatting",
      icon: "style",
      options: [
        {
          icon: "chat",
          id: "comment",
          label: "Comment",
          handle: () => {
            const { from, to } = range;

            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .setComment()
              .run();
          },
          tooltip: (
            <FormattingTooltip label="Comment">
              <span data-type="comment">Comment</span>
            </FormattingTooltip>
          ),
        },
        {
          icon: "format_h1",
          id: "heading-1",
          label: "Heading 1",
          handle: () => {
            const { from, to } = range;

            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .setHeading({ level: 1 })
              .run();
          },
          tooltip: (
            <FormattingTooltip label="Heading 1">
              <h1>Heading 1</h1>
            </FormattingTooltip>
          ),
        },
        {
          icon: "format_h2",
          id: "heading-2",
          label: "Heading 2",
          handle: () => {
            const { from, to } = range;

            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .setHeading({ level: 2 })
              .run();
          },
          tooltip: (
            <FormattingTooltip label="Heading 2">
              <h2>Heading 2</h2>
            </FormattingTooltip>
          ),
        },
        {
          icon: "format_h3",
          id: "heading-3",
          label: "Heading 3",
          handle: () => {
            const { from, to } = range;

            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .setHeading({ level: 3 })
              .run();
          },
          tooltip: (
            <FormattingTooltip label="Heading 3">
              <h3>Heading 3</h3>
            </FormattingTooltip>
          ),
        },
        {
          icon: "format_list_bulleted",
          id: "bulled-list",
          label: "Bulleted List",
          handle: () => {
            const { from, to } = range;

            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .toggleBulletList()
              .run();
          },
          tooltip: (
            <FormattingTooltip label="Bulleted List">
              <ul>
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
              </ul>
            </FormattingTooltip>
          ),
        },
        {
          icon: "format_list_numbered",
          id: "numbered-list",
          label: "Numbered List",
          handle: () => {
            const { from, to } = range;

            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .toggleOrderedList()
              .run();
          },
          tooltip: (
            <FormattingTooltip label="Numbered List">
              <ol>
                <li>Item 1</li>
                <li>Item 2</li>
                <li>Item 3</li>
              </ol>
            </FormattingTooltip>
          ),
        },
        {
          icon: "horizontal_rule",
          id: "divider",
          label: "Divider",
          handle: () => {
            const { from, to } = range;

            editor
              .chain()
              .focus()
              .deleteRange({ from, to })
              .insertContent("---")
              .run();
          },
          tooltip: (
            <FormattingTooltip label="Divider">
              <p>content</p>
              <hr />
              <p>content</p>
            </FormattingTooltip>
          ),
        },
      ],
    },
  ], [query]);

  const items = useMemo(() => {
    return [
      ...categories.flatMap((category) =>
        category.options.map((item) => ({
          ...item,
          category: category.name,
        }))
      ),
    ];
  }, [categories]);

  const isSelected = (item: Option) => {
    return selectedIndex !== null && items[selectedIndex].id === item.id;
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        setSelected((prev) =>
          prev === null ? 0 : (prev - 1 + items.length) % items.length
        );
        return true;
      }

      if (event.key === "ArrowDown") {
        setSelected((prev) => (prev === null ? 0 : (prev + 1) % items.length));
        return true;
      }

      if (event.key === "Enter" && selectedIndex !== null) {
        items[selectedIndex]?.handle?.();
        return true;
      }

      return false;
    },
  }));

  const handleMouseEnter = (item: Option) => {
    const index = items.findIndex((i) => i.id === item.id);
    setSelected(index);
  };

  const handleMouseLeave = () => {
    setSelected(null);
  };

  return (
    <div className="rounded-xl flex flex-col gap-3 bg-white shadow-md border text-sm font-medium min-w-56 max-w-64 p-2">
      {categories.map((category) => (
        <div key={category.name} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Icon name={category.icon ?? "library_books"} size={12} />
            {category.name}
          </span>
          {category.options?.length
            ? category.options.map((item) => (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    key={item.id}
                    onClick={() => item.handle?.()}
                    variant="ghost"
                    size="sm"
                    onMouseEnter={() =>
                      handleMouseEnter(item)}
                    onMouseLeave={handleMouseLeave}
                    className={cn(
                      "w-full line-clamp-1 text-left flex gap-2 justify-start rounded-md border border-transparent",
                      "hover:bg-primary-light/20 hover:border hover:border-primary-light",
                      isSelected(item) &&
                        "bg-primary-light/20 border border-primary-light",
                    )}
                  >
                    {item.icon && (
                      <span className="flex justify-between items-center rounded p-1 border">
                        <Icon name={item.icon} size={16} />
                      </span>
                    )}
                    <span>{item.label}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent align="start" side="right" sideOffset={10}>
                  {typeof item.tooltip === "string"
                    ? (
                      <div className="max-w-64 line-clamp-6">
                        {item.tooltip}
                      </div>
                    )
                    : item.tooltip}
                </TooltipContent>
              </Tooltip>
            ))
            : (
              <span className="text-xs my-2 text-muted-foreground flex items-center justify-center gap-1">
                <Icon name="quick_reference_all" size={14} />No results found
              </span>
            )}
        </div>
      ))}
    </div>
  );
}
