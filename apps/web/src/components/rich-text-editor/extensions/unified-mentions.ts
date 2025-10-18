import Mention from "@tiptap/extension-mention";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionOptions } from "@tiptap/suggestion";
import tippy, { type Instance, type Props } from "tippy.js";
import type { MentionItem, Tool } from "../types.ts";

interface UnifiedMentionsOptions {
  tools: Tool[];
  resourceSearchers: Array<{
    integration: { id: string; name: string; icon?: string };
    connection: unknown;
    searchToolNames: string[];
  }>;
  callTool: (
    connection: unknown,
    args: { name: string; arguments: Record<string, unknown> },
  ) => Promise<unknown>;
  // deno-lint-ignore no-explicit-any
  MentionNode: React.ComponentType<any>;
  // deno-lint-ignore no-explicit-any
  MentionDropdown: React.ComponentType<any>;
}

export function createUnifiedMentions(options: UnifiedMentionsOptions) {
  const { tools, resourceSearchers, callTool, MentionNode, MentionDropdown } =
    options;
  const toolMap = new Map<string, Tool>(tools.map((tool) => [tool.id, tool]));

  const suggestion: Partial<SuggestionOptions<MentionItem>> = {
    char: "@",
    allowSpaces: true,
    items: (props) => {
      const { query } = props;
      const ql = query?.toLowerCase() ?? "";
      const filteredTools = tools.filter((tool) => {
        return (
          tool.name.toLowerCase().includes(ql) ||
          tool.description?.toLowerCase().includes(ql) ||
          tool.integration.name.toLowerCase().includes(ql)
        );
      });
      const toolItems: MentionItem[] = filteredTools
        .map(
          (tool): MentionItem => ({
            id: tool.id,
            type: "tool",
            label: tool.name,
            description: tool.description,
            tool,
          }),
        )
        .slice(0, 10);
      return toolItems;
    },
    command: ({ editor, range, props }) => {
      const item = props as MentionItem;

      // Build the attributes object based on mention type
      const attrs: Record<string, string> = {
        type: "mention",
        label: item.label,
      };

      if (item.type === "tool" && item.tool) {
        attrs.mentionType = "tool";
        attrs.toolId = item.tool.id;
        attrs.toolName = item.tool.name;
        attrs.integrationId = item.tool.integration.id;
        attrs.integrationName = item.tool.integration.name;
        attrs.integrationIcon = item.tool.integration.icon || "";
        if (item.tool.inputSchema) {
          attrs.inputSchema = JSON.stringify(item.tool.inputSchema);
        }
        if (item.tool.outputSchema) {
          attrs.outputSchema = JSON.stringify(item.tool.outputSchema);
        }
      } else if (item.type === "resource" && item.resource) {
        attrs.mentionType = "resource";
        attrs.resourceName = item.resource.name;
        attrs.resourceUri = item.resource.uri;
        attrs.resourceType = item.resourceType || "";
        attrs.integrationId = item.integration.id;
        attrs.integrationName = item.integration.name;
        attrs.integrationIcon = item.integration.icon || "";
      }

      // Delete the trigger character and insert the mention as inline content
      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContent([
          {
            type: "mention",
            attrs,
          },
          {
            type: "text",
            text: " ", // Add space after mention
          },
        ])
        .run();
    },
    render: () => {
      let component: ReactRenderer | null = null;
      let popup: Instance<Props>[] | null = null;
      let activeSerial = 0;
      let debounceTimer: number | undefined;

      const perIntegrationLimit = 5;

      const updateProgressively = (
        baseProps: Record<string, unknown>,
        baseItems: MentionItem[],
        query: string,
      ) => {
        const mySerial = ++activeSerial;
        const q = query.trim();
        if (!q || q.length < 2 || resourceSearchers.length === 0) {
          component?.updateProps({
            ...baseProps,
            items: baseItems,
            isLoading: false,
            pendingCategories: [],
          });
          return;
        }

        // Show base items immediately with loading indicator
        component?.updateProps({
          ...baseProps,
          items: baseItems,
          isLoading: true,
          pendingCategories: [],
        });

        const accum: MentionItem[] = [];

        const searches = resourceSearchers.flatMap((searcher) =>
          searcher.searchToolNames.map((toolName) => {
            // Extract resource name from tool name: DECO_RESOURCE_<NAME>_SEARCH
            const resourceName = toolName
              .replace(/^DECO_RESOURCE_/, "")
              .replace(/_SEARCH$/, "");

            return callTool(searcher.connection, {
              name: toolName,
              arguments: {
                uri: q,
                term: q,
                limit: perIntegrationLimit,
              },
            })
              .then((result: unknown) => {
                if (mySerial !== activeSerial) return; // cancelled
                const structured = result as {
                  structuredContent?: { items?: unknown[] };
                };
                const items = structured?.structuredContent?.items ?? [];
                if (!Array.isArray(items)) return;
                const mapped: MentionItem[] = items
                  .slice(0, perIntegrationLimit)
                  .map((r: unknown): MentionItem => {
                    const resource = r as Record<string, unknown>;
                    // Handle both flat and nested data structures
                    const data =
                      (resource?.data as Record<string, unknown>) ?? resource;
                    const name =
                      (data?.name as string) ?? (resource?.name as string);
                    const title =
                      (data?.title as string) ?? (resource?.title as string);
                    const description =
                      (data?.description as string) ??
                      (resource?.description as string);

                    return {
                      id:
                        (resource?.uri as string) ??
                        `${searcher.integration.id}:${name ?? ""}`,
                      type: "resource",
                      label:
                        title ?? name ?? (resource?.uri as string) ?? "Unknown",
                      description: description,
                      resource: {
                        name: name ?? resourceName,
                        title: title,
                        description: description,
                        uri: resource?.uri as string,
                        mimeType:
                          (data?.mimeType as string) ??
                          (resource?.mimeType as string),
                        annotations:
                          (data?.annotations as Record<string, string>) ??
                          (resource?.annotations as Record<string, string>),
                      },
                      integration: searcher.integration,
                      resourceType: resourceName,
                      connection: searcher.connection,
                    };
                  });
                accum.push(...mapped);
              })
              .catch(() => {
                // ignore
              });
          }),
        );

        // Wait for ALL searches to complete before updating the list
        // This prevents items from shifting while the user is interacting
        Promise.allSettled(searches).then(() => {
          if (mySerial !== activeSerial) return; // cancelled
          const combined = [...accum, ...baseItems].slice(0, 12);
          component?.updateProps({
            ...baseProps,
            items: combined,
            isLoading: false,
            pendingCategories: [],
          });
        });
      };

      const computeBaseItems = (
        query: string,
        toolsArg: Tool[],
      ): MentionItem[] => {
        const ql = query?.toLowerCase() ?? "";
        const filtered = toolsArg.filter(
          (tool) =>
            tool.name.toLowerCase().includes(ql) ||
            tool.description?.toLowerCase().includes(ql) ||
            tool.integration.name.toLowerCase().includes(ql),
        );
        return filtered
          .map(
            (tool): MentionItem => ({
              id: tool.id,
              type: "tool",
              label: tool.name,
              description: tool.description,
              tool,
            }),
          )
          .slice(0, 10);
      };

      return {
        onStart: (props) => {
          if (component) {
            component.destroy();
          }

          // Create a simplified command function that MentionDropdown expects
          const simpleCommand = (item: MentionItem) => {
            // Call the TipTap command with the proper signature
            props.command({ item });
          };

          component = new ReactRenderer(MentionDropdown, {
            props: {
              ...props,
              command: simpleCommand,
            },
            editor: props.editor,
          });

          if (!props.clientRect) {
            return;
          }

          // @ts-expect-error - tippy is not well typed
          popup = tippy("body", {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component?.element,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "top-start",
            maxWidth: 400,
          });

          // Progressive update kick-off
          const baseItems = computeBaseItems(props.query ?? "", tools);
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = globalThis.setTimeout(() => {
            updateProgressively(
              props as unknown as Record<string, unknown>,
              baseItems,
              props.query ?? "",
            );
          }, 150) as unknown as number;
        },

        onUpdate(props) {
          popup?.[0]?.setProps({
            // @ts-expect-error - tippy is not well typed
            getReferenceClientRect: props.clientRect,
          });

          const baseItems = computeBaseItems(props.query ?? "", tools);
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = globalThis.setTimeout(() => {
            updateProgressively(
              props as unknown as Record<string, unknown>,
              baseItems,
              props.query ?? "",
            );
          }, 150) as unknown as number;
        },

        onKeyDown(props) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }

          // @ts-expect-error - component.ref is not typed
          return component?.ref?.onKeyDown(props);
        },

        onExit() {
          popup?.[0]?.destroy?.();
          component?.destroy?.();
        },
      };
    },
  };

  return Mention.extend({
    addNodeView() {
      return ReactNodeViewRenderer(MentionNode);
    },
    addAttributes() {
      return {
        type: { default: "mention" },
        mentionType: { default: "tool" },
        // Tool attributes
        toolId: { default: "" },
        toolName: { default: "" },
        inputSchema: { default: "" },
        outputSchema: { default: "" },
        // Resource attributes
        resourceName: { default: "" },
        resourceUri: { default: "" },
        resourceType: { default: "" },
        // Common attributes
        integrationId: { default: "" },
        integrationName: { default: "" },
        integrationIcon: { default: "" },
        label: { default: "" },
      };
    },
    parseHTML() {
      return [
        {
          tag: 'span[data-type="mention"]',
          getAttrs: (node) => {
            if (!(node instanceof HTMLElement)) return false;

            const mentionType = node.getAttribute("data-mention-type");
            if (!mentionType) return false;

            if (mentionType === "tool") {
              const toolId = node.getAttribute("data-tool-id");
              const tool = toolMap.get(toolId || "");
              return {
                mentionType: "tool",
                toolId: toolId,
                toolName: node.getAttribute("data-tool-name") || tool?.name,
                integrationId: node.getAttribute("data-integration-id"),
                integrationName: tool?.integration.name,
                integrationIcon: tool?.integration.icon,
                label: tool?.name || node.textContent?.replace("@", ""),
                inputSchema: node.getAttribute("data-input-schema") || "",
                outputSchema: node.getAttribute("data-output-schema") || "",
              };
            } else if (mentionType === "resource") {
              return {
                mentionType: "resource",
                resourceName: node.getAttribute("data-resource-name"),
                resourceUri: node.getAttribute("data-resource-uri"),
                resourceType: node.getAttribute("data-resource-type"),
                integrationId: node.getAttribute("data-integration-id"),
                label: node.textContent?.replace("@", ""),
              };
            }

            return false;
          },
        },
      ];
    },
    renderHTML({ node }) {
      const attrs: Record<string, string> = {
        "data-type": "mention",
        "data-mention-type": node.attrs.mentionType,
      };

      if (node.attrs.mentionType === "tool") {
        attrs["data-tool-id"] = node.attrs.toolId;
        attrs["data-tool-name"] = node.attrs.toolName;
        attrs["data-integration-id"] = node.attrs.integrationId;
        if (node.attrs.inputSchema) {
          attrs["data-input-schema"] = node.attrs.inputSchema;
        }
        if (node.attrs.outputSchema) {
          attrs["data-output-schema"] = node.attrs.outputSchema;
        }
      } else if (node.attrs.mentionType === "resource") {
        attrs["data-integration-id"] = node.attrs.integrationId;
        attrs["data-resource-name"] = node.attrs.resourceName;
        attrs["data-resource-uri"] = node.attrs.resourceUri;
        attrs["data-resource-type"] = node.attrs.resourceType;
      }

      return ["span", attrs, `@${node.attrs.label}`];
    },
  }).configure({
    suggestion,
    renderText({ node }) {
      if (node.attrs.mentionType === "tool") {
        const tool = toolMap.get(node.attrs.toolId);
        return tool ? `@${tool.name}` : `@${node.attrs.label}`;
      } else {
        return `@${node.attrs.label}`;
      }
    },
  });
}
