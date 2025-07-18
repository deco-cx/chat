export const OLD_MENTION_REGEX = /(?:<|&lt;)(\w+):([\w-]+)(?:>|&gt;)/g;

export function mentionToTag(mention: string, removeNewLines = false) {
  const result = mention.replaceAll(OLD_MENTION_REGEX, (match, type, id) => {
    if (type === "comment") {
      return `<span data-type="comment">${id}</span>`;
    }

    if (type === "prompt") {
      return `<span data-type="mention" data-id="${id}" data-mention-type="prompt"></span>`;
    }

    return match;
  });

  if (removeNewLines) {
    return result.replaceAll(
      /(<span[^>]*>)\s*\n\s*([\s\S]*?)\s*\n\s*(<\/span>)/g,
      "$1$2$3",
    );
  }

  return result;
}

export function removeMarkdownCodeBlock(content: string) {
  if (content.startsWith("```markdown") && content.endsWith("```")) {
    // remove -12 and -4 to remove the ```markdown and ``` and break lines
    return content.slice(12, -4);
  }

  return content;
}
