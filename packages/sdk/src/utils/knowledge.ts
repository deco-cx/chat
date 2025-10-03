import { WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH } from "../constants.ts";
import { z } from "zod/v3";

export const FileExtSchema = z.enum([".pdf", ".txt", ".md", ".csv", ".json"]);
export type FileExt = z.infer<typeof FileExtSchema>;
const allowedTypes: FileExt[] = [".pdf", ".txt", ".md", ".csv", ".json"];

export const isAllowedFileExt = (ext: string): ext is FileExt =>
  allowedTypes.includes(ext as FileExt);

export type ContentType =
  | "application/pdf"
  | "text/plain"
  | "text/markdown"
  | "text/csv"
  | "application/csv"
  | "application/json";
const allowedContentTypes = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv",
  "application/json",
];

export const isAllowedContentType = (
  contentType: string,
): contentType is ContentType => allowedContentTypes.includes(contentType);

export const getExtensionFromContentType = (
  _contentType: string | null,
): FileExt => {
  const contentType = _contentType?.toLowerCase() ?? "";
  if (!contentType || !isAllowedContentType(contentType)) return ".txt";

  const typeMap: Record<ContentType, FileExt> = {
    "application/pdf": ".pdf",
    "text/plain": ".txt",
    "text/markdown": ".md",
    "text/csv": ".csv",
    "application/csv": ".csv",
    "application/json": ".json",
  };

  return typeMap[contentType];
};

export const formatFileSize = (bytes: number) => {
  if (bytes === 0 || Number.isNaN(bytes)) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const KnowledgeBaseID = {
  format: (index: string) =>
    `${WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH}-${index}`,
  parse: (id: string) => {
    if (!id.startsWith(WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH)) {
      throw new Error("Invalid knowledge base ID");
    }
    return id.slice(
      WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH.length + 1,
    );
  },
};
/* Must start with a letter or underscore, contain only letters, numbers, or underscores, and be at most 63 characters long. */
export const parseToValidIndexName = (uuid: string) =>
  `_${uuid.replaceAll("-", "_")}`;

/**
 * Extracts agent UUID from knowledge base integration ID
 * Format: i:knowledge-base-_<agent_uuid_with_underscores>
 * Returns: <agent_uuid_with_dashes>
 */
export const extractAgentUuidFromKnowledgeBaseId = (
  integrationId: string,
): string | null => {
  if (
    !integrationId.startsWith(
      WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH,
    )
  ) {
    return null;
  }

  // Remove the prefix "i:knowledge-base-"
  const indexPart = integrationId.replace(
    WELL_KNOWN_KNOWLEDGE_BASE_CONNECTION_ID_STARTSWITH + "-",
    "",
  );

  // Remove the leading underscore and convert underscores back to dashes
  if (indexPart.startsWith("_")) {
    return indexPart.slice(1).replaceAll("_", "-");
  }

  return null;
};
