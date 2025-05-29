/**
 * Generates a bucket name for a workspace
 * @param workspaceValue The workspace value
 * @returns Normalized bucket name
 */
export function getWorkspaceBucketName(workspaceValue: string): string {
  return `deco-chat-${
    workspaceValue
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  }`;
}
