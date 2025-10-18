import { type Integration, useIntegrations, callTool } from "@deco/sdk";
import { cn } from "@deco/ui/lib/utils.ts";
import { createUnifiedMentions } from "../rich-text-editor/extensions/unified-mentions.ts";
import { MentionNode } from "../rich-text-editor/extensions/mention-node.tsx";
import { MentionDropdown } from "../rich-text-editor/components/mention-dropdown.tsx";
import type { MentionItem } from "../rich-text-editor/types.ts";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, type Extensions, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useMemo } from "react";
import { Markdown } from "tiptap-markdown";
import { NoNewLine } from "./extensions/no-new-line.ts";
import { useAgent } from "../agent/provider.tsx";
import { IntegrationAvatar } from "../common/avatar/integration.tsx";
import { Icon } from "@deco/ui/components/icon.tsx";
import { useAgentSettingsToolsSet } from "../../hooks/use-agent-settings-tools-set.ts";

export interface Mention {
  id: string;
  type: string;
  content?: string;
  label?: string;
  title?: string;
  models?: Array<{
    model: string;
    instructions: string;
  }>;
  selectedModel?: string;
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

interface RichTextAreaProps {
  value: string;
  onChange: (markdown: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: React.ClipboardEvent) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  allowNewLine?: boolean;
  enableToolMentions?: boolean;
}

export function RichTextArea({
  value,
  onChange,
  onKeyDown,
  onKeyUp,
  onPaste,
  disabled = false,
  placeholder,
  className,
  allowNewLine = false,
  enableToolMentions = false,
}: RichTextAreaProps) {
  const { isPublic } = useAgent();
  const { data: integrations = [] } = useIntegrations({ isPublic });

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

  const { appendIntegrationTool } = useAgentSettingsToolsSet();

  // Create wrapper for MentionNode - use a ref to ensure stable function reference
  const MentionNodeWithAvatar = useMemo(() => {
    // deno-lint-ignore no-explicit-any
    return function MentionNodeWrapper(props: any) {
      return (
        <MentionNode
          {...props}
          IntegrationAvatar={IntegrationAvatar}
          ResourceIcon={() => <Icon name="description" />}
        />
      );
    };
  }, []);

  // Create wrapper for MentionDropdown - use a ref to ensure stable function reference
  const MentionDropdownWithAvatar = useMemo(() => {
    // deno-lint-ignore no-explicit-any
    return function MentionDropdownWrapper(props: any) {
      const wrappedCommand = (item: MentionItem) => {
        // Handle tool selection - add to agent's toolset
        if (item.type === "tool") {
          appendIntegrationTool(item.tool.integration.id, item.tool.name);
        }
        // Handle resource selection - add READ tool to agent's toolset
        // This allows the agent to read the resource content on demand
        else if (item.type === "resource") {
          // Add the READ tool for this resource type to the agent's toolset
          const readToolName = `DECO_RESOURCE_${item.resourceType.toUpperCase()}_READ`;
          appendIntegrationTool(item.integration.id, readToolName);
        }

        // Call the original command to insert the mention
        props.command(item);
      };

      return (
        <MentionDropdown
          {...props}
          command={wrappedCommand}
          IntegrationAvatar={IntegrationAvatar}
        />
      );
    };
  }, []); // appendIntegrationTool should be stable, no need to list it

  const extensions: Extensions = useMemo(() => {
    const extensions: Extensions = [
      StarterKit,
      Markdown.configure({
        html: true,
      }),
      NoNewLine.configure({
        shouldPreventNewLine: () => !allowNewLine,
      }),
      Placeholder.configure({
        placeholder: placeholder ?? "Type a message...",
      }),
    ];

    if (enableToolMentions) {
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
    allowNewLine,
    placeholder,
    enableToolMentions,
    tools,
    resourceSearchers,
    MentionNodeWithAvatar,
    MentionDropdownWithAvatar,
  ]);

  const editor = useEditor(
    {
      extensions,
      content: value,
      editable: !disabled,
      onUpdate: ({ editor }) => {
        const markdown = editor.storage.markdown.getMarkdown({
          html: true,
        });

        onChange(markdown);
      },
      editorProps: {
        attributes: {
          class: cn(
            "w-full outline-none min-h-[48px] max-h-[164px] overflow-y-auto p-4  leading-[1.2] rounded-t-2xl",
            disabled && "opacity-100 text-muted-foreground",
            className,
          ),
        },
      },
    },
    [extensions],
  );

  useEffect(() => {
    if (editor && editor.storage.markdown.getMarkdown() !== value) {
      try {
        editor.commands.setContent(value, false);
      } catch (error) {
        // If content setting fails due to unexpected parsing issues, use empty content
        console.error("Failed to set editor content:", error);
        editor.commands.setContent("", false);
      }
    }
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  return (
    <EditorContent
      editor={editor}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      onPaste={onPaste}
    />
  );
}
