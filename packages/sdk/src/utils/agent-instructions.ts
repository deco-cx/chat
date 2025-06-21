import { listPrompts } from "../crud/prompts.ts";
import { replacePromptMentions } from "./prompt-mentions.ts";
import type { Agent } from "../models/agent.ts";

/**
 * Processes agent instructions by replacing prompt mentions and appending additional prompts
 */
export async function processAgentInstructions(
  config: Agent,
  workspace: string,
): Promise<string> {
  try {
    // First process the main instructions to replace any mention-style prompts
    const processedInstructions = await replacePromptMentions(
      config.instructions,
      workspace,
    );

    // If no additional prompts, return the processed instructions
    if (!config.additional_prompts || config.additional_prompts.length === 0) {
      return processedInstructions;
    }

    // Fetch additional prompts
    const additionalPrompts = await listPrompts(workspace, {
      ids: config.additional_prompts,
    }).catch((error) => {
      console.error("Failed to fetch additional prompts:", error);
      return [];
    });

    // Resolve prompt contents
    const additionalContents = config.additional_prompts
      .map((promptId) => {
        const prompt = additionalPrompts.find((p) => p.id === promptId);
        if (!prompt) {
          console.warn(`Additional prompt with ID ${promptId} not found`);
          return "";
        }

        return prompt.content;
      })
      .filter(Boolean);

    // Combine main instructions with additional prompts
    if (additionalContents.length === 0) {
      return processedInstructions;
    }

    return [processedInstructions, ...additionalContents].join("\n\n");
  } catch (error) {
    console.error("Error processing agent instructions:", error);
    // Return the original instructions as fallback
    return config.instructions;
  }
}