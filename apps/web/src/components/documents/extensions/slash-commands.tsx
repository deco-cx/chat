import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Input } from "@deco/ui/components/input.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { Extension } from "@tiptap/core";
import { ReactRenderer } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import { type SuggestionKeyDownProps, type SuggestionOptions, type SuggestionProps } from "@tiptap/suggestion";
import Suggestion from "@tiptap/suggestion";
import { forwardRef, useImperativeHandle, useState } from "react";
import tippy, { type Instance, type Props } from "tippy.js";
import { MCPClient } from "@deco/sdk";

interface CommandItem {
  id: string;
  label: string;
  icon: string;
  description?: string;
  action: "format" | "ai";
  handle?: (editor: any, range: any) => void;
}

const COMMANDS: CommandItem[] = [
  {
    id: "heading-1",
    label: "Heading 1",
    icon: "format_h1",
    description: "Large section heading",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 1 })
        .run();
    },
  },
  {
    id: "heading-2",
    label: "Heading 2",
    icon: "format_h2",
    description: "Medium section heading",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 2 })
        .run();
    },
  },
  {
    id: "heading-3",
    label: "Heading 3",
    icon: "format_h3",
    description: "Small section heading",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHeading({ level: 3 })
        .run();
    },
  },
  {
    id: "bullet-list",
    label: "Bullet List",
    icon: "format_list_bulleted",
    description: "Create a simple bullet list",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleBulletList()
        .run();
    },
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    icon: "format_list_numbered",
    description: "Create a numbered list",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleOrderedList()
        .run();
    },
  },
  {
    id: "todo-list",
    label: "To-do List",
    icon: "check_box",
    description: "Track tasks with checkboxes",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .toggleTaskList()
        .run();
    },
  },
  {
    id: "blockquote",
    label: "Blockquote",
    icon: "format_quote",
    description: "Add a quote block",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setBlockquote()
        .run();
    },
  },
  {
    id: "code-block",
    label: "Code Block",
    icon: "code",
    description: "Insert a code block",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setCodeBlock()
        .run();
    },
  },
  {
    id: "divider",
    label: "Divider",
    icon: "horizontal_rule",
    description: "Add a horizontal line",
    action: "format",
    handle: (editor, range) => {
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .setHorizontalRule()
        .run();
    },
  },
  {
    id: "ask-ai",
    label: "Ask AI",
    icon: "auto_awesome",
    description: "Generate content with AI",
    action: "ai",
  },
];

interface SlashCommandDropdownProps {
  items: CommandItem[];
  command: (item: CommandItem) => void;
  editor: any;
  range: any;
}

const SlashCommandDropdown = forwardRef<
  { onKeyDown: (props: SuggestionKeyDownProps) => boolean },
  SlashCommandDropdownProps
>(({ items, command, editor, range }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAIInput, setShowAIInput] = useState(false);
  const [aiPrompt, setAIPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const selectItem = (index: number) => {
    const item = items[index];
    if (!item) return;

    if (item.action === "ai") {
      setShowAIInput(true);
    } else if (item.handle) {
      item.handle(editor, range);
      command(item);
    }
  };

  const handleAIGenerate = async () => {
    if (!aiPrompt.trim() || isGenerating) return;

    setIsGenerating(true);
    try {
      // Get selected text or context
      const { from, to } = range;
      const selectedText = editor.state.doc.textBetween(from, to, " ");

      // Call AI_GENERATE tool via workspace MCP client
      const locator = editor.storage.locator;
      if (!locator) throw new Error("No workspace locator available");

      const client = MCPClient.forLocator(locator);
      const result = await (client as any).AI_GENERATE({
        messages: [
          {
            role: "user",
            content: selectedText
              ? `Context: ${selectedText}\n\nTask: ${aiPrompt}`
              : aiPrompt,
          },
        ],
      });

      // Insert generated content
      if (result?.text) {
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(result.text)
          .run();
      }

      // Reset state
      setShowAIInput(false);
      setAIPrompt("");
      command(items.find((i) => i.id === "ask-ai")!);
    } catch (error) {
      console.error("Failed to generate AI content:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: SuggestionKeyDownProps) => {
      if (showAIInput) {
        if (event.key === "Escape") {
          setShowAIInput(false);
          setAIPrompt("");
          return true;
        }
        if (event.key === "Enter") {
          event.preventDefault();
          handleAIGenerate();
          return true;
        }
        return false;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
        return true;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % items.length);
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

  if (showAIInput) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3 min-w-[300px]">
        <div className="flex items-center gap-2 mb-2">
          <Icon name="auto_awesome" size={16} className="text-primary" />
          <span className="text-sm font-medium">Ask AI</span>
        </div>
        <div className="flex gap-2">
          <Input
            value={aiPrompt}
            onChange={(e) => setAIPrompt(e.target.value)}
            placeholder="Describe what you want to create..."
            className="flex-1"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAIGenerate();
              } else if (e.key === "Escape") {
                setShowAIInput(false);
                setAIPrompt("");
              }
            }}
          />
          <Button
            size="sm"
            onClick={handleAIGenerate}
            disabled={!aiPrompt.trim() || isGenerating}
          >
            {isGenerating ? <Spinner size="xs" /> : <Icon name="send" size={16} />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-1 min-w-[280px] max-w-[320px]">
      <div className="text-xs text-muted-foreground font-medium px-2 py-1.5">
        Commands
      </div>
      <div className="flex flex-col gap-0.5">
        {items.map((item, index) => (
          <Button
            key={item.id}
            variant="ghost"
            size="sm"
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              "w-full justify-start gap-2 text-left px-2 py-1.5 h-auto",
              selectedIndex === index && "bg-accent",
            )}
          >
            <Icon name={item.icon} size={16} filled={selectedIndex === index} />
            <div className="flex flex-col items-start flex-1 min-w-0">
              <span className="text-sm font-medium">{item.label}</span>
              {item.description && (
                <span className="text-xs text-muted-foreground truncate w-full">
                  {item.description}
                </span>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
});

export const SlashCommands = Extension.create({
  name: "slashCommands",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        command: ({ editor, range, props }: any) => {
          props.handle?.(editor, range);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor!,
        pluginKey: new PluginKey('slashCommands'),
        ...this.options.suggestion,
        items: ({ query }: { query: string }) => {
          return COMMANDS.filter((item) =>
            item.label.toLowerCase().includes(query.toLowerCase()),
          );
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: Instance<Props>[] | null = null;

          return {
            onStart: (props: SuggestionProps) => {
              if (component) {
                component.destroy();
              }

              component = new ReactRenderer(SlashCommandDropdown, {
                props: { ...props, editor: props.editor, range: props.range },
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy("body", {
                getReferenceClientRect: props.clientRect as any,
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
              component?.updateProps({
                ...props,
                editor: props.editor,
                range: props.range,
              });

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as any,
              });
            },

            onKeyDown(props: SuggestionKeyDownProps) {
              if (props.event.key === "Escape") {
                popup?.[0]?.hide();
                return true;
              }

              return (component?.ref as any)?.onKeyDown?.(props) || false;
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

