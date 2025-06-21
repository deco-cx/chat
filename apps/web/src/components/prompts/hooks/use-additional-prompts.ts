import { useMemo } from "react";
import { type Prompt, usePrompts, useCreatePrompt } from "@deco/sdk";

const DATE_TIME_PROMPT_NAME = "Date/Time Now";
const DATE_TIME_PROMPT_CONTENT = '<span data-type="datetime"></span>';

export function useAdditionalPrompts() {
  const { data: allPrompts } = usePrompts();
  const createPrompt = useCreatePrompt();

  // Check if Date/Time Now prompt exists, if not we'll show option to create it
  const dateTimePrompt = useMemo(() => {
    return allPrompts?.find((p) => p.name === DATE_TIME_PROMPT_NAME);
  }, [allPrompts]);

  const createDateTimePrompt = async () => {
    try {
      return await createPrompt.mutateAsync({
        name: DATE_TIME_PROMPT_NAME,
        description: "Adds the current date and time to your prompt",
        content: DATE_TIME_PROMPT_CONTENT,
      });
    } catch (error) {
      console.error("Failed to create Date/Time prompt:", error);
      throw error;
    }
  };

  const ensureDateTimePromptExists = async () => {
    try {
      if (!dateTimePrompt) {
        return await createDateTimePrompt();
      }
      return dateTimePrompt;
    } catch (error) {
      console.error("Failed to ensure Date/Time prompt exists:", error);
      throw error;
    }
  };

  return {
    allPrompts: allPrompts || [],
    dateTimePrompt,
    createDateTimePrompt,
    ensureDateTimePromptExists,
    isCreatingDateTimePrompt: createPrompt.isPending,
  };
}

export function resolvePromptContent(
  prompts: Prompt[],
  promptIds: string[],
): string {
  try {
    return promptIds
      .map((id) => {
        const prompt = prompts.find((p) => p.id === id);
        if (!prompt) {
          console.warn(`Prompt with ID ${id} not found`);
          return "";
        }

        return prompt.content;
      })
      .filter(Boolean)
      .join("\n\n");
  } catch (error) {
    console.error("Error resolving prompt content:", error);
    return "";
  }
}