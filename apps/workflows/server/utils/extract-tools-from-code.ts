/**
 * Code Analysis Utilities for Tool Detection
 *
 * Extracts tool calls from generated step code to ensure
 * authorization matches actual usage.
 */

export interface ExtractedTool {
  toolName: string;
  integrationId: string;
  line: number;
}

/**
 * Extract all tool calls from step code
 * Finds patterns like: ctx.env["i:integration-id"].TOOL_NAME(
 *
 * @param code - ES module code to analyze
 * @returns Array of extracted tools with line numbers
 */
export function extractToolsFromCode(code: string): ExtractedTool[] {
  const tools: ExtractedTool[] = [];
  const lines = code.split("\n");

  // Regex: ctx.env["integration-id"].TOOL_NAME(
  // Matches: ctx.env["i:workspace-management"].AI_GENERATE_OBJECT(
  const pattern = /ctx\.env\["([^"]+)"\]\.([A-Z_][A-Z0-9_]*)\(/g;

  lines.forEach((line, index) => {
    let match;
    // Reset regex lastIndex for each line
    pattern.lastIndex = 0;

    while ((match = pattern.exec(line)) !== null) {
      tools.push({
        integrationId: match[1],
        toolName: match[2],
        line: index + 1,
      });
    }
  });

  return tools;
}

/**
 * Validate that declared tools match actual code usage
 *
 * @param code - ES module code
 * @param declaredTools - Tools that AI claims to use
 * @returns Validation result with missing/extra tools
 */
export function validateUsedTools(
  code: string,
  declaredTools: Array<{ toolName: string; integrationId: string }>,
): {
  valid: boolean;
  missing: ExtractedTool[]; // In code but not declared
  extra: Array<{ toolName: string; integrationId: string }>; // Declared but not in code
} {
  const extractedTools = extractToolsFromCode(code);

  // Check for missing tools (in code but not declared)
  const missing = extractedTools.filter((extracted) => {
    return !declaredTools.some(
      (declared) =>
        declared.toolName === extracted.toolName &&
        declared.integrationId === extracted.integrationId,
    );
  });

  // Remove duplicates from missing
  const uniqueMissing = Array.from(
    new Map(
      missing.map((t) => [`${t.integrationId}:${t.toolName}`, t]),
    ).values(),
  );

  // Check for extra tools (declared but not in code)
  const extra = declaredTools.filter((declared) => {
    return !extractedTools.some(
      (extracted) =>
        extracted.toolName === declared.toolName &&
        extracted.integrationId === declared.integrationId,
    );
  });

  return {
    valid: uniqueMissing.length === 0 && extra.length === 0,
    missing: uniqueMissing,
    extra,
  };
}

/**
 * Get unique tools from code (deduplicated)
 *
 * @param code - ES module code
 * @returns Deduplicated list of tools
 */
export function getUniqueToolsFromCode(code: string): Array<{
  toolName: string;
  integrationId: string;
}> {
  const extracted = extractToolsFromCode(code);
  const unique = new Map<string, (typeof extracted)[0]>();

  extracted.forEach((tool) => {
    const key = `${tool.integrationId}:${tool.toolName}`;
    if (!unique.has(key)) {
      unique.set(key, tool);
    }
  });

  return Array.from(unique.values()).map(({ toolName, integrationId }) => ({
    toolName,
    integrationId,
  }));
}
