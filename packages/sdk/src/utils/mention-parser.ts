/**
 * Unified mention parser for tools and resources
 * Handles parsing and serialization of mentions in rich text content
 */

export interface ToolMention {
  type: "tool";
  tool_id: string;
  tool_name: string;
  integration_id: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
}

export interface ResourceMention {
  type: "resource";
  integration_id: string;
  resource_name: string;
  resource_uri: string;
}

export type ParsedMention = ToolMention | ResourceMention;

/**
 * Regex to match mention spans in HTML content
 * Matches: <span data-type="mention" data-mention-type="tool|resource" data-tool-id="..." ...></span>
 */
const MENTION_SPAN_REGEX =
  /<span[^>]*data-type=["']mention["'][^>]*>.*?<\/span>/gi;

/**
 * Extract attribute value from an HTML tag string
 */
function extractAttribute(html: string, attrName: string): string | null {
  const regex = new RegExp(`${attrName}=["']([^"']+)["']`, "i");
  const match = html.match(regex);
  return match ? match[1] : null;
}

/**
 * Parse all mentions from HTML content
 * @param content HTML content containing mention spans
 * @returns Array of parsed mentions
 */
export function parseMentions(content: string): ParsedMention[] {
  const mentions: ParsedMention[] = [];
  const matches = content.matchAll(MENTION_SPAN_REGEX);

  for (const match of matches) {
    const spanHtml = match[0];
    const mentionType = extractAttribute(spanHtml, "data-mention-type");

    if (!mentionType) {
      console.warn(
        "Mention span missing data-mention-type attribute:",
        spanHtml,
      );
      continue;
    }

    try {
      if (mentionType === "tool") {
        const tool_id = extractAttribute(spanHtml, "data-tool-id");
        const tool_name = extractAttribute(spanHtml, "data-tool-name");
        const integration_id = extractAttribute(
          spanHtml,
          "data-integration-id",
        );
        const input_schema_str = extractAttribute(
          spanHtml,
          "data-input-schema",
        );
        const output_schema_str = extractAttribute(
          spanHtml,
          "data-output-schema",
        );

        if (!tool_id || !tool_name || !integration_id) {
          console.warn("Tool mention missing required attributes:", spanHtml);
          continue;
        }

        // Parse JSON schemas if present
        let input_schema: Record<string, unknown> | undefined;
        let output_schema: Record<string, unknown> | undefined;

        try {
          if (input_schema_str) {
            input_schema = JSON.parse(input_schema_str);
          }
          if (output_schema_str) {
            output_schema = JSON.parse(output_schema_str);
          }
        } catch (error) {
          console.warn("Failed to parse tool schemas:", error);
        }

        mentions.push({
          type: "tool",
          tool_id,
          tool_name,
          integration_id,
          input_schema,
          output_schema,
        });
      } else if (mentionType === "resource") {
        const integration_id = extractAttribute(
          spanHtml,
          "data-integration-id",
        );
        const resource_name = extractAttribute(spanHtml, "data-resource-name");
        const resource_uri = extractAttribute(spanHtml, "data-resource-uri");

        if (!integration_id || !resource_name || !resource_uri) {
          console.warn(
            "Resource mention missing required attributes:",
            spanHtml,
          );
          continue;
        }

        mentions.push({
          type: "resource",
          integration_id,
          resource_name,
          resource_uri,
        });
      }
    } catch (error) {
      console.error("Error parsing mention:", spanHtml, error);
    }
  }

  return mentions;
}

/**
 * Serialize a mention object to HTML span
 * @param mention Mention object to serialize
 * @returns HTML span string
 */
export function serializeMention(mention: ParsedMention): string {
  if (mention.type === "tool") {
    const attrs: string[] = [
      'data-type="mention"',
      'data-mention-type="tool"',
      `data-tool-id="${mention.tool_id}"`,
      `data-tool-name="${mention.tool_name}"`,
      `data-integration-id="${mention.integration_id}"`,
    ];

    // Add schemas as JSON strings if present
    if (mention.input_schema) {
      attrs.push(`data-input-schema='${JSON.stringify(mention.input_schema)}'`);
    }
    if (mention.output_schema) {
      attrs.push(
        `data-output-schema='${JSON.stringify(mention.output_schema)}'`,
      );
    }

    return `<span ${attrs.join(" ")}>@${mention.tool_name}</span>`;
  } else {
    // For resources, we use the resource name or a truncated URI for display
    const displayName =
      mention.resource_name ||
      mention.resource_uri.split("/").pop() ||
      "resource";
    return `<span data-type="mention" data-mention-type="resource" data-integration-id="${mention.integration_id}" data-resource-name="${mention.resource_name}" data-resource-uri="${mention.resource_uri}">@${displayName}</span>`;
  }
}

/**
 * Extract tool IDs from content
 * @param content HTML content
 * @returns Array of tool IDs
 */
export function extractToolIds(content: string): string[] {
  const mentions = parseMentions(content);
  return mentions
    .filter((m): m is ToolMention => m.type === "tool")
    .map((m) => m.tool_id);
}

/**
 * Extract resource URIs from content
 * @param content HTML content
 * @returns Array of resource URIs
 */
export function extractResourceUris(content: string): string[] {
  const mentions = parseMentions(content);
  return mentions
    .filter((m): m is ResourceMention => m.type === "resource")
    .map((m) => m.resource_uri);
}
