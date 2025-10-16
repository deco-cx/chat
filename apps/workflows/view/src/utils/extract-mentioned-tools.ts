import { Integration } from "@/hooks/useIntegrations";

interface SelectedTool {
  name: string;
  integrationId: string;
  integrationName: string;
  description?: string;
  inputSchema?: any;
  outputSchema?: any;
}

/**
 * Extract tools mentioned in prompt with @ syntax
 *
 * @param prompt User prompt text (may include @tool-name mentions)
 * @param integrations Available integrations with tools
 * @returns Array of selected tools with full metadata
 *
 * @example
 * const prompt = "Use @AI_GENERATE_OBJECT to create data and @DATABASES_RUN_SQL to store it";
 * const tools = extractMentionedTools(prompt, integrations);
 * // Returns: [{ name: "AI_GENERATE_OBJECT", ... }, { name: "DATABASES_RUN_SQL", ... }]
 */
export function extractMentionedTools(
  prompt: string,
  integrations: Integration[],
): SelectedTool[] {
  const mentionedTools: SelectedTool[] = [];
  const seenTools = new Set<string>(); // Avoid duplicates

  // Regex to find @tool-name mentions
  // Matches: @word-characters (alphanumeric + underscore + hyphen)
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const matches = [...prompt.matchAll(mentionRegex)];

  for (const match of matches) {
    const toolName = match[1];

    // Skip if already processed
    if (seenTools.has(toolName)) {
      continue;
    }

    // Find tool in integrations
    for (const integration of integrations) {
      const tool = integration.tools?.find((t) => t.name === toolName);

      if (tool) {
        mentionedTools.push({
          name: tool.name,
          integrationId: integration.id,
          integrationName: integration.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema,
        });

        seenTools.add(toolName);
        break; // Found tool, move to next mention
      }
    }

    // Tool not found
    if (!seenTools.has(toolName)) {
      console.warn("⚠️ [extractMentionedTools] Tool not found:", toolName);
    }
  }

  return mentionedTools;
}
