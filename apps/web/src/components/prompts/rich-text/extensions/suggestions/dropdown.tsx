import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@deco/ui/components/tooltip.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import type { Editor, Range } from "@tiptap/react";
import { type Ref, useImperativeHandle, useMemo, useState } from "react";
import Markdown from "react-markdown";
import { mentionToTag } from "../../common.ts";

export interface Option {
  id: string;
  type: "category" | "option";
  label: string;
  icon?: string;
  // deno-lint-ignore no-explicit-any
  handle?: (props: { editor: Editor; command: (props: any) => void }) => void;
  tooltip?: string | React.ReactNode;
  children?: Option[];
}

interface Props {
  items: Option[];
  editor: Editor;
  // deno-lint-ignore no-explicit-any
  command: (props: any) => void;
  range: Range;
  ref: Ref<unknown>;
  query: string;
}

function FormattingTooltip({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2 min-w-40">
      <p className="text-sm font-medium">{label}</p>
      <div className="prose bg-popover p-2 rounded-md text-foreground">
        {children}
      </div>
    </div>
  );
}

export default function MentionDropdown({
  items: defaultOptions,
  editor,
  range,
  ref,
  query,
  command,
}: Props) {
  const [selectedIndex, setSelected] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const currentCategory: Option[] = useMemo(() => {
    if (selectedCategory) {
      const category = defaultOptions
        .flatMap((category) => category.children ?? [])
        .find((option) => option.id === selectedCategory);

      if (category) {
        return [category];
      }
    }

    if (query) {
      return defaultOptions.flatMap(
        (category) => category.children?.map((option) => option) ?? [],
      );
    }

    return [
      ...defaultOptions,
      {
        id: "Formatting",
        type: "category",
        label: "Formatting",
        children: [
          {
            icon: "chat",
            id: "comment",
            type: "option",
            label: "Comment",
            handle: ({ editor }) => {
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
            type: "option",
            label: "Heading 1",
            handle: ({ editor }) => {
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
            type: "option",
            label: "Heading 2",
            handle: ({ editor }) => {
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
            type: "option",
            label: "Heading 3",
            handle: ({ editor }) => {
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
            type: "option",
            label: "Bulleted List",
            handle: ({ editor }) => {
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
            type: "option",
            label: "Numbered List",
            handle: ({ editor }) => {
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
            type: "option",
            label: "Divider",
            handle: ({ editor }) => {
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
    ];
  }, [query, selectedCategory]);

  const items = useMemo(() => {
    return currentCategory.flatMap((category) => category.children ?? []);
  }, [currentCategory]);

  const isSelected = (item: Option) => {
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

  const handleMouseEnter = (item: Option) => {
    const index = items.findIndex((i) => i.id === item.id);
    setSelected(index);
  };

  const handleMouseLeave = () => {
    // setSelected(null);
  };

  const handleOptionClick = (item: Option) => {
    if (item.type === "option") {
      item.handle?.({ editor, command });
    }

    if (item.type === "category") {
      setSelectedCategory(item.id);
    }
  };

  return (
    <div className="rounded-xl flex flex-col gap-3 bg-popover border text-sm w-50 p-1 shadow-xl">
      {currentCategory.map((category) => (
        <div key={category.id} className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium px-2 py-1.5">
            {category.label}
          </span>
          {category.children?.length ? (
            category.children.map((item) => {
              return (
                <Tooltip open={isSelected(item)}>
                  <TooltipTrigger asChild>
                    <Button
                      key={item.id}
                      onClick={() => handleOptionClick(item)}
                      variant="ghost"
                      size="sm"
                      onMouseEnter={() => handleMouseEnter(item)}
                      onMouseLeave={handleMouseLeave}
                      className={cn(
                        "w-full line-clamp-1 text-left justify-start flex gap-2 rounded-lg px-2 py-1.5 hover:bg-accent",
                        isSelected(item) && "bg-accent",
                      )}
                    >
                      {item.icon && (
                        <Icon
                          name={item.icon}
                          filled={isSelected(item)}
                          size={16}
                        />
                      )}
                      <span className="line-clamp-1">{item.label}</span>
                    </Button>
                  </TooltipTrigger>
                  {item.tooltip && (
                    <TooltipContent
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      className="max-w-sm bg-secondary text-secondary-foreground shadow-xl rounded-xl p-2 border [&>span>svg]:!bg-secondary [&>span>svg]:!fill-secondary"
                      align="start"
                      side="right"
                    >
                      {typeof item.tooltip === "string" ? (
                        <>
                          <div className="flex items-center justify-between gap-2 text-muted-foreground">
                            <p className="font-medium text-xs px-3 italic mt-4 mb-2">
                              Full prompt
                            </p>
                          </div>
                          <div className="px-2.5 py-1.5 prose italic text-sm max-h-96 overflow-y-auto">
                            <Markdown>{mentionToTag(item.tooltip)}</Markdown>
                          </div>
                        </>
                      ) : (
                        item.tooltip
                      )}
                    </TooltipContent>
                  )}
                </Tooltip>
              );
            })
          ) : (
            <span className="text-xs my-2 text-muted-foreground flex items-center justify-center gap-1">
              <Icon name="quick_reference_all" size={14} />
              No results found
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
