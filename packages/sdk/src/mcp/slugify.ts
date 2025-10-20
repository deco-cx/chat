import { createHash } from "node:crypto";

/**
 * Transforms a string into a unique alphanumeric identifier.
 * The resulting string will:
 * 1. Only contain alphanumeric characters
 * 2. Be unique for different inputs
 * 3. Be deterministic (same input always produces same output)
 * 4. Preserve some readability of the original string
 */
export function toAlphanumericId(input: string): string {
  // First, convert the string to lowercase and remove all non-alphanumeric chars
  const baseSlug = input.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Create a hash of the original input to ensure uniqueness
  const hash = createHash("sha256").update(input).digest("hex").slice(0, 8); // Take first 8 chars of hash

  // Combine the cleaned string with the hash
  // If baseSlug is empty, just return the hash
  return baseSlug ? `${baseSlug}-${hash}` : hash;
}

/**
 * Slugifies a string to be used as a subdomain
 * @param name The name to slugify
 * @returns A slugified string
 */
export const slugifyForDNS = (name: string) => {
  // Lowercase and replace all non-alphanumeric with hyphens
  let slug = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
  // Replace multiple hyphens with a single hyphen
  slug = slug.replace(/-+/g, "-");
  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, "");
  // Ensure max length of 63 characters (DNS subdomain limit)
  slug = slug.slice(0, 63);
  // If the result is empty, return a default value (e.g., "subdomain")
  return slug || "subdomain";
};

/**
 * Slugifies a string by converting it to uppercase and replacing all non-alphanumeric characters with a dash.
 * @param input The string to slugify.
 * @returns The slugified string.
 */
export function slugify(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}
