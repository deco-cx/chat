import { useFile } from "@deco/sdk";
import { Avatar, type AvatarProps } from "./index.tsx";

const DEFAULT_URL = "icon://linked_services";

export interface IntegrationAvatarProps extends Omit<AvatarProps, "shape"> {
  /**
   * The URL or file path of the avatar image
   * - If it's an https:// or http:// URL, it will be used directly
   * - If it's a file path, it will be resolved using useFile hook
   */
  url?: string;
}

/**
 * IntegrationAvatar - Specialized avatar for third-party integrations and services
 *
 * Features:
 * - Always square shape (integrations are services/brands)
 * - Intelligent URL handling (auto-resolves file paths to URLs)
 * - Default size="sm" and objectFit="contain" (preserves logo aspect ratio)
 */
export function IntegrationAvatar({
  url,
  size = "sm",
  objectFit = "contain",
  ...props
}: IntegrationAvatarProps) {
  // Use default empty integration image if no URL is provided
  const actualUrl = url || DEFAULT_URL;

  // Check if URL is already a valid HTTPS/HTTP URL or is the default
  const isValidUrl =
    actualUrl.startsWith("https://") ||
    actualUrl.startsWith("http://") ||
    actualUrl.startsWith("/") ||
    actualUrl.startsWith("icon://");

  // Use useFile hook only for non-URL paths (excluding the default URL)
  const { data: resolvedFileUrl } = useFile(
    actualUrl !== DEFAULT_URL && !isValidUrl ? actualUrl : "",
  );

  // Determine the final URL to use
  const finalUrl = isValidUrl
    ? actualUrl
    : typeof resolvedFileUrl === "string"
      ? resolvedFileUrl
      : DEFAULT_URL;

  return (
    <Avatar
      shape="square"
      size={size}
      objectFit={objectFit}
      url={finalUrl}
      muted={props.muted || finalUrl?.startsWith("icon://")}
      {...props}
    />
  );
}
