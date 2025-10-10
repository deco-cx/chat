import { Button } from "@deco/ui/components/button.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { Spinner } from "@deco/ui/components/spinner.tsx";
import { Separator } from "@deco/ui/components/separator.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { BubbleMenu as TiptapBubbleMenu, type Editor } from "@tiptap/react";
import { useState } from "react";
import { MCPClient } from "@deco/sdk";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@deco/ui/components/dropdown-menu.tsx";

interface BubbleMenuProps {
  editor: Editor | null;
}

const AI_ACTIONS = [
  {
    id: "improve",
    label: "Improve Writing",
    icon: "edit",
    prompt: "Improve the writing of this text, making it clearer and more professional:",
  },
  {
    id: "fix-grammar",
    label: "Fix Grammar",
    icon: "spellcheck",
    prompt: "Fix any grammar and spelling mistakes in this text:",
  },
  {
    id: "make-shorter",
    label: "Make Shorter",
    icon: "compress",
    prompt: "Make this text more concise while keeping the key information:",
  },
  {
    id: "make-longer",
    label: "Make Longer",
    icon: "expand",
    prompt: "Expand this text with more detail and examples:",
  },
  {
    id: "change-tone",
    label: "Change Tone",
    icon: "mood",
    prompt: "Rewrite this text in a more friendly and casual tone:",
  },
];

export function DocumentBubbleMenu({ editor }: BubbleMenuProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiDropdownOpen, setAIDropdownOpen] = useState(false);

  if (!editor) return null;

  const handleAIAction = async (action: typeof AI_ACTIONS[number]) => {
    if (!editor || isGenerating) return;

    const { from, to } = editor.state.selection;
    if (from === to) return; // No selection

    const selectedText = editor.state.doc.textBetween(from, to, " ");
    if (!selectedText) return;

    setIsGenerating(true);
    setAIDropdownOpen(false);

    try {
      const locator = (editor.storage as any).locator;
      if (!locator) throw new Error("No locator available");

      const client = MCPClient.forLocator(locator);
      const result = await (client as any).AI_GENERATE({
        messages: [
          {
            role: "user",
            content: `${action.prompt}\n\n${selectedText}`,
          },
        ],
      });

      if (result?.text) {
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContentAt(from, result.text)
          .run();
      }
    } catch (error) {
      console.error("Failed to generate AI content:", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("URL", previousUrl);

    if (url === null) return;

    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  };

  return (
    <TiptapBubbleMenu
      editor={editor}
      tippyOptions={{ duration: 100 }}
      className="flex items-center gap-1 rounded-lg border border-border bg-popover shadow-lg p-1"
    >
      {/* AI Actions Dropdown */}
      <DropdownMenu open={aiDropdownOpen} onOpenChange={setAIDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 h-8 px-2"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Spinner size="xs" />
            ) : (
              <Icon name="auto_awesome" size={16} />
            )}
            <span className="text-xs">AI</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {AI_ACTIONS.map((action) => (
            <DropdownMenuItem
              key={action.id}
              onClick={() => handleAIAction(action)}
              className="gap-2"
            >
              <Icon name={action.icon} size={14} />
              <span className="text-sm">{action.label}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Separator orientation="vertical" className="h-6" />

      {/* Bold */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive("bold") && "bg-muted",
        )}
      >
        <Icon name="format_bold" size={16} />
      </Button>

      {/* Italic */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive("italic") && "bg-muted",
        )}
      >
        <Icon name="format_italic" size={16} />
      </Button>

      {/* Strikethrough */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive("strike") && "bg-muted",
        )}
      >
        <Icon name="strikethrough_s" size={16} />
      </Button>

      {/* Code */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().toggleCode().run()}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive("code") && "bg-muted",
        )}
      >
        <Icon name="code" size={16} />
      </Button>

      <Separator orientation="vertical" className="h-6" />

      {/* Link */}
      <Button
        variant="ghost"
        size="sm"
        onClick={setLink}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive("link") && "bg-muted",
        )}
      >
        <Icon name="link" size={16} />
      </Button>

      {/* Text Align Left */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive({ textAlign: "left" }) && "bg-muted",
        )}
      >
        <Icon name="format_align_left" size={16} />
      </Button>

      {/* Text Align Center */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive({ textAlign: "center" }) && "bg-muted",
        )}
      >
        <Icon name="format_align_center" size={16} />
      </Button>

      {/* Text Align Right */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
        className={cn(
          "h-8 w-8 p-0",
          editor.isActive({ textAlign: "right" }) && "bg-muted",
        )}
      >
        <Icon name="format_align_right" size={16} />
      </Button>
    </TiptapBubbleMenu>
  );
}

