/**
 * Converts a string into a URL-safe slug.
 * - Lowercases the string
 * - Replaces spaces and underscores with dashes
 * - Removes non-alphanumeric characters (except dashes)
 * - Trims leading/trailing dashes
 *
 * @param input - The string to slugify
 * @returns The slugified string
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[\s_]+/g, "-") // Replace spaces and underscores with dashes
    .replace(/[^a-z0-9-]/g, "") // Remove all non-alphanumeric except dashes
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-+|-+$/g, ""); // Trim leading/trailing dashes
}

export function sanitizeConstantName(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s_]+/g, "_") // Replace spaces and underscores with underscores
    .replace(/[^A-Z0-9_]/g, "") // Remove all non-alphanumeric except underscores
    .replace(/_+/g, "_") // Collapse multiple underscores
    .replace(/^_+|_+$/g, ""); // Trim leading/trailing underscores
}