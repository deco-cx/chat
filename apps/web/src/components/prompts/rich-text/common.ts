import { MENTION_REGEX, toMention } from "@deco/sdk/utils";

export function mentionToTag(mention: string) {
  return mention.replaceAll(
    MENTION_REGEX,
    (match, type, id) => {
      if (type === "comment") {
        return `<span data-type="comment">${id}</span>`;
      }

      if (type === "prompt") {
        return `<span data-type="mention" data-id="${id}"></span>`;
      }

      return match;
    },
  );
}

export function tagToMention(content: string) {
  return content
    .replace(
      /<span[^>]*data-type="mention"\s+[^>]*?data-id="([^"]+)"[^>]*?>.*?<\/span>/gs,
      (_, id) => toMention(id, "prompt"),
    ).replace(
      /(<span[^>]*data-type="comment"[^>]*>)\s*\n\s*|\s*\n\s*(<\/span>)/g,
      "$1$2",
    );
}
