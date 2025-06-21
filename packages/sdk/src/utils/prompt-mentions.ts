import { listPrompts } from "../crud/prompts.ts";
import { unescapeHTML } from "./html.ts";

interface PromptMention {
  id: string;
}

const MENTION_REGEX =
  /<span\s+data-type="mention"\s+[^>]*?data-id="([^"]+)"[^>]*?>.*?<\/span>/gs;
const PARTIAL_ESCAPED_MENTION_REGEX =
  /&lt;span\s+data-type="mention"\s+[^&]*?data-id="([^"]+)"[^&]*?&gt;.*?&lt;\/span&gt;/gs;
const ESCAPED_MENTION_REGEX =
  /&lt;span\s+data-type=&quot;mention&quot;\s+[^&]*?data-id=&quot;([^&]+)&quot;[^&]*?&gt;.*?&lt;\/span&gt;/gs;

// DateTime span regex patterns
const DATETIME_REGEX =
  /<span\s+data-type="datetime"[^>]*?>.*?<\/span>/gs;
const PARTIAL_ESCAPED_DATETIME_REGEX =
  /&lt;span\s+data-type="datetime"[^&]*?&gt;.*?&lt;\/span&gt;/gs;
const ESCAPED_DATETIME_REGEX =
  /&lt;span\s+data-type=&quot;datetime&quot;[^&]*?&gt;.*?&lt;\/span&gt;/gs;

/**
 * Normalizes mentions and datetime spans in a content string
 * @param content - The content string to normalize
 * @returns The normalized content string
 */
export function normalizeMentions(content: string): string {
  const mentionReplaceTo = '<span data-type="mention" data-id="$1"></span>';
  const datetimeReplaceTo = '<span data-type="datetime"></span>';

  return content
    .replaceAll(MENTION_REGEX, mentionReplaceTo)
    .replaceAll(PARTIAL_ESCAPED_MENTION_REGEX, mentionReplaceTo)
    .replaceAll(ESCAPED_MENTION_REGEX, mentionReplaceTo)
    .replaceAll(DATETIME_REGEX, datetimeReplaceTo)
    .replaceAll(PARTIAL_ESCAPED_DATETIME_REGEX, datetimeReplaceTo)
    .replaceAll(ESCAPED_DATETIME_REGEX, datetimeReplaceTo);
}

/**
 * Extracts prompt mentions from a system prompt
 */
export function extractPromptMentions(systemPrompt: string): PromptMention[] {
  const unescapedSystemPrompt = unescapeHTML(systemPrompt);
  const mentions: PromptMention[] = [];
  let match;

  while ((match = MENTION_REGEX.exec(unescapedSystemPrompt)) !== null) {
    mentions.push({
      id: match[1],
    });
  }

  return mentions;
}

/**
 * Replaces datetime spans with current date/time
 */
export function replaceDateTimeSpans(content: string): string {
  const currentDateTime = `Current date and time: ${
    new Date().toLocaleString()
  }`;

  return content.replaceAll(
    '<span data-type="datetime"></span>',
    currentDateTime,
  );
}

/**
 * Replaces prompt mentions with their content
 */
export async function replacePromptMentions(
  systemPrompt: string,
  workspace: string,
): Promise<string> {
  const mentions = extractPromptMentions(normalizeMentions(systemPrompt));
  let result = systemPrompt;

  // First replace datetime spans
  result = replaceDateTimeSpans(result);

  if (mentions.length === 0) {
    return result;
  }

  const prompts = await listPrompts(workspace, {
    ids: mentions.map((mention) => mention.id),
  }).catch(() => []);

  for (const mention of mentions) {
    const prompt = prompts.find((prompt) => prompt.id === mention.id);
    result = result.replaceAll(
      `<span data-type="mention" data-id="${mention.id}"></span>`,
      prompt?.content ?? "",
    );
  }

  return unescapeHTML(result);
}
