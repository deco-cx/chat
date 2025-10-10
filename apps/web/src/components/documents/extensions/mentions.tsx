import { Badge } from "@deco/ui/components/badge.tsx";
import { ScrollArea, ScrollBar } from "@deco/ui/components/scroll-area.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import Mention from "@tiptap/extension-mention";
import {
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactRenderer,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from "@tiptap/suggestion";
import Suggestion from "@tiptap/suggestion";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import tippy, { type Instance, type Props } from "tippy.js";
import { IntegrationAvatar } from "../../common/avatar/integration.tsx";
import type { Editor } from "@tiptap/react";

export interface Tool {
  id: string;
  name: string;
  description?: string;
  integration: {
    id: string;
    name: string;
    icon?: string;
  };
}

export interface DocumentItem {
  id: string;
  name: string;
  uri: string;
  description?: string;
}

export type MentionItem =
  | { type: "tool"; tool: Tool }
  | { type: "document"; document: DocumentItem };

interface MentionDropdownProps {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  editor: Editor;
  isLoading?: boolean;
}

const MentionDropdown = forwardRef<
  { onKeyDown: (props: SuggestionKeyDownProps) => boolean },
  MentionDropdownProps
>(({ items, command, isLoading }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) {
      command(item);
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

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const newIndex = (selectedIndex - 1 + items.length) % items.length;
        setSelectedIndex(newIndex);
        scrollSelectedIntoView(newIndex);
        return true;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        const newIndex = (selectedIndex + 1) % items.length;
        setSelectedIndex(newIndex);
        scrollSelectedIntoView(newIndex);
        return true;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        selectItem(selectedIndex);
        return true;
      }

      return false;
    },
  }));

  useEffect(() => {
    setSelectedIndex(0);
    itemRefs.current = itemRefs.current.slice(0, items.length);
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[300px]">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner size="xs" />
            Searching...
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No results</div>
        )}
      </div>
    );
  }

  // Group items by type
  const toolItems = items.filter((item) => item.type === "tool") as Extract<
    MentionItem,
    { type: "tool" }
  >[];
  const documentItems = items.filter(
    (item) => item.type === "document",
  ) as Extract<MentionItem, { type: "document" }>[];

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg min-w-[300px] max-w-[400px] overflow-hidden">
      <ScrollArea className="max-h-[300px] w-full" ref={scrollAreaRef}>
        <div className="p-1">
          {isLoading && (
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
              <Spinner size="xs" />
              Searching...
            </div>
          )}

          {toolItems.length > 0 && (
            <div className="mb-2">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                Tools
              </div>
              {toolItems.map((item) => {
                const globalIndex = items.indexOf(item);
                return (
                  <button
                    key={item.tool.id}
                    ref={(el) => {
                      itemRefs.current[globalIndex] = el;
                    }}
                    type="button"
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-md text-left transition-colors",
                      "hover:bg-muted/50",
                      selectedIndex === globalIndex && "bg-muted",
                    )}
                    onClick={() => selectItem(globalIndex)}
                  >
                    <IntegrationAvatar
                      url={item.tool.integration.icon}
                      fallback={item.tool.integration.name}
                      size="xs"
                      className="w-4 h-4"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {item.tool.name}
                      </div>
                      {item.tool.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.tool.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {documentItems.length > 0 && (
            <div>
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                Documents
              </div>
              {documentItems.map((item) => {
                const globalIndex = items.indexOf(item);
                return (
                  <button
                    key={item.document.id}
                    ref={(el) => {
                      itemRefs.current[globalIndex] = el;
                    }}
                    type="button"
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 rounded-md text-left transition-colors",
                      "hover:bg-muted/50",
                      selectedIndex === globalIndex && "bg-muted",
                    )}
                    onClick={() => selectItem(globalIndex)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">
                        {item.document.name}
                      </div>
                      {item.document.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.document.description}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
});

// Mention node renderer
function MentionNode({ node }: ReactNodeViewProps<HTMLSpanElement>) {
  const mentionType = node.attrs.mentionType;
  const label = node.attrs.label;
  const icon = node.attrs.icon;

  return (
    <NodeViewWrapper as="span" data-id={node.attrs.id} data-type="mention">
      <Badge
        variant="secondary"
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium",
          "bg-accent text-accent-foreground border-border hover:bg-accent/80",
        )}
      >
        {icon && mentionType === "tool" && (
          <IntegrationAvatar
            url={icon}
            fallback={label}
            size="xs"
            className="w-3 h-3"
          />
        )}
        <span className="leading-none">@{label}</span>
      </Badge>
    </NodeViewWrapper>
  );
}

export function createCombinedMentions(tools: Tool[] = []) {
  return Mention.extend({
    name: "combinedMention",

    addNodeView() {
      return ReactNodeViewRenderer(MentionNode);
    },

    addAttributes() {
      return {
        id: { default: "" },
        label: { default: "" },
        mentionType: { default: "tool" }, // 'tool' | 'document'
        icon: { default: null },
      };
    },

    parseHTML() {
      return [
        {
          tag: 'span[data-type="mention"]',
          getAttrs: (node) => {
            if (!(node instanceof HTMLElement)) return false;
            return {
              id: node.getAttribute("data-id"),
              label: node.textContent?.replace("@", ""),
              mentionType: node.getAttribute("data-mention-type") || "tool",
            };
          },
        },
      ];
    },

    renderHTML({ node }) {
      return [
        "span",
        {
          "data-type": "mention",
          "data-id": node.attrs.id,
          "data-mention-type": node.attrs.mentionType,
        },
        `@${node.attrs.label}`,
      ];
    },

    addProseMirrorPlugins() {
      return [
        Suggestion<MentionItem>({
          editor: this.editor!,
          pluginKey: new PluginKey("combinedMentions"),
          char: "@",
          items: ({ query }: { query: string }) => {
            const items: MentionItem[] = [];
            const ql = query?.toLowerCase() || "";

            // Filter tools synchronously
            for (const tool of tools) {
              if (
                !query ||
                tool.name.toLowerCase().includes(ql) ||
                tool.description?.toLowerCase().includes(ql) ||
                tool.integration.name.toLowerCase().includes(ql)
              ) {
                items.push({
                  type: "tool",
                  tool,
                });
              }
            }

            return items.slice(0, 20);
          },
          command: ({
            editor,
            range,
            props,
          }: {
            editor: Editor;
            range: { from: number; to: number };
            props: MentionItem;
          }) => {
            const item = props;
            const attrs =
              item.type === "tool"
                ? {
                    id: item.tool.id,
                    label: item.tool.name,
                    mentionType: "tool",
                    icon: item.tool.integration.icon,
                  }
                : {
                    id: item.document.id,
                    label: item.document.name,
                    mentionType: "document",
                    icon: null,
                  };

            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: "combinedMention",
                  attrs,
                },
                {
                  type: "text",
                  text: " ",
                },
              ])
              .run();
          },
          render: () => {
            let component: ReactRenderer | null = null;
            let popup: Instance<Props>[] | null = null;

            return {
              onStart: (props: SuggestionProps) => {
                if (component) {
                  component.destroy();
                }

                component = new ReactRenderer(MentionDropdown, {
                  props: { ...props, isLoading: false },
                  editor: props.editor,
                });

                if (!props.clientRect) return;

                popup = tippy("body", {
                  getReferenceClientRect: props.clientRect as
                    | (() => DOMRect)
                    | null,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: "manual",
                  placement: "bottom-start",
                  maxWidth: "none",
                });
              },

              onUpdate(props: SuggestionProps) {
                component?.updateProps({ ...props, isLoading: false });

                popup?.[0]?.setProps({
                  getReferenceClientRect: props.clientRect as
                    | (() => DOMRect)
                    | null,
                });
              },

              onKeyDown(props: SuggestionKeyDownProps) {
                if (props.event.key === "Escape") {
                  popup?.[0]?.hide();
                  return true;
                }

                return (
                  (
                    component?.ref as {
                      onKeyDown?: (props: SuggestionKeyDownProps) => boolean;
                    }
                  )?.onKeyDown?.(props) || false
                );
              },

              onExit() {
                popup?.[0]?.destroy();
                component?.destroy();
                popup = null;
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}
