import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { BubbleMenu as TiptapBubbleMenu, type Editor } from "@tiptap/react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@deco/ui/components/popover.tsx";
import { useState } from "react";

interface BubbleMenuProps {
  editor: Editor | null;
}

const FORMATTING_OPTIONS = [
  {
    id: "paragraph",
    label: "Paragraph",
    icon: "format_paragraph",
    action: (editor: Editor) => editor.chain().focus().setParagraph().run(),
    isActive: (editor: Editor) => editor.isActive("paragraph"),
  },
  {
    id: "heading-1",
    label: "Heading 1",
    icon: "format_h1",
    action: (editor: Editor) =>
      editor.chain().focus().setHeading({ level: 1 }).run(),
    isActive: (editor: Editor) => editor.isActive("heading", { level: 1 }),
  },
  {
    id: "heading-2",
    label: "Heading 2",
    icon: "format_h2",
    action: (editor: Editor) =>
      editor.chain().focus().setHeading({ level: 2 }).run(),
    isActive: (editor: Editor) => editor.isActive("heading", { level: 2 }),
  },
  {
    id: "heading-3",
    label: "Heading 3",
    icon: "format_h3",
    action: (editor: Editor) =>
      editor.chain().focus().setHeading({ level: 3 }).run(),
    isActive: (editor: Editor) => editor.isActive("heading", { level: 3 }),
  },
  {
    id: "bullet-list",
    label: "Bullet List",
    icon: "format_list_bulleted",
    action: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor: Editor) => editor.isActive("bulletList"),
  },
  {
    id: "numbered-list",
    label: "Numbered List",
    icon: "format_list_numbered",
    action: (editor: Editor) =>
      editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor: Editor) => editor.isActive("orderedList"),
  },
  {
    id: "task-list",
    label: "Task List",
    icon: "checklist",
    action: (editor: Editor) => editor.chain().focus().toggleTaskList().run(),
    isActive: (editor: Editor) => editor.isActive("taskList"),
  },
  {
    id: "blockquote",
    label: "Blockquote",
    icon: "format_quote",
    action: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor: Editor) => editor.isActive("blockquote"),
  },
  {
    id: "code-block",
    label: "Code Block",
    icon: "code",
    action: (editor: Editor) => editor.chain().focus().setCodeBlock().run(),
    isActive: (editor: Editor) => editor.isActive("codeBlock"),
  },
];

const ALIGNMENT_OPTIONS = [
  {
    id: "left",
    label: "Align Left",
    icon: "format_align_left",
    action: (editor: Editor) =>
      editor.chain().focus().setTextAlign("left").run(),
    isActive: (editor: Editor) => editor.isActive({ textAlign: "left" }),
  },
  {
    id: "center",
    label: "Align Center",
    icon: "format_align_center",
    action: (editor: Editor) =>
      editor.chain().focus().setTextAlign("center").run(),
    isActive: (editor: Editor) => editor.isActive({ textAlign: "center" }),
  },
  {
    id: "right",
    label: "Align Right",
    icon: "format_align_right",
    action: (editor: Editor) =>
      editor.chain().focus().setTextAlign("right").run(),
    isActive: (editor: Editor) => editor.isActive({ textAlign: "right" }),
  },
];

const TEXT_COLORS = [
  { name: "Red", class: "bg-red-600", value: "rgb(220 38 38)" },
  { name: "Orange", class: "bg-orange-600", value: "rgb(234 88 12)" },
  { name: "Amber", class: "bg-amber-600", value: "rgb(217 119 6)" },
  { name: "Green", class: "bg-green-600", value: "rgb(22 163 74)" },
  { name: "Emerald", class: "bg-emerald-600", value: "rgb(5 150 105)" },
  { name: "Blue", class: "bg-blue-600", value: "rgb(37 99 235)" },
  { name: "Indigo", class: "bg-indigo-600", value: "rgb(79 70 229)" },
  { name: "Violet", class: "bg-violet-600", value: "rgb(124 58 237)" },
  { name: "Pink", class: "bg-pink-600", value: "rgb(219 39 119)" },
];

export function DocumentBubbleMenu({ editor }: BubbleMenuProps) {
  const [openPopover, setOpenPopover] = useState<string | null>(null);

  if (!editor) return null;

  const getCurrentFormat = () => {
    const active = FORMATTING_OPTIONS.find((opt) => opt.isActive(editor));
    return active || FORMATTING_OPTIONS[0];
  };

  const getCurrentAlignment = () => {
    const active = ALIGNMENT_OPTIONS.find((opt) => opt.isActive(editor));
    return active || ALIGNMENT_OPTIONS[0];
  };

  const getCurrentColor = () => {
    const color = editor.getAttributes("textStyle").color;
    if (!color) return null;
    const normalizeColor = (c: string) => c.replace(/\s+/g, " ");
    const normalizedCurrent = normalizeColor(color);
    return TEXT_COLORS.find(
      (tc) => normalizeColor(tc.value) === normalizedCurrent,
    );
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = globalThis.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  const currentFormat = getCurrentFormat();
  const currentAlignment = getCurrentAlignment();
  const currentColor = getCurrentColor();

  return (
    <TiptapBubbleMenu
      editor={editor}
      updateDelay={0}
      shouldShow={({ state }) => {
        const { from, to } = state.selection;
        return from !== to || openPopover !== null;
      }}
      className="flex items-center gap-px rounded-lg border bg-background shadow-lg p-1 w-fit z-40"
    >
      {/* Formatting Popover */}
      <Popover
        open={openPopover === "formatting"}
        onOpenChange={(open) => setOpenPopover(open ? "formatting" : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 px-1.5 whitespace-nowrap"
            onMouseDown={(e) => e.preventDefault()}
          >
            <span className="text-sm text-foreground">
              {currentFormat.label}
            </span>
            <Icon
              name="expand_more"
              size={16}
              className="text-muted-foreground"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-48 p-1"
          style={{ zIndex: 99 }}
        >
          {FORMATTING_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => {
                option.action(editor);
                setOpenPopover(null);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left",
                option.isActive(editor) && "bg-muted",
              )}
            >
              <Icon name={option.icon} size={16} />
              <span>{option.label}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Bold */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(
          "h-7 w-7 p-0 shrink-0",
          editor.isActive("bold") && "bg-muted",
        )}
      >
        <Icon name="format_bold" size={16} className="text-muted-foreground" />
      </Button>

      {/* Italic */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(
          "h-7 w-7 p-0 shrink-0",
          editor.isActive("italic") && "bg-muted",
        )}
      >
        <Icon
          name="format_italic"
          size={16}
          className="text-muted-foreground"
        />
      </Button>

      {/* Strikethrough */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={cn(
          "h-7 w-7 p-0 shrink-0",
          editor.isActive("strike") && "bg-muted",
        )}
      >
        <Icon
          name="strikethrough_s"
          size={16}
          className="text-muted-foreground"
        />
      </Button>

      {/* Code */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={cn(
          "h-7 w-7 p-0 shrink-0",
          editor.isActive("code") && "bg-muted",
        )}
      >
        <Icon name="code" size={16} className="text-muted-foreground" />
      </Button>

      {/* Link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={setLink}
        className={cn(
          "h-7 w-7 p-0 shrink-0",
          editor.isActive("link") && "bg-muted",
        )}
      >
        <Icon name="link" size={16} className="text-muted-foreground" />
      </Button>

      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Alignment Popover */}
      <Popover
        open={openPopover === "alignment"}
        onOpenChange={(open) => setOpenPopover(open ? "alignment" : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-0.5 h-7 px-1.5 shrink-0"
            onMouseDown={(e) => e.preventDefault()}
          >
            <Icon
              name={currentAlignment.icon}
              size={16}
              className="text-muted-foreground"
            />
            <Icon
              name="expand_more"
              size={16}
              className="text-muted-foreground"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-40 p-1"
          style={{ zIndex: 99 }}
        >
          {ALIGNMENT_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => {
                option.action(editor);
                setOpenPopover(null);
              }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left",
                option.isActive(editor) && "bg-muted",
              )}
            >
              <Icon name={option.icon} size={16} />
              <span>{option.label}</span>
            </button>
          ))}
        </PopoverContent>
      </Popover>

      <div className="h-6 w-px bg-border mx-0.5" />

      {/* Color Picker Popover */}
      <Popover
        open={openPopover === "color"}
        onOpenChange={(open) => setOpenPopover(open ? "color" : null)}
      >
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-0.5 h-7 px-1.5 shrink-0"
            onMouseDown={(e) => e.preventDefault()}
          >
            <div
              className={cn(
                "w-4 h-4 rounded",
                currentColor ? currentColor.class : "bg-foreground",
              )}
            />
            <Icon
              name="expand_more"
              size={16}
              className="text-muted-foreground"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-40 p-2"
          style={{ zIndex: 99 }}
        >
          <div className="grid grid-cols-3 gap-2">
            {TEXT_COLORS.map((color) => (
              <button
                type="button"
                key={color.value}
                onClick={() => {
                  // @ts-expect-error - setColor exists but not in base types
                  editor.chain().focus().setColor(color.value).run();
                  setOpenPopover(null);
                }}
                className={cn(
                  "w-9 h-9 rounded transition-transform hover:scale-110",
                  color.class,
                  currentColor?.value === color.value &&
                    "ring-2 ring-offset-2 ring-neutral-400",
                )}
                title={color.name}
              />
            ))}
          </div>
          <Separator className="my-2" />
          <button
            type="button"
            onClick={() => {
              // @ts-expect-error - unsetColor exists but not in base types
              editor.chain().focus().unsetColor().run();
              setOpenPopover(null);
            }}
            className="w-full text-sm text-left px-2 py-1.5 rounded hover:bg-muted"
          >
            Reset Color
          </button>
        </PopoverContent>
      </Popover>
    </TiptapBubbleMenu>
  );
}
