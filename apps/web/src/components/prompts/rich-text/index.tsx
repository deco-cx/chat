import { type Integration, useIntegrations, callTool } from "@deco/sdk";
import { Icon } from "@deco/ui/components/icon.tsx";
import { cn } from "@deco/ui/lib/utils.ts";
import { createUnifiedMentions } from "../../rich-text-editor/extensions/unified-mentions.ts";
import { MentionNode } from "../../rich-text-editor/extensions/mention-node.tsx";
import { MentionDropdown } from "../../rich-text-editor/components/mention-dropdown.tsx";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo, useRef, useCallback } from "react";
import { Markdown } from "tiptap-markdown";
import BubbleMenu from "./bubble-menu.tsx";
import {
  mentionToTag,
  removeMarkdownCodeBlock,
  sanitizeMarkdown,
} from "./common.ts";
import { Comment } from "./extensions/comment.tsx";
import { IntegrationAvatar } from "../../common/avatar/integration.tsx";

interface Props {
  value: string;
  onChange: (markdown: string) => void;
  onKeyDown?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onKeyUp?: (
    event: React.KeyboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  onPaste?: (
    event: React.ClipboardEvent<HTMLDivElement | HTMLTextAreaElement>,
  ) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  enableMentions?: boolean;
  hideMentionsLabel?: boolean;
  excludeIds?: string[];
}

// Extend Integration type to include tools
type IntegrationWithTools = Integration & {
  tools?: Array<{
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
  }>;
};

// Tool interface for flattened tools
export interface Tool {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  integration: {
    id: string;
    name: string;
    icon?: string;
  };
}

export default function RichTextArea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled = false,
  placeholder,
  className,
  enableMentions = false,
  hideMentionsLabel = false,
  excludeIds: _excludeIds = [],
}: Props) {
  const hadUserInteraction = useRef(false);
  const { data: integrations = [] } = useIntegrations();

  // Flatten tools from all integrations
  const tools: Tool[] = useMemo(() => {
    return (integrations as IntegrationWithTools[])
      .filter(
        (integration) =>
          // Filter out workspace-management to avoid duplicate tools
          integration.id !== "i:workspace-management" &&
          integration.tools &&
          Array.isArray(integration.tools) &&
          integration.tools.length > 0,
      )
      .flatMap((integration) =>
        integration.tools!.map(
          (tool: {
            name: string;
            description?: string;
            inputSchema?: Record<string, unknown>;
            outputSchema?: Record<string, unknown>;
          }) => ({
            id: `${integration.id}-${tool.name}`,
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            outputSchema: tool.outputSchema,
            integration: {
              id: integration.id,
              name: integration.name,
              icon: integration.icon,
            },
          }),
        ),
      );
  }, [integrations]);

  const resourceSearchers = useMemo(() => {
    // Match DECO_RESOURCE_<NAME>_SEARCH pattern
    const SEARCH_TOOL_RE = /^DECO_RESOURCE_[A-Z_]+_SEARCH$/;
    return (integrations as IntegrationWithTools[])
      .filter((integration) => {
        // Filter out workspace-management to avoid duplicate document results
        if (integration.id === "i:workspace-management") return false;

        const toolsList = integration.tools ?? [];
        return toolsList.some((t) => SEARCH_TOOL_RE.test(t.name));
      })
      .map((integration) => {
        const searchToolNames = (integration.tools ?? [])
          .map((t) => t.name)
          .filter((name) => SEARCH_TOOL_RE.test(name));
        return {
          integration: {
            id: integration.id,
            name: integration.name,
            icon: integration.icon,
          },
          connection: (integration as Integration).connection,
          searchToolNames,
        };
      })
      .filter((s) => s.searchToolNames.length > 0);
  }, [integrations]);

  // Wrap MentionNode with integration avatar support
  const MentionNodeWithAvatar = useCallback(
    // deno-lint-ignore no-explicit-any
    (props: any) => (
      <MentionNode
        {...props}
        IntegrationAvatar={IntegrationAvatar}
        ResourceIcon={() => <Icon name="description" />}
      />
    ),
    [],
  );

  // Wrap MentionDropdown with integration avatar support
  const MentionDropdownWithAvatar = useCallback(
    // deno-lint-ignore no-explicit-any
    (props: any) => (
      <MentionDropdown {...props} IntegrationAvatar={IntegrationAvatar} />
    ),
    [],
  );

  const extensions = useMemo(() => {
    const extensions: Extensions = [
      StarterKit,
      Markdown.configure({
        html: true,
        transformCopiedText: true,
        transformPastedText: true,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type a message...",
      }),
      Comment,
    ];

    if (enableMentions) {
      extensions.push(
        createUnifiedMentions({
          tools,
          resourceSearchers,
          callTool: (connection, args) =>
            callTool(
              connection as Parameters<typeof callTool>[0],
              args as Parameters<typeof callTool>[1],
            ),
          MentionNode: MentionNodeWithAvatar,
          MentionDropdown: MentionDropdownWithAvatar,
        }),
      );
    }

    return extensions;
  }, [
    enableMentions,
    placeholder,
    tools,
    resourceSearchers,
    MentionNodeWithAvatar,
    MentionDropdownWithAvatar,
  ]);

  const editor = useEditor(
    {
      extensions,
      content: mentionToTag(
        sanitizeMarkdown(removeMarkdownCodeBlock(value)),
        true,
      ),
      editable: !disabled,
      onUpdate: ({ editor }) => {
        const markdown = editor.storage.markdown.getMarkdown();

        if (!hadUserInteraction.current && editor.isFocused) {
          hadUserInteraction.current = true;
        }

        if (hadUserInteraction.current) {
          onChange(markdown);
        }
      },
      editorProps: {
        attributes: {
          class: cn(
            "h-full placeholder:text-muted-foreground field-sizing-content w-full bg-transparent text-base transition-[color,box-shadow] outline-none disabled:cursor-not-allowed disabled:opacity-50 prose whitespace-pre-wrap break-words wrap-anywhere",
            className,
          ),
        },
      },
    },
    [extensions],
  );

  // Sync editor content with value prop changes
  useEffect(() => {
    if (!editor) return;

    // Don't update content if the editor is focused (user is actively editing)
    // This prevents cursor jumping while typing
    if (editor.isFocused && hadUserInteraction.current) {
      return;
    }

    const processedValue = mentionToTag(
      sanitizeMarkdown(removeMarkdownCodeBlock(value)),
      true,
    );
    const currentContent = editor.storage.markdown.getMarkdown();

    // Only update if the content is actually different to avoid infinite loops
    if (processedValue !== currentContent) {
      // Temporarily disable user interaction tracking to prevent onChange from firing
      const wasUserInteraction = hadUserInteraction.current;
      hadUserInteraction.current = false;

      try {
        // Save cursor position before updating content
        const { from, to } = editor.state.selection;

        editor.commands.setContent(processedValue, false, {
          preserveWhitespace: "full",
        });

        // Restore cursor position after content update
        // Only restore if positions are valid in the new document
        const docSize = editor.state.doc.content.size;
        if (from <= docSize && to <= docSize) {
          editor.commands.setTextSelection({ from, to });
        }
      } catch (error) {
        // If content setting still fails after sanitization, log and use empty content
        console.error(
          "Failed to set editor content after sanitization:",
          error,
        );
        editor.commands.setContent("", false, {
          preserveWhitespace: "full",
        });
      }

      // Restore user interaction state
      hadUserInteraction.current = wasUserInteraction;
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <div className="h-full flex flex-col">
      {enableMentions && !hideMentionsLabel && (
        <div className="rounded-full flex gap-1 bg-muted text-muted-foreground w-fit items-center px-1.5 py-0.5 mb-2.5 select-none">
          <Icon name="info" size={10} />
          <p className="text-xs font-medium">
            Type @ to mention tools and resources
          </p>
        </div>
      )}
      <BubbleMenu editor={editor} />
      <EditorContent
        className="h-full"
        editor={editor}
        onKeyDown={onKeyDown}
        onKeyUp={onKeyUp}
        onPaste={onPaste}
      />
    </div>
  );
}
