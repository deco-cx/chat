import {
  type Prompt,
  PromptValidationSchema,
  useAgentData,
  useAgentRoot,
  usePrompt,
  useUpdatePrompt,
  WELL_KNOWN_AGENT_IDS,
} from "@deco/sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useBlocker, useParams } from "react-router";
import { trackEvent } from "../../../hooks/analytics.ts";
import { AgenticChatProvider } from "../../chat/provider.tsx";
import { Context } from "./context.ts";
import { PromptDetail } from "./form.tsx";
import { type DecopilotContextValue } from "../../decopilot/context.tsx";
import { DecopilotLayout } from "../../layout/decopilot-layout.tsx";

export default function Page() {
  const agentId = WELL_KNOWN_AGENT_IDS.promptAgent;

  const { id } = useParams();
  const promptId = id!;
  const threadId = promptId;

  const { data: _prompt, refetch: refetchPrompt } = usePrompt(promptId);
  const prompt = _prompt || {
    id: crypto.randomUUID(),
    name: "",
    description: "",
    content: "",
    created_at: new Date().toISOString(),
    updated_at: null,
  };
  const { data: _agent } = useAgentData(agentId);

  const [selectedPrompt, setSelectedPrompt] = useState<Prompt>(prompt);
  const [promptVersion, setPromptVersion] = useState<string | null>(null);

  const form = useForm<Prompt>({
    resolver: zodResolver(PromptValidationSchema),
    defaultValues: {
      id: selectedPrompt.id,
      name: selectedPrompt.name,
      description: selectedPrompt.description,
      content: selectedPrompt.content,
    },
  });

  useEffect(() => {
    if (_prompt) {
      setSelectedPrompt(_prompt);
    }
  }, [_prompt]);

  useEffect(() => {
    form.reset(selectedPrompt);
  }, [selectedPrompt]);

  const updatePrompt = useUpdatePrompt();

  const numberOfChanges = Object.keys(form.formState.dirtyFields).length;
  const blocker = useBlocker(numberOfChanges > 0);

  const handleCancel = () => {
    blocker.reset?.();
  };

  const handleDiscard = () => {
    form.reset(prompt);
    blocker.proceed?.();
  };

  const onSubmit = async (data: Prompt) => {
    try {
      // Update the existing integration
      await updatePrompt.mutateAsync({
        id: prompt.id,
        data,
      });

      trackEvent("prompt_update", {
        success: true,
        data,
      });

      form.reset(data);
    } catch (error) {
      console.error(`Error updating prompt:`, error);

      trackEvent("prompt_create", {
        success: false,
        error,
        data,
      });
    }
  };

  const handleRestoreVersion = async () => {
    await updatePrompt.mutateAsync({
      id: prompt.id,
      data: {
        name: selectedPrompt.name,
        content: selectedPrompt.content,
      },
    });
    setPromptVersion(null);
  };

  // Note: Removed useUpdateAgentCache usage - agent instructions are now managed
  // via AgentProvider in the new architecture. The prompt ID context should be
  // passed via chat overrides instead of modifying cached agent data.

  const agentRoot = useAgentRoot(agentId);

  const decopilotContextValue: DecopilotContextValue = {
    additionalTools: {
      "i:prompt-management": ["PROMPTS_GET", "PROMPTS_UPDATE"],
    },
    rules: [`You are editing the prompt with id: ${promptId}.`],
    onToolCall: (toolCall) => {
      if (toolCall.toolName === "PROMPTS_UPDATE") {
        refetchPrompt();
      }
    },
  };

  if (!_agent) {
    return null;
  }

  return (
    <DecopilotLayout value={decopilotContextValue}>
      <AgenticChatProvider
        agentId={agentId}
        threadId={threadId}
        agent={_agent}
        agentRoot={agentRoot}
        uiOptions={{
          showEditAgent: false,
        }}
      >
        <Context.Provider
          value={{
            form,
            prompt: selectedPrompt,
            setSelectedPrompt,
            onSubmit,
            promptVersion,
            setPromptVersion,
            handleRestoreVersion,
            handleDiscard,
            handleCancel,
            blocker,
          }}
        >
          <PromptDetail />
        </Context.Provider>
      </AgenticChatProvider>
    </DecopilotLayout>
  );
}
