import { listPrompts } from "../crud/prompts.ts";
import type { MCPClient } from "../fetcher.ts";
import type { Prompt } from "../index.ts";
import { unescapeHTML } from "./html.ts";

export const MENTION_REGEX =
  /<span\s+[^>]*data-id=["']?([^"'\s>]+)["']?\s+[^>]*data-mention-type=["']?([^"'\s>]+)["']?[^>]*>.*?<\/span>/g;
export const COMMENT_REGEX =
  /<span\s+data-type="comment"\s*?[^>]*?>.*?<\/span>/gs;

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

  for (const match of unescapedSystemPrompt.matchAll(MENTION_REGEX)) {
    const type = match[2] as Mentionables;
    if (mentionableTypes.includes(type)) {
      mentions.push({
        type,
        id: match[1],
      });
    }
  }

  return mentions;
}

export function toMention(id: string, type: Mentionables = "prompt") {
  return `<span data-type="mention" data-id=${id} data-mention-type=${type}></span>`;
}

// TODO: Resolve all types of mentions
export async function resolveMentions(
  content: string,
  workspace: string,
  client?: ReturnType<(typeof MCPClient)["forWorkspace"]>,
  options?: {
    /**
     * The id of the parent prompt. If provided, the resolution will skip the parent id to avoid infinite recursion.
     */
    parentPromptId?: string;
  },
): Promise<string> {
  const contentWithoutComments = content.replaceAll(COMMENT_REGEX, "");

  const mentions = extractMentionsFromString(content);

  const promptIds = mentions
    .filter((mention) => mention.type === "prompt")
    .map((mention) => mention.id);

  if (!promptIds.length) {
    return contentWithoutComments;
  }

  const prompts = await listPrompts(
    workspace,
    {
      ids: promptIds,
      resolveMentions: true,
    },
    undefined,
    client,
  ).catch((err) => {
    console.error(err);
    return [];
  });

  if (!prompts.length) {
    return contentWithoutComments;
  }

  const promptMap = new Map<string, Prompt>(
    prompts.map((prompt) => [prompt.id, prompt]),
  );

  return contentWithoutComments.replaceAll(
    MENTION_REGEX,
    (_match, id, type) => {
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
    },
  );
}
