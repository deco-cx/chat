/**
 * Maps Object.entries of tools to include the name as a property
 * This is a common pattern used when transforming tools for API responses
 *
 * @param tools - Object with tool names as keys and tool objects as values
 * @returns Array of tools with name added to each tool object
 */
// deno-lint-ignore no-explicit-any
export function mapToolEntries<T extends Record<string, any>>(
  tools: T,
): Array<T[keyof T] & { name: string }> {
  return Object.entries(tools).map(([name, value]) => ({
    ...value,
    name,
  }));
}
