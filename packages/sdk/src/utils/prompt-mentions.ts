import { listPrompts } from "../crud/prompts.ts";
import { Prompt } from "../index.ts";
import { unescapeHTML } from "./html.ts";

export const MENTION_REGEX = /(?:<|&lt;)(\w+):([\w-]+)(?:>|&gt;)/g;

type Mentionables = "prompt";

const mentionableTypes: Mentionables[] = ["prompt"];

interface Mention {
  id: string;
  type: Mentionables;
}

/**
 * Extracts prompt mentions from a system prompt
 */
export function extractMentionsFromString(systemPrompt: string): Mention[] {
  const unescapedSystemPrompt = unescapeHTML(systemPrompt);
  const mentions: Mention[] = [];
  let match;

  while ((match = MENTION_REGEX.exec(unescapedSystemPrompt)) !== null) {
    const type = match[1] as Mentionables;
    if (mentionableTypes.includes(type)) {
      mentions.push({
        type,
        id: match[2],
      });
    }
  }

  return mentions;
}

export function toMention(id: string, type: Mentionables = "prompt") {
  return `<${type}:${id}>`;
}

// TODO: Resolve all types of mentions
export async function resolveMentions(
  content: string,
  workspace: string,
  options?: {
    /**
     * The id of the parent prompt. If provided, the resolution will skip the parent id to avoid infinite recursion.
     */
    parentPromptId?: string;
  },
): Promise<string> {
  const contentWithoutComments = content.replaceAll(
    /<span\s+data-type="comment"\s*?[^>]*?>.*?<\/span>/gs,
    "",
  );

  const mentions = extractMentionsFromString(content);

  const promptIds = mentions.filter((mention) => mention.type === "prompt").map(
    (mention) => mention.id,
  );
  if (!promptIds.length) {
    return contentWithoutComments;
  }

  const prompts = await listPrompts(workspace, {
    ids: promptIds,
    resolveMentions: true,
  });

  if (!prompts.length) {
    return contentWithoutComments;
  }

  const promptMap = new Map<string, Prompt>(
    prompts.map((prompt) => [prompt.id, prompt]),
  );

  return contentWithoutComments
    .replaceAll(MENTION_REGEX, (_match, type, id) => {
      if (type === "prompt") {
        if (id === options?.parentPromptId) {
          return "";
        }

        const prompt = promptMap.get(id);
        if (!prompt) {
          return "";
        }

        return `\n${prompt.content}\n`;
      }

      return "";
    });
}
